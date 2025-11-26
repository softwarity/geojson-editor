class GeoJsonEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // Internal state
    this.collapsedData = new Map(); // nodeKey -> {originalLines: string[], indent: number}
    this.colorPositions = []; // {line, color}
    this.nodeTogglePositions = []; // {line, nodeKey, isCollapsed, indent}
    this.hiddenFeatures = new Set(); // Set of feature keys (hidden from events)
    this.featureRanges = new Map(); // featureKey -> {startLine, endLine, featureIndex}

    // Debounce timer for syntax highlighting
    this.highlightTimer = null;

    // Cached computed styles (avoid repeated getComputedStyle calls)
    this._cachedLineHeight = null;
    this._cachedPaddingTop = null;

    // Initialize themes from defaults
    this.themes = {
      dark: { ...GeoJsonEditor.DEFAULT_THEMES.dark },
      light: { ...GeoJsonEditor.DEFAULT_THEMES.light }
    };
  }

  static get observedAttributes() {
    return ['readonly', 'value', 'placeholder', 'dark-selector'];
  }


  // Default theme values
  static DEFAULT_THEMES = {
    dark: {
      background: '#1e1e1e',
      textColor: '#d4d4d4',
      caretColor: '#fff',
      gutterBackground: '#252526',
      gutterBorder: '#3e3e42',
      jsonKey: '#9cdcfe',
      jsonString: '#ce9178',
      jsonNumber: '#b5cea8',
      jsonBoolean: '#569cd6',
      jsonNull: '#569cd6',
      jsonPunctuation: '#d4d4d4',
      controlColor: '#c586c0',
      controlBg: '#3e3e42',
      controlBorder: '#555',
      geojsonKey: '#c586c0',
      geojsonType: '#4ec9b0',
      geojsonTypeInvalid: '#f44747',
      jsonKeyInvalid: '#f44747'
    },
    light: {
      background: '#ffffff',
      textColor: '#333333',
      caretColor: '#000',
      gutterBackground: '#f5f5f5',
      gutterBorder: '#ddd',
      jsonKey: '#0000ff',
      jsonString: '#a31515',
      jsonNumber: '#098658',
      jsonBoolean: '#0000ff',
      jsonNull: '#0000ff',
      jsonPunctuation: '#333333',
      controlColor: '#a31515',
      controlBg: '#e0e0e0',
      controlBorder: '#999',
      geojsonKey: '#af00db',
      geojsonType: '#267f99',
      geojsonTypeInvalid: '#d32f2f',
      jsonKeyInvalid: '#d32f2f'
    }
  };

  // FeatureCollection wrapper constants
  static FEATURE_COLLECTION_PREFIX = '{"type": "FeatureCollection", "features": [';
  static FEATURE_COLLECTION_SUFFIX = ']}';

  // SVG icon for visibility toggle (single icon, style changes based on state)
  static ICON_EYE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z"/></svg>';

  // Pre-compiled regex patterns (avoid recompilation on each call)
  static REGEX = {
    // HTML escaping
    ampersand: /&/g,
    lessThan: /</g,
    greaterThan: />/g,
    // JSON structure
    jsonKey: /"([^"]+)"\s*:/g,
    typeValue: /<span class="geojson-key">"type"<\/span>:\s*"([^"]*)"/g,
    stringValue: /:\s*"([^"]*)"/g,
    numberAfterColon: /:\s*(-?\d+\.?\d*)/g,
    boolean: /:\s*(true|false)/g,
    nullValue: /:\s*(null)/g,
    allNumbers: /\b(-?\d+\.?\d*)\b/g,
    punctuation: /([{}[\],])/g,
    // Highlighting detection
    colorInLine: /"([\w-]+)"\s*:\s*"(#[0-9a-fA-F]{6})"/g,
    collapsibleNode: /^(\s*)"(\w+)"\s*:\s*([{\[])/,
    collapsedMarker: /^(\s*)"(\w+)"\s*:\s*([{\[])\.\.\.([\]\}])/
  };

  connectedCallback() {
    this.render();
    this.setupEventListeners();

    // Update prefix/suffix display
    this.updatePrefixSuffix();

    // Setup theme CSS
    this.updateThemeCSS();

    // Initialize textarea with value attribute (attributeChangedCallback fires before render)
    if (this.value) {
      this.updateValue(this.value);
    }
    this.updatePlaceholderContent();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    if (name === 'value') {
      this.updateValue(newValue);
    } else if (name === 'readonly') {
      this.updateReadonly();
    } else if (name === 'placeholder') {
      this.updatePlaceholderContent();
    } else if (name === 'dark-selector') {
      this.updateThemeCSS();
    }
  }

  // Properties
  get readonly() {
    return this.hasAttribute('readonly');
  }


  get value() {
    return this.getAttribute('value') || '';
  }

  get placeholder() {
    return this.getAttribute('placeholder') || '';
  }

  // Always in FeatureCollection mode - prefix/suffix are constant
  get prefix() {
    return GeoJsonEditor.FEATURE_COLLECTION_PREFIX;
  }

  get suffix() {
    return GeoJsonEditor.FEATURE_COLLECTION_SUFFIX;
  }

  render() {
    const styles = `
      <style>
        /* Global reset with exact values to prevent external CSS interference */
        :host *,
        :host *::before,
        :host *::after {
          box-sizing: border-box;
          font-family: 'Courier New', Courier, monospace;
          font-size: 13px;
          font-weight: normal;
          font-style: normal;
          font-variant: normal;
          line-height: 1.5;
          letter-spacing: 0;
          text-transform: none;
          text-decoration: none;
          text-indent: 0;
          word-spacing: 0;
        }

        :host {
          display: flex;
          flex-direction: column;
          position: relative;
          width: 100%;
          height: 400px;
          font-family: 'Courier New', Courier, monospace;
          font-size: 13px;
          line-height: 1.5;
          border-radius: 4px;
          overflow: hidden;
        }

        :host([readonly]) .editor-wrapper::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          background: repeating-linear-gradient(
            -45deg,
            rgba(128, 128, 128, 0.08),
            rgba(128, 128, 128, 0.08) 3px,
            transparent 3px,
            transparent 12px
          );
          z-index: 1;
        }

        :host([readonly]) textarea {
          cursor: text;
        }

        .editor-wrapper {
          position: relative;
          width: 100%;
          flex: 1;
          background: var(--bg-color);
          display: flex;
          font-family: 'Courier New', Courier, monospace;
          font-size: 13px;
          line-height: 1.5;
        }

        .gutter {
          width: 24px;
          height: 100%;
          background: var(--gutter-bg);
          border-right: 1px solid var(--gutter-border);
          overflow: hidden;
          flex-shrink: 0;
          position: relative;
        }

        .gutter-content {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          padding: 8px 4px;
        }

        .gutter-line {
          position: absolute;
          left: 0;
          width: 100%;
          height: 1.5em;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .color-indicator {
          width: 12px;
          height: 12px;
          border-radius: 2px;
          border: 1px solid #555;
          cursor: pointer;
          transition: transform 0.1s;
          flex-shrink: 0;
        }

        .color-indicator:hover {
          transform: scale(1.2);
          border-color: #fff;
        }

        .collapse-button {
          width: 12px;
          height: 12px;
          background: var(--control-bg);
          border: 1px solid var(--control-border);
          border-radius: 2px;
          color: var(--control-color);
          font-size: 8px;
          font-weight: bold;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.1s;
          flex-shrink: 0;
          user-select: none;
        }

        .collapse-button:hover {
          background: var(--control-bg);
          border-color: var(--control-color);
          transform: scale(1.1);
        }

        .visibility-button {
          width: 14px;
          height: 14px;
          background: transparent;
          border: none;
          color: var(--control-color);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.1s;
          flex-shrink: 0;
          opacity: 0.7;
          padding: 0;
        }

        .visibility-button:hover {
          opacity: 1;
          transform: scale(1.1);
        }

        .visibility-button.hidden {
          opacity: 0.4;
        }

        .visibility-button svg {
          width: 12px;
          height: 12px;
          fill: currentColor;
        }

        /* Hidden feature lines - grayed out */
        .line-hidden {
          opacity: 0.35;
          filter: grayscale(50%);
        }

        .color-picker-popup {
          position: absolute;
          background: #2d2d30;
          border: 1px solid #555;
          border-radius: 4px;
          padding: 8px;
          z-index: 1000;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }

        .color-picker-popup input[type="color"] {
          width: 150px;
          height: 30px;
          border: none;
          cursor: pointer;
        }

        .editor-content {
          position: relative;
          flex: 1;
          overflow: hidden;
        }

        .highlight-layer {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          padding: 8px 12px;
          font-family: 'Courier New', Courier, monospace;
          font-size: 13px;
          font-weight: normal;
          font-style: normal;
          line-height: 1.5;
          white-space: pre-wrap;
          word-wrap: break-word;
          overflow: auto;
          pointer-events: none;
          z-index: 1;
          color: var(--text-color);
        }

        .highlight-layer::-webkit-scrollbar {
          display: none;
        }

        textarea {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          padding: 8px 12px;
          margin: 0;
          border: none;
          outline: none;
          background: transparent;
          color: transparent;
          caret-color: var(--caret-color);
          font-family: 'Courier New', Courier, monospace;
          font-size: 13px;
          font-weight: normal;
          font-style: normal;
          line-height: 1.5;
          white-space: pre-wrap;
          word-wrap: break-word;
          resize: none;
          overflow: auto;
          z-index: 2;
          box-sizing: border-box;
        }

        textarea::selection {
          background: rgba(51, 153, 255, 0.3);
        }

        textarea::placeholder {
          color: transparent;
        }

        .placeholder-layer {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          padding: 8px 12px;
          font-family: 'Courier New', Courier, monospace;
          font-size: 13px;
          font-weight: normal;
          font-style: normal;
          line-height: 1.5;
          white-space: pre-wrap;
          word-wrap: break-word;
          color: #6a6a6a;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
        }

        textarea:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        /* Syntax highlighting colors */
        .json-key {
          color: var(--json-key);
        }

        .json-string {
          color: var(--json-string);
        }

        .json-number {
          color: var(--json-number);
        }

        .json-boolean {
          color: var(--json-boolean);
        }

        .json-null {
          color: var(--json-null);
        }

        .json-punctuation {
          color: var(--json-punct);
        }

        /* GeoJSON-specific highlighting */
        .geojson-key {
          color: var(--geojson-key);
          font-weight: 600;
        }

        .geojson-type {
          color: var(--geojson-type);
          font-weight: 600;
        }

        .geojson-type-invalid {
          color: var(--geojson-type-invalid);
          font-weight: 600;
        }

        .json-key-invalid {
          color: var(--json-key-invalid);
        }

        /* Prefix and suffix wrapper with gutter */
        .prefix-wrapper,
        .suffix-wrapper {
          display: flex;
          flex-shrink: 0;
          background: var(--bg-color);
        }

        .prefix-gutter,
        .suffix-gutter {
          width: 24px;
          background: var(--gutter-bg);
          border-right: 1px solid var(--gutter-border);
          flex-shrink: 0;
        }

        .editor-prefix,
        .editor-suffix {
          flex: 1;
          padding: 4px 12px;
          color: var(--text-color);
          background: var(--bg-color);
          user-select: none;
          white-space: pre-wrap;
          word-wrap: break-word;
          font-family: 'Courier New', Courier, monospace;
          font-size: 13px;
          line-height: 1.5;
          opacity: 0.6;
        }

        .prefix-wrapper {
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .suffix-wrapper {
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          position: relative;
        }

        /* Clear button in suffix area */
        .clear-btn {
          position: absolute;
          right: 0.5rem;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: var(--text-color);
          opacity: 0.3;
          cursor: pointer;
          font-size: 0.65rem;
          width: 1rem;
          height: 1rem;
          padding: 0.15rem 0 0 0;
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          transition: opacity 0.2s, background 0.2s;
        }
        .clear-btn:hover {
          opacity: 0.7;
          background: rgba(255, 255, 255, 0.1);
        }
        .clear-btn[hidden] {
          display: none;
        }

        /* Scrollbar styling - WebKit (Chrome, Safari, Edge) */
        textarea::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }

        textarea::-webkit-scrollbar-track {
          background: var(--control-bg);
        }

        textarea::-webkit-scrollbar-thumb {
          background: var(--control-border);
          border-radius: 5px;
        }

        textarea::-webkit-scrollbar-thumb:hover {
          background: var(--control-color);
        }

        /* Scrollbar styling - Firefox */
        textarea {
          scrollbar-width: thin;
          scrollbar-color: var(--control-border) var(--control-bg);
        }
      </style>
    `;

    const template = `
      <div class="prefix-wrapper">
        <div class="prefix-gutter"></div>
        <div class="editor-prefix" id="editorPrefix"></div>
      </div>
      <div class="editor-wrapper">
        <div class="gutter">
          <div class="gutter-content" id="gutterContent"></div>
        </div>
        <div class="editor-content">
          <div class="placeholder-layer" id="placeholderLayer">${this.escapeHtml(this.placeholder)}</div>
          <div class="highlight-layer" id="highlightLayer"></div>
          <textarea
            id="textarea"
            spellcheck="false"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
          ></textarea>
        </div>
      </div>
      <div class="suffix-wrapper">
        <div class="suffix-gutter"></div>
        <div class="editor-suffix" id="editorSuffix"></div>
        <button class="clear-btn" id="clearBtn" title="Clear editor">✕</button>
      </div>
    `;

    this.shadowRoot.innerHTML = styles + template;
  }

  setupEventListeners() {
    const textarea = this.shadowRoot.getElementById('textarea');
    const highlightLayer = this.shadowRoot.getElementById('highlightLayer');

    // Sync scroll between textarea and highlight layer
    textarea.addEventListener('scroll', () => {
      highlightLayer.scrollTop = textarea.scrollTop;
      highlightLayer.scrollLeft = textarea.scrollLeft;
      this.syncGutterScroll(textarea.scrollTop);
    });

    // Input handling with debounced highlight and auto-format
    textarea.addEventListener('input', () => {
      // Update placeholder visibility immediately (no debounce)
      this.updatePlaceholderVisibility();

      clearTimeout(this.highlightTimer);
      this.highlightTimer = setTimeout(() => {
        // Auto-format JSON content
        this.autoFormatContentWithCursor();
        this.updateHighlight();
        this.emitChange();
      }, 150);
    });

    // Paste handling - trigger immediately without debounce
    textarea.addEventListener('paste', () => {
      // Clear any pending highlight timer to avoid duplicate processing
      clearTimeout(this.highlightTimer);

      // Use a short delay to let the paste complete
      setTimeout(() => {
        this.updatePlaceholderVisibility();
        // Auto-format JSON content
        this.autoFormatContentWithCursor();
        this.updateHighlight();
        this.emitChange();
        // Auto-collapse coordinates after paste
        this.applyAutoCollapsed();
      }, 10);
    });

    // Gutter clicks (color indicators and collapse buttons)
    const gutterContent = this.shadowRoot.getElementById('gutterContent');
    gutterContent.addEventListener('click', (e) => {
      // Check for visibility button (may click on SVG inside button)
      const visibilityButton = e.target.closest('.visibility-button');
      if (visibilityButton) {
        const featureKey = visibilityButton.dataset.featureKey;
        this.toggleFeatureVisibility(featureKey);
        return;
      }

      if (e.target.classList.contains('color-indicator')) {
        const line = parseInt(e.target.dataset.line);
        const color = e.target.dataset.color;
        const attributeName = e.target.dataset.attributeName;
        this.showColorPicker(e.target, line, color, attributeName);
      } else if (e.target.classList.contains('collapse-button')) {
        const nodeKey = e.target.dataset.nodeKey;
        const line = parseInt(e.target.dataset.line);
        this.toggleCollapse(nodeKey, line);
      }
    });

    // Transfer wheel scroll from gutter to textarea
    const gutter = this.shadowRoot.querySelector('.gutter');
    gutter.addEventListener('wheel', (e) => {
      e.preventDefault();
      textarea.scrollTop += e.deltaY;
    });

    // Block editing in collapsed areas
    textarea.addEventListener('keydown', (e) => {
      this.handleKeydownInCollapsedArea(e);
    });

    // Handle copy to include collapsed content
    textarea.addEventListener('copy', (e) => {
      this.handleCopyWithCollapsedContent(e);
    });

    // Handle cut to include collapsed content
    textarea.addEventListener('cut', (e) => {
      this.handleCutWithCollapsedContent(e);
    });

    // Clear button
    const clearBtn = this.shadowRoot.getElementById('clearBtn');
    clearBtn.addEventListener('click', () => {
      this.removeAll();
    });

    // Update readonly state
    this.updateReadonly();
  }

  syncGutterScroll(scrollTop) {
    const gutterContent = this.shadowRoot.getElementById('gutterContent');
    gutterContent.style.transform = `translateY(-${scrollTop}px)`;
  }

  updateReadonly() {
    const textarea = this.shadowRoot.getElementById('textarea');
    if (textarea) {
      textarea.disabled = this.readonly;
    }
    // Hide clear button in readonly mode
    const clearBtn = this.shadowRoot.getElementById('clearBtn');
    if (clearBtn) {
      clearBtn.hidden = this.readonly;
    }
  }

  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  updatePlaceholderVisibility() {
    const textarea = this.shadowRoot.getElementById('textarea');
    const placeholderLayer = this.shadowRoot.getElementById('placeholderLayer');
    if (textarea && placeholderLayer) {
      placeholderLayer.style.display = textarea.value ? 'none' : 'block';
    }
  }

  updatePlaceholderContent() {
    const placeholderLayer = this.shadowRoot.getElementById('placeholderLayer');
    if (placeholderLayer) {
      placeholderLayer.textContent = this.placeholder;
    }
    this.updatePlaceholderVisibility();
  }

  updateValue(newValue) {
    const textarea = this.shadowRoot.getElementById('textarea');
    if (textarea && textarea.value !== newValue) {
      textarea.value = newValue || '';

      // Auto-format JSON content
      if (newValue) {
        try {
          const prefix = this.prefix;
          const suffix = this.suffix;

          // Check if prefix ends with [ and suffix starts with ]
          const prefixEndsWithBracket = prefix.trimEnd().endsWith('[');
          const suffixStartsWithBracket = suffix.trimStart().startsWith(']');

          if (prefixEndsWithBracket && suffixStartsWithBracket) {
            // Wrap content in array brackets for validation and formatting
            const wrapped = '[' + newValue + ']';
            const parsed = JSON.parse(wrapped);
            const formatted = JSON.stringify(parsed, null, 2);

            // Remove first [ and last ] from formatted
            const lines = formatted.split('\n');
            if (lines.length > 2) {
              textarea.value = lines.slice(1, -1).join('\n');
            } else {
              textarea.value = '';
            }
          } else if (!prefix && !suffix) {
            // No prefix/suffix - format directly
            const parsed = JSON.parse(newValue);
            textarea.value = JSON.stringify(parsed, null, 2);
          }
          // else: keep as-is for complex cases
        } catch (e) {
          // Invalid JSON, keep as-is
        }
      }

      this.updateHighlight();
      this.updatePlaceholderVisibility();

      // Auto-collapse coordinates nodes after value is set
      if (textarea.value) {
        requestAnimationFrame(() => {
          this.applyAutoCollapsed();
        });
      }

      // Emit change/error event for programmatic value changes
      this.emitChange();
    }
  }

  updatePrefixSuffix() {
    const prefixEl = this.shadowRoot.getElementById('editorPrefix');
    const suffixEl = this.shadowRoot.getElementById('editorSuffix');

    // Always show prefix/suffix (always in FeatureCollection mode)
    if (prefixEl) {
      prefixEl.textContent = this.prefix;
    }

    if (suffixEl) {
      suffixEl.textContent = this.suffix;
    }
  }

  updateHighlight() {
    const textarea = this.shadowRoot.getElementById('textarea');
    const highlightLayer = this.shadowRoot.getElementById('highlightLayer');

    if (!textarea || !highlightLayer) return;

    const text = textarea.value;

    // Update feature ranges for visibility tracking
    this.updateFeatureRanges();

    // Get hidden line ranges
    const hiddenRanges = this.getHiddenLineRanges();

    // Parse and highlight
    const { highlighted, colors, toggles } = this.highlightJSON(text, hiddenRanges);

    highlightLayer.innerHTML = highlighted;
    this.colorPositions = colors;
    this.nodeTogglePositions = toggles;

    // Update gutter with color indicators
    this.updateGutter();
  }

  highlightJSON(text, hiddenRanges = []) {
    if (!text.trim()) {
      return { highlighted: '', colors: [], toggles: [] };
    }

    const lines = text.split('\n');
    const colors = [];
    const toggles = [];
    let highlightedLines = [];

    // Build context map for validation
    const contextMap = this.buildContextMap(text);

    // Helper to check if a line is in a hidden range
    const isLineHidden = (lineIndex) => {
      return hiddenRanges.some(range => lineIndex >= range.startLine && lineIndex <= range.endLine);
    };

    lines.forEach((line, lineIndex) => {
      // Detect any hex color (6 digits) in string values
      const R = GeoJsonEditor.REGEX;
      R.colorInLine.lastIndex = 0; // Reset for global regex
      let colorMatch;
      while ((colorMatch = R.colorInLine.exec(line)) !== null) {
        colors.push({
          line: lineIndex,
          color: colorMatch[2],  // The hex color
          attributeName: colorMatch[1]  // The attribute name
        });
      }

      // Detect collapsible nodes (all nodes are collapsible)
      const nodeMatch = line.match(R.collapsibleNode);
      if (nodeMatch) {
        const nodeKey = nodeMatch[2];

        // Check if this is a collapsed marker first
        const isCollapsed = line.includes('{...}') || line.includes('[...]');

        if (isCollapsed) {
          // It's collapsed, always show button
          toggles.push({
            line: lineIndex,
            nodeKey,
            isCollapsed: true
          });
        } else {
          // Not collapsed - only add toggle button if it doesn't close on same line
          if (!this.bracketClosesOnSameLine(line, nodeMatch[3])) {
            toggles.push({
              line: lineIndex,
              nodeKey,
              isCollapsed: false
            });
          }
        }
      }

      // Highlight the line with context
      const context = contextMap.get(lineIndex);
      let highlightedLine = this.highlightSyntax(line, context);

      // Wrap hidden lines with .line-hidden class
      if (isLineHidden(lineIndex)) {
        highlightedLine = `<span class="line-hidden">${highlightedLine}</span>`;
      }

      highlightedLines.push(highlightedLine);
    });

    return {
      highlighted: highlightedLines.join('\n'),
      colors,
      toggles
    };
  }

  // GeoJSON type constants
  static GEOJSON_TYPES_FEATURE = ['Feature', 'FeatureCollection'];
  static GEOJSON_TYPES_GEOMETRY = ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon', 'GeometryCollection'];
  static GEOJSON_TYPES_ALL = [...GeoJsonEditor.GEOJSON_TYPES_FEATURE, ...GeoJsonEditor.GEOJSON_TYPES_GEOMETRY];

  // Valid keys per context (null = any key is valid)
  static VALID_KEYS_BY_CONTEXT = {
    Feature: ['type', 'geometry', 'properties', 'id', 'bbox'],
    FeatureCollection: ['type', 'features', 'bbox', 'properties'],
    Point: ['type', 'coordinates', 'bbox'],
    MultiPoint: ['type', 'coordinates', 'bbox'],
    LineString: ['type', 'coordinates', 'bbox'],
    MultiLineString: ['type', 'coordinates', 'bbox'],
    Polygon: ['type', 'coordinates', 'bbox'],
    MultiPolygon: ['type', 'coordinates', 'bbox'],
    GeometryCollection: ['type', 'geometries', 'bbox'],
    properties: null,  // Any key valid in properties
    geometry: ['type', 'coordinates', 'geometries', 'bbox'],  // Generic geometry context
  };

  // Keys that change context for their value
  static CONTEXT_CHANGING_KEYS = {
    geometry: 'geometry',
    properties: 'properties',
    features: 'Feature',      // Array of Features
    geometries: 'geometry',   // Array of geometries
  };

  // Build context map for each line by analyzing JSON structure
  buildContextMap(text) {
    const lines = text.split('\n');
    const contextMap = new Map();  // line index -> context
    const contextStack = [];       // Stack of {context, isArray}
    let pendingContext = null;     // Context for next object/array

    // Root context is always 'Feature' (always in FeatureCollection mode)
    const rootContext = 'Feature';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Record context at START of line (for key validation)
      const lineContext = contextStack.length > 0
        ? contextStack[contextStack.length - 1]?.context
        : rootContext;
      contextMap.set(i, lineContext);

      // Process each character to track brackets for subsequent lines
      // Track string state to ignore brackets inside strings
      let inString = false;
      let escape = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];

        // Handle escape sequences
        if (escape) {
          escape = false;
          continue;
        }
        if (char === '\\' && inString) {
          escape = true;
          continue;
        }

        // Track string boundaries
        if (char === '"') {
          if (!inString) {
            // Entering string - check for special patterns before toggling
            const keyMatch = line.substring(j).match(/^"([^"\\]*(?:\\.[^"\\]*)*)"\s*:/);
            if (keyMatch) {
              const keyName = keyMatch[1];
              if (GeoJsonEditor.CONTEXT_CHANGING_KEYS[keyName]) {
                pendingContext = GeoJsonEditor.CONTEXT_CHANGING_KEYS[keyName];
              }
              j += keyMatch[0].length - 1;  // Skip past the key
              continue;
            }

            // Check for type value to refine context: "type": "Point"
            if (contextStack.length > 0) {
              const typeMatch = line.substring(0, j).match(/"type"\s*:\s*$/);
              if (typeMatch) {
                const valueMatch = line.substring(j).match(/^"([^"\\]*(?:\\.[^"\\]*)*)"/);
                if (valueMatch && GeoJsonEditor.GEOJSON_TYPES_ALL.includes(valueMatch[1])) {
                  const currentCtx = contextStack[contextStack.length - 1];
                  if (currentCtx) {
                    currentCtx.context = valueMatch[1];
                  }
                }
                // Skip past this string value
                j += valueMatch ? valueMatch[0].length - 1 : 0;
                continue;
              }
            }
          }
          inString = !inString;
          continue;
        }

        // Skip everything inside strings (brackets, etc.)
        if (inString) continue;

        // Opening bracket - push context
        if (char === '{' || char === '[') {
          let newContext;
          if (pendingContext) {
            newContext = pendingContext;
            pendingContext = null;
          } else if (contextStack.length === 0) {
            newContext = rootContext;
          } else {
            const parent = contextStack[contextStack.length - 1];
            if (parent && parent.isArray) {
              newContext = parent.context;
            } else {
              newContext = null;
            }
          }
          contextStack.push({ context: newContext, isArray: char === '[' });
        }

        // Closing bracket - pop context
        if (char === '}' || char === ']') {
          if (contextStack.length > 0) {
            contextStack.pop();
          }
        }
      }
    }

    return contextMap;
  }

  // All known GeoJSON structural keys (always valid in GeoJSON)
  static GEOJSON_STRUCTURAL_KEYS = ['type', 'geometry', 'properties', 'features', 'geometries', 'coordinates', 'bbox', 'id', 'crs'];

  highlightSyntax(text, context) {
    if (!text.trim()) return '';

    // Get valid keys for current context
    const validKeys = context ? GeoJsonEditor.VALID_KEYS_BY_CONTEXT[context] : null;

    // Helper to check if a key is valid in current context
    const isKeyValid = (key) => {
      // GeoJSON structural keys are always valid
      if (GeoJsonEditor.GEOJSON_STRUCTURAL_KEYS.includes(key)) return true;
      // No context or null validKeys means all keys are valid
      if (!context || validKeys === null || validKeys === undefined) return true;
      return validKeys.includes(key);
    };

    // Helper to check if a type value is valid in current context
    const isTypeValid = (typeValue) => {
      // Unknown context - don't validate (could be inside misspelled properties, etc.)
      if (!context) return true;
      if (context === 'properties') return true;  // Any type in properties
      if (context === 'geometry' || GeoJsonEditor.GEOJSON_TYPES_GEOMETRY.includes(context)) {
        return GeoJsonEditor.GEOJSON_TYPES_GEOMETRY.includes(typeValue);
      }
      // Only validate as GeoJSON type in known Feature/FeatureCollection context
      if (context === 'Feature' || context === 'FeatureCollection') {
        return GeoJsonEditor.GEOJSON_TYPES_ALL.includes(typeValue);
      }
      return true;  // Unknown context - accept any type
    };

    const R = GeoJsonEditor.REGEX;

    return text
      // Escape HTML first
      .replace(R.ampersand, '&amp;')
      .replace(R.lessThan, '&lt;')
      .replace(R.greaterThan, '&gt;')
      // All JSON keys - validate against context
      .replace(R.jsonKey, (_, key) => {
        // Inside properties - all keys are regular user keys
        if (context === 'properties') {
          return `<span class="json-key">"${key}"</span>:`;
        }
        // GeoJSON structural keys - highlighted as geojson-key
        if (GeoJsonEditor.GEOJSON_STRUCTURAL_KEYS.includes(key)) {
          return `<span class="geojson-key">"${key}"</span>:`;
        }
        // Regular key - validate against context
        if (isKeyValid(key)) {
          return `<span class="json-key">"${key}"</span>:`;
        } else {
          return `<span class="json-key-invalid">"${key}"</span>:`;
        }
      })
      // GeoJSON "type" values - validate based on context
      .replace(R.typeValue, (_, typeValue) => {
        if (isTypeValid(typeValue)) {
          return `<span class="geojson-key">"type"</span>: <span class="geojson-type">"${typeValue}"</span>`;
        } else {
          return `<span class="geojson-key">"type"</span>: <span class="geojson-type-invalid">"${typeValue}"</span>`;
        }
      })
      // Generic string values
      .replace(R.stringValue, (match, value) => {
        // Skip if already highlighted (has span)
        if (match.includes('<span')) return match;
        return `: <span class="json-string">"${value}"</span>`;
      })
      .replace(R.numberAfterColon, ': <span class="json-number">$1</span>')
      .replace(R.boolean, ': <span class="json-boolean">$1</span>')
      .replace(R.nullValue, ': <span class="json-null">$1</span>')
      .replace(R.allNumbers, '<span class="json-number">$1</span>')
      .replace(R.punctuation, '<span class="json-punctuation">$1</span>');
  }

  toggleCollapse(nodeKey, line) {
    const textarea = this.shadowRoot.getElementById('textarea');
    const lines = textarea.value.split('\n');
    const currentLine = lines[line];

    // Check if line has collapse marker
    const hasMarker = currentLine.includes('{...}') || currentLine.includes('[...]');

    if (hasMarker) {
      // Expand: find the correct collapsed data by searching for this nodeKey
      let foundKey = null;
      let foundData = null;

      // Try exact match first
      const exactKey = `${line}-${nodeKey}`;
      if (this.collapsedData.has(exactKey)) {
        foundKey = exactKey;
        foundData = this.collapsedData.get(exactKey);
      } else {
        // Search for any key with this nodeKey (line numbers may have shifted)
        for (const [key, data] of this.collapsedData.entries()) {
          if (data.nodeKey === nodeKey) {
            // Check indent to distinguish between multiple nodes with same name
            const currentIndent = currentLine.match(/^(\s*)/)[1].length;
            if (data.indent === currentIndent) {
              foundKey = key;
              foundData = data;
              break;
            }
          }
        }
      }

      if (!foundKey || !foundData) {
        return;
      }

      const {originalLine, content} = foundData;

      // Restore original line and content
      lines[line] = originalLine;
      lines.splice(line + 1, 0, ...content);

      // Remove from storage
      this.collapsedData.delete(foundKey);
    } else {
      // Collapse: read and store content
      const match = currentLine.match(/^(\s*)"([^"]+)"\s*:\s*([{\[])/);
      if (!match) return;

      const indent = match[1];
      const openBracket = match[3];
      const closeBracket = openBracket === '{' ? '}' : ']';

      // Check if bracket closes on same line - can't collapse
      if (this.bracketClosesOnSameLine(currentLine, openBracket)) return;

      // Find closing bracket using helper (handles brackets in strings correctly)
      const result = this._findClosingBracket(lines, line, openBracket);
      if (!result) return;

      const { endLine, content } = result;

      // Store the original data with unique key
      const uniqueKey = `${line}-${nodeKey}`;
      this.collapsedData.set(uniqueKey, {
        originalLine: currentLine,
        content: content,
        indent: indent.length,
        nodeKey: nodeKey
      });

      // Replace with marker
      const beforeBracket = currentLine.substring(0, currentLine.indexOf(openBracket));
      const hasTrailingComma = lines[endLine] && lines[endLine].trim().endsWith(',');
      lines[line] = `${beforeBracket}${openBracket}...${closeBracket}${hasTrailingComma ? ',' : ''}`;

      // Remove content lines
      lines.splice(line + 1, endLine - line);
    }

    // Update textarea
    textarea.value = lines.join('\n');
    this.updateHighlight();
  }

  applyAutoCollapsed() {
    const textarea = this.shadowRoot.getElementById('textarea');
    if (!textarea || !textarea.value) return;

    const lines = textarea.value.split('\n');

    // Iterate backwards to avoid index issues when collapsing
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const match = line.match(/^(\s*)"(\w+)"\s*:\s*([{\[])/);

      if (match) {
        const nodeKey = match[2];

        // Check if this node should be auto-collapsed (coordinates only)
        if (nodeKey === 'coordinates') {
          const indent = match[1];
          const openBracket = match[3];
          const closeBracket = openBracket === '{' ? '}' : ']';

          // Skip if bracket closes on same line
          if (this.bracketClosesOnSameLine(line, openBracket)) continue;

          // Find closing bracket using helper (handles brackets in strings correctly)
          const result = this._findClosingBracket(lines, i, openBracket);
          if (!result) continue;

          const { endLine, content } = result;

          // Store the original data with unique key
          const uniqueKey = `${i}-${nodeKey}`;
          this.collapsedData.set(uniqueKey, {
            originalLine: line,
            content: content,
            indent: indent.length,
            nodeKey: nodeKey
          });

          // Replace with marker
          const beforeBracket = line.substring(0, line.indexOf(openBracket));
          const hasTrailingComma = lines[endLine] && lines[endLine].trim().endsWith(',');
          lines[i] = `${beforeBracket}${openBracket}...${closeBracket}${hasTrailingComma ? ',' : ''}`;

          // Remove content lines
          lines.splice(i + 1, endLine - i);
        }
      }
    }

    // Update textarea
    textarea.value = lines.join('\n');
    this.updateHighlight();
  }


  updateGutter() {
    const gutterContent = this.shadowRoot.getElementById('gutterContent');
    const textarea = this.shadowRoot.getElementById('textarea');

    if (!textarea) return;

    // Use cached computed styles (computed once, reused)
    if (this._cachedLineHeight === null) {
      const styles = getComputedStyle(textarea);
      this._cachedLineHeight = parseFloat(styles.lineHeight);
      this._cachedPaddingTop = parseFloat(styles.paddingTop);
    }
    const lineHeight = this._cachedLineHeight;
    const paddingTop = this._cachedPaddingTop;

    // Clear gutter
    gutterContent.textContent = '';

    // Create a map of line -> elements (color, collapse button, visibility button)
    const lineElements = new Map();

    // Helper to ensure line entry exists
    const ensureLine = (line) => {
      if (!lineElements.has(line)) {
        lineElements.set(line, { colors: [], buttons: [], visibilityButtons: [] });
      }
      return lineElements.get(line);
    };

    // Add color indicators
    this.colorPositions.forEach(({ line, color, attributeName }) => {
      ensureLine(line).colors.push({ color, attributeName });
    });

    // Add collapse buttons
    this.nodeTogglePositions.forEach(({ line, nodeKey, isCollapsed }) => {
      ensureLine(line).buttons.push({ nodeKey, isCollapsed });
    });

    // Add visibility buttons for Features (on the opening brace line)
    for (const [featureKey, range] of this.featureRanges) {
      const isHidden = this.hiddenFeatures.has(featureKey);
      ensureLine(range.startLine).visibilityButtons.push({ featureKey, isHidden });
    }

    // Create gutter lines with DocumentFragment (single DOM update)
    const fragment = document.createDocumentFragment();

    lineElements.forEach((elements, line) => {
      const gutterLine = document.createElement('div');
      gutterLine.className = 'gutter-line';
      gutterLine.style.top = `${paddingTop + line * lineHeight}px`;

      // Add visibility buttons first (leftmost)
      elements.visibilityButtons.forEach(({ featureKey, isHidden }) => {
        const button = document.createElement('button');
        button.className = 'visibility-button' + (isHidden ? ' hidden' : '');
        button.innerHTML = GeoJsonEditor.ICON_EYE;
        button.dataset.featureKey = featureKey;
        button.title = isHidden ? 'Show feature in events' : 'Hide feature from events';
        gutterLine.appendChild(button);
      });

      // Add color indicators
      elements.colors.forEach(({ color, attributeName }) => {
        const indicator = document.createElement('div');
        indicator.className = 'color-indicator';
        indicator.style.backgroundColor = color;
        indicator.dataset.line = line;
        indicator.dataset.color = color;
        indicator.dataset.attributeName = attributeName;
        indicator.title = `${attributeName}: ${color}`;
        gutterLine.appendChild(indicator);
      });

      // Add collapse buttons
      elements.buttons.forEach(({ nodeKey, isCollapsed }) => {
        const button = document.createElement('div');
        button.className = 'collapse-button';
        button.textContent = isCollapsed ? '+' : '-';
        button.dataset.line = line;
        button.dataset.nodeKey = nodeKey;
        button.title = isCollapsed ? 'Expand' : 'Collapse';
        gutterLine.appendChild(button);
      });

      fragment.appendChild(gutterLine);
    });

    // Single DOM insertion
    gutterContent.appendChild(fragment);
  }

  showColorPicker(indicator, line, currentColor, attributeName) {
    // Remove existing picker and clean up its listener
    const existing = document.querySelector('.geojson-color-picker-input');
    if (existing) {
      // Clean up the stored listener before removing
      if (existing._closeListener) {
        document.removeEventListener('click', existing._closeListener, true);
      }
      existing.remove();
    }

    // Create small color input positioned at the indicator
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = currentColor;
    colorInput.className = 'geojson-color-picker-input';

    // Get indicator position in viewport
    const rect = indicator.getBoundingClientRect();

    colorInput.style.position = 'fixed';
    colorInput.style.left = `${rect.left}px`;
    colorInput.style.top = `${rect.top}px`;
    colorInput.style.width = '12px';
    colorInput.style.height = '12px';
    colorInput.style.opacity = '0.01';
    colorInput.style.border = 'none';
    colorInput.style.padding = '0';
    colorInput.style.zIndex = '9999';

    colorInput.addEventListener('input', (e) => {
      // User is actively changing the color - update in real-time
      this.updateColorValue(line, e.target.value, attributeName);
    });

    colorInput.addEventListener('change', (e) => {
      // Picker closed with validation
      this.updateColorValue(line, e.target.value, attributeName);
    });

    // Close picker when clicking anywhere else
    const closeOnClickOutside = (e) => {
      if (e.target !== colorInput && !colorInput.contains(e.target)) {
        document.removeEventListener('click', closeOnClickOutside, true);
        colorInput.remove();
      }
    };

    // Store the listener reference on the element for cleanup
    colorInput._closeListener = closeOnClickOutside;

    // Add to document body with fixed positioning
    document.body.appendChild(colorInput);

    // Add click listener after a short delay to avoid immediate close
    setTimeout(() => {
      document.addEventListener('click', closeOnClickOutside, true);
    }, 100);

    // Open the picker and focus it
    colorInput.focus();
    colorInput.click();
  }

  updateColorValue(line, newColor, attributeName) {
    const textarea = this.shadowRoot.getElementById('textarea');
    const lines = textarea.value.split('\n');

    // Replace color value on the specified line for the specific attribute
    const regex = new RegExp(`"${attributeName}"\\s*:\\s*"#[0-9a-fA-F]{6}"`);
    lines[line] = lines[line].replace(regex, `"${attributeName}": "${newColor}"`);

    textarea.value = lines.join('\n');
    this.updateHighlight();
    this.emitChange();
  }

  handleKeydownInCollapsedArea(e) {
    // Allow navigation keys
    const navigationKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Tab'];
    if (navigationKeys.includes(e.key)) return;

    // Allow copy/cut/paste (handled separately)
    if (e.ctrlKey || e.metaKey) return;

    const textarea = this.shadowRoot.getElementById('textarea');
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = textarea.value.substring(0, cursorPos);
    const currentLineNum = textBeforeCursor.split('\n').length - 1;
    const lines = textarea.value.split('\n');
    const currentLine = lines[currentLineNum];

    // Check if current line is collapsed (contains {...} or [...])
    if (currentLine && (currentLine.includes('{...}') || currentLine.includes('[...]'))) {
      e.preventDefault();
    }
  }

  handleCopyWithCollapsedContent(e) {
    const textarea = this.shadowRoot.getElementById('textarea');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end) return; // No selection

    const selectedText = textarea.value.substring(start, end);

    // Check if selection contains collapsed content
    if (!selectedText.includes('{...}') && !selectedText.includes('[...]')) {
      return; // No collapsed content, use default copy behavior
    }

    let expandedText;

    // If selecting all content, use expandAllCollapsed directly (more reliable)
    if (start === 0 && end === textarea.value.length) {
      expandedText = this.expandAllCollapsed(selectedText);
    } else {
      // For partial selection, expand using line-by-line matching
      expandedText = this.expandCollapsedMarkersInText(selectedText, start);
    }

    // Put expanded text in clipboard
    e.preventDefault();
    e.clipboardData.setData('text/plain', expandedText);
  }

  expandCollapsedMarkersInText(text, startPos) {
    const textarea = this.shadowRoot.getElementById('textarea');
    const beforeSelection = textarea.value.substring(0, startPos);
    const startLineNum = beforeSelection.split('\n').length - 1;
    const R = GeoJsonEditor.REGEX;

    const lines = text.split('\n');
    const expandedLines = [];

    lines.forEach((line, relativeLineNum) => {
      const absoluteLineNum = startLineNum + relativeLineNum;

      // Check if this line has a collapsed marker
      if (line.includes('{...}') || line.includes('[...]')) {
        const match = line.match(R.collapsedMarker);
        if (match) {
          const nodeKey = match[2]; // Extract nodeKey from the marker
          const exactKey = `${absoluteLineNum}-${nodeKey}`;

          // Try exact key match first
          if (this.collapsedData.has(exactKey)) {
            const collapsed = this.collapsedData.get(exactKey);
            expandedLines.push(collapsed.originalLine);
            expandedLines.push(...collapsed.content);
            return;
          }

          // Fallback: search by line number and nodeKey
          let found = false;
          for (const [key, collapsed] of this.collapsedData.entries()) {
            if (key.endsWith(`-${nodeKey}`)) {
              expandedLines.push(collapsed.originalLine);
              expandedLines.push(...collapsed.content);
              found = true;
              break;
            }
          }
          if (found) return;
        }

        // Fallback: search by line number only
        let found = false;
        this.collapsedData.forEach((collapsed, key) => {
          const collapsedLineNum = parseInt(key.split('-')[0]);
          if (collapsedLineNum === absoluteLineNum && !found) {
            expandedLines.push(collapsed.originalLine);
            expandedLines.push(...collapsed.content);
            found = true;
          }
        });
        if (!found) {
          expandedLines.push(line);
        }
      } else {
        expandedLines.push(line);
      }
    });

    return expandedLines.join('\n');
  }

  handleCutWithCollapsedContent(e) {
    // First copy with expanded content
    this.handleCopyWithCollapsedContent(e);

    // Then delete the selection normally
    const textarea = this.shadowRoot.getElementById('textarea');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start !== end) {
      const value = textarea.value;
      textarea.value = value.substring(0, start) + value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start;
      this.updateHighlight();
      this.updatePlaceholderVisibility();
      this.emitChange();
    }
  }

  emitChange() {
    const textarea = this.shadowRoot.getElementById('textarea');

    // Expand ALL collapsed nodes to get full content
    const editorContent = this.expandAllCollapsed(textarea.value);

    // Build complete value with prefix/suffix
    const prefix = this.prefix;
    const suffix = this.suffix;
    const fullValue = prefix + editorContent + suffix;

    // Try to parse
    try {
      let parsed = JSON.parse(fullValue);

      // Filter out hidden features before emitting
      parsed = this.filterHiddenFeatures(parsed);

      // Validate GeoJSON types
      const validationErrors = this.validateGeoJSON(parsed);

      if (validationErrors.length > 0) {
        // Emit error event for GeoJSON validation errors
        this.dispatchEvent(new CustomEvent('error', {
          detail: {
            timestamp: new Date().toISOString(),
            error: `GeoJSON validation: ${validationErrors.join('; ')}`,
            errors: validationErrors,
            content: editorContent
          },
          bubbles: true,
          composed: true
        }));
      } else {
        // Emit change event with parsed GeoJSON directly
        this.dispatchEvent(new CustomEvent('change', {
          detail: parsed,
          bubbles: true,
          composed: true
        }));
      }
    } catch (e) {
      // Emit error event for invalid JSON
      this.dispatchEvent(new CustomEvent('error', {
        detail: {
          timestamp: new Date().toISOString(),
          error: e.message,
          content: editorContent  // Raw content for debugging
        },
        bubbles: true,
        composed: true
      }));
    }
  }

  // Filter hidden features from parsed GeoJSON before emitting events
  filterHiddenFeatures(parsed) {
    if (!parsed || this.hiddenFeatures.size === 0) return parsed;

    if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
      // Filter features array
      const visibleFeatures = parsed.features.filter(feature => {
        const key = this.getFeatureKey(feature);
        return !this.hiddenFeatures.has(key);
      });
      return { ...parsed, features: visibleFeatures };
    } else if (parsed.type === 'Feature') {
      // Single feature - check if hidden
      const key = this.getFeatureKey(parsed);
      if (this.hiddenFeatures.has(key)) {
        // Return empty FeatureCollection when single feature is hidden
        return { type: 'FeatureCollection', features: [] };
      }
    }

    return parsed;
  }

  // ========== Feature Visibility Management ==========

  // Generate a unique key for a Feature to track visibility state
  getFeatureKey(feature) {
    if (!feature || typeof feature !== 'object') return null;

    // 1. Use GeoJSON id if present (most stable)
    if (feature.id !== undefined) return `id:${feature.id}`;

    // 2. Use properties.id if present
    if (feature.properties?.id !== undefined) return `prop:${feature.properties.id}`;

    // 3. Fallback: hash based on geometry type + first coordinates
    const geomType = feature.geometry?.type || 'null';
    const coords = JSON.stringify(feature.geometry?.coordinates || []).slice(0, 100);
    return `hash:${geomType}:${this.simpleHash(coords)}`;
  }

  // Simple hash function for string
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  // Toggle feature visibility
  toggleFeatureVisibility(featureKey) {
    if (this.hiddenFeatures.has(featureKey)) {
      this.hiddenFeatures.delete(featureKey);
    } else {
      this.hiddenFeatures.add(featureKey);
    }
    this.updateHighlight();
    this.updateGutter();
    this.emitChange();
  }

  // Parse JSON and extract feature ranges (line numbers for each Feature)
  updateFeatureRanges() {
    const textarea = this.shadowRoot.getElementById('textarea');
    if (!textarea) return;

    const text = textarea.value;
    this.featureRanges.clear();

    try {
      // Expand collapsed content for parsing (collapsed markers like [...] are not valid JSON)
      const expandedText = this.expandAllCollapsed(text);

      // Try to parse and find Features
      const prefix = this.prefix;
      const suffix = this.suffix;
      const fullValue = prefix + expandedText + suffix;
      const parsed = JSON.parse(fullValue);

      let features = [];
      if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
        features = parsed.features;
      } else if (parsed.type === 'Feature') {
        features = [parsed];
      }

      // Now find each feature's line range in the text
      const lines = text.split('\n');
      let featureIndex = 0;
      let braceDepth = 0;
      let inFeature = false;
      let featureStartLine = -1;
      let currentFeatureKey = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detect start of a Feature object (not FeatureCollection)
        // Use regex to match exact "Feature" value, not "FeatureCollection"
        const isFeatureTypeLine = /"type"\s*:\s*"Feature"/.test(line);
        if (!inFeature && isFeatureTypeLine) {
          // Find the opening brace for this Feature
          // Look backwards for the opening brace
          let startLine = i;
          for (let j = i; j >= 0; j--) {
            if (lines[j].includes('{')) {
              startLine = j;
              break;
            }
          }
          featureStartLine = startLine;
          inFeature = true;

          // Start braceDepth at 1 since we're inside the Feature's opening brace
          // Then count any additional braces from startLine to current line (ignoring strings)
          braceDepth = 1;
          for (let k = startLine; k <= i; k++) {
            const scanLine = lines[k];
            const counts = this._countBracketsOutsideStrings(scanLine, '{');
            if (k === startLine) {
              // Skip the first { we already counted
              braceDepth += (counts.open - 1) - counts.close;
            } else {
              braceDepth += counts.open - counts.close;
            }
          }

          // Get the feature key
          if (featureIndex < features.length) {
            currentFeatureKey = this.getFeatureKey(features[featureIndex]);
          }
        } else if (inFeature) {
          // Count braces (ignoring those in strings)
          const counts = this._countBracketsOutsideStrings(line, '{');
          braceDepth += counts.open - counts.close;

          // Feature ends when braceDepth returns to 0
          if (braceDepth <= 0) {
            if (currentFeatureKey) {
              this.featureRanges.set(currentFeatureKey, {
                startLine: featureStartLine,
                endLine: i,
                featureIndex: featureIndex
              });
            }
            featureIndex++;
            inFeature = false;
            currentFeatureKey = null;
          }
        }
      }
    } catch (e) {
      // Invalid JSON, can't extract feature ranges
    }
  }

  // Get hidden line ranges for highlighting
  getHiddenLineRanges() {
    const ranges = [];
    for (const [featureKey, range] of this.featureRanges) {
      if (this.hiddenFeatures.has(featureKey)) {
        ranges.push(range);
      }
    }
    return ranges;
  }

  // ========== GeoJSON Validation ==========

  // Validate GeoJSON structure and types
  // context: 'root' | 'geometry' | 'properties'
  validateGeoJSON(obj, path = '', context = 'root') {
    const errors = [];

    if (!obj || typeof obj !== 'object') {
      return errors;
    }

    // Check for invalid type values based on context
    if (context !== 'properties' && obj.type !== undefined) {
      const typeValue = obj.type;
      if (typeof typeValue === 'string') {
        if (context === 'geometry') {
          // In geometry: must be a geometry type
          if (!GeoJsonEditor.GEOJSON_TYPES_GEOMETRY.includes(typeValue)) {
            errors.push(`Invalid geometry type "${typeValue}" at ${path || 'root'} (expected: ${GeoJsonEditor.GEOJSON_TYPES_GEOMETRY.join(', ')})`);
          }
        } else {
          // At root or in features: must be Feature or FeatureCollection
          if (!GeoJsonEditor.GEOJSON_TYPES_FEATURE.includes(typeValue)) {
            errors.push(`Invalid type "${typeValue}" at ${path || 'root'} (expected: ${GeoJsonEditor.GEOJSON_TYPES_FEATURE.join(', ')})`);
          }
        }
      }
    }

    // Recursively validate nested objects
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        errors.push(...this.validateGeoJSON(item, `${path}[${index}]`, context));
      });
    } else {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          const newPath = path ? `${path}.${key}` : key;
          // Determine context for nested objects
          let newContext = context;
          if (key === 'properties') {
            newContext = 'properties';
          } else if (key === 'geometry' || key === 'geometries') {
            newContext = 'geometry';
          } else if (key === 'features') {
            newContext = 'root'; // features contains Feature objects
          }
          errors.push(...this.validateGeoJSON(value, newPath, newContext));
        }
      }
    }

    return errors;
  }

  // Helper: Count bracket depth change in a line, ignoring brackets inside strings
  // Returns {open: count, close: count} for the specified bracket type
  _countBracketsOutsideStrings(line, openBracket) {
    const closeBracket = openBracket === '{' ? '}' : ']';
    let openCount = 0;
    let closeCount = 0;
    let inString = false;
    let escape = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (char === '\\' && inString) {
        escape = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === openBracket) openCount++;
        if (char === closeBracket) closeCount++;
      }
    }

    return { open: openCount, close: closeCount };
  }

  // Helper: Check if bracket closes on same line (ignores brackets in strings)
  bracketClosesOnSameLine(line, openBracket) {
    const bracketPos = line.indexOf(openBracket);
    if (bracketPos === -1) return false;

    const restOfLine = line.substring(bracketPos + 1);
    const counts = this._countBracketsOutsideStrings(restOfLine, openBracket);

    // Depth starts at 1 (we're after the opening bracket)
    // If closes equal or exceed opens + 1, the bracket closes on this line
    return counts.close > counts.open;
  }

  // Helper: Find closing bracket line starting from startLine
  // Returns { endLine, content: string[] } or null if not found
  _findClosingBracket(lines, startLine, openBracket) {
    let depth = 1;
    const content = [];

    // Count remaining brackets on the start line (after the opening bracket)
    const startLineContent = lines[startLine];
    const bracketPos = startLineContent.indexOf(openBracket);
    if (bracketPos !== -1) {
      const restOfStartLine = startLineContent.substring(bracketPos + 1);
      const startCounts = this._countBracketsOutsideStrings(restOfStartLine, openBracket);
      depth += startCounts.open - startCounts.close;
      if (depth === 0) {
        return { endLine: startLine, content: [] };
      }
    }

    for (let i = startLine + 1; i < lines.length; i++) {
      const scanLine = lines[i];
      const counts = this._countBracketsOutsideStrings(scanLine, openBracket);
      depth += counts.open - counts.close;

      content.push(scanLine);

      if (depth === 0) {
        return { endLine: i, content };
      }
    }

    return null; // Not found (malformed JSON)
  }

  // Helper: Expand all collapsed markers and return expanded content
  expandAllCollapsed(content) {
    const R = GeoJsonEditor.REGEX;

    while (content.includes('{...}') || content.includes('[...]')) {
      const lines = content.split('\n');
      let expanded = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.includes('{...}') && !line.includes('[...]')) continue;

        const match = line.match(R.collapsedMarker);
        if (!match) continue;

        const nodeKey = match[2];
        const currentIndent = match[1].length;
        const exactKey = `${i}-${nodeKey}`;

        let foundKey = this.collapsedData.has(exactKey) ? exactKey : null;
        if (!foundKey) {
          for (const [key, data] of this.collapsedData.entries()) {
            if (data.nodeKey === nodeKey && data.indent === currentIndent) {
              foundKey = key;
              break;
            }
          }
        }

        if (foundKey) {
          const {originalLine, content: nodeContent} = this.collapsedData.get(foundKey);
          lines[i] = originalLine;
          lines.splice(i + 1, 0, ...nodeContent);
          expanded = true;
          break;
        }
      }

      if (!expanded) break;
      content = lines.join('\n');
    }
    return content;
  }

  // Helper: Format JSON content respecting prefix/suffix
  formatJSONContent(content) {
    const prefix = this.prefix;
    const suffix = this.suffix;
    const prefixEndsWithBracket = prefix.trimEnd().endsWith('[');
    const suffixStartsWithBracket = suffix.trimStart().startsWith(']');

    if (prefixEndsWithBracket && suffixStartsWithBracket) {
      const wrapped = '[' + content + ']';
      const parsed = JSON.parse(wrapped);
      const formatted = JSON.stringify(parsed, null, 2);
      const lines = formatted.split('\n');
      return lines.length > 2 ? lines.slice(1, -1).join('\n') : '';
    } else if (!prefix && !suffix) {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } else {
      const fullValue = prefix + content + suffix;
      JSON.parse(fullValue); // Validate only
      return content;
    }
  }

  autoFormatContentWithCursor() {
    const textarea = this.shadowRoot.getElementById('textarea');

    // Save cursor position
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = textarea.value.substring(0, cursorPos);
    const linesBeforeCursor = textBeforeCursor.split('\n');
    const cursorLine = linesBeforeCursor.length - 1;
    const cursorColumn = linesBeforeCursor[linesBeforeCursor.length - 1].length;

    // Save collapsed node details
    const collapsedNodes = Array.from(this.collapsedData.values()).map(data => ({
      nodeKey: data.nodeKey,
      indent: data.indent
    }));

    // Expand and format
    const content = this.expandAllCollapsed(textarea.value);

    try {
      const formattedContent = this.formatJSONContent(content);

      if (formattedContent !== content) {
        this.collapsedData.clear();
        textarea.value = formattedContent;

        if (collapsedNodes.length > 0) {
          this.reapplyCollapsed(collapsedNodes);
        }

        // Restore cursor position
        const newLines = textarea.value.split('\n');
        if (cursorLine < newLines.length) {
          const newColumn = Math.min(cursorColumn, newLines[cursorLine].length);
          let newPos = 0;
          for (let i = 0; i < cursorLine; i++) {
            newPos += newLines[i].length + 1;
          }
          newPos += newColumn;
          textarea.setSelectionRange(newPos, newPos);
        }
      }
    } catch (e) {
      // Invalid JSON, don't format
    }
  }

  reapplyCollapsed(collapsedNodes) {
    const textarea = this.shadowRoot.getElementById('textarea');
    const lines = textarea.value.split('\n');

    // Group collapsed nodes by nodeKey+indent and count occurrences
    const collapseMap = new Map();
    collapsedNodes.forEach(({nodeKey, indent}) => {
      const key = `${nodeKey}-${indent}`;
      collapseMap.set(key, (collapseMap.get(key) || 0) + 1);
    });

    // Track occurrences as we iterate
    const occurrenceCount = new Map();

    // Iterate backwards to avoid index issues
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const match = line.match(/^(\s*)"(\w+)"\s*:\s*([{\[])/);

      if (match) {
        const nodeKey = match[2];
        const currentIndent = match[1].length;
        const key = `${nodeKey}-${currentIndent}`;

        if (collapseMap.has(key)) {
          // Count this occurrence
          occurrenceCount.set(key, (occurrenceCount.get(key) || 0) + 1);
          const currentOccurrence = occurrenceCount.get(key);

          // Only collapse if this occurrence should be collapsed
          if (currentOccurrence <= collapseMap.get(key)) {
            const indent = match[1];
            const openBracket = match[3];
            const closeBracket = openBracket === '{' ? '}' : ']';

            // Skip if closes on same line
            if (this.bracketClosesOnSameLine(line, openBracket)) continue;

            // Find closing bracket using helper (handles brackets in strings correctly)
            const result = this._findClosingBracket(lines, i, openBracket);
            if (!result) continue;

            const { endLine, content } = result;

            // Store with unique key
            const uniqueKey = `${i}-${nodeKey}`;
            this.collapsedData.set(uniqueKey, {
              originalLine: line,
              content: content,
              indent: indent.length,
              nodeKey: nodeKey
            });

            // Replace with marker
            const beforeBracket = line.substring(0, line.indexOf(openBracket));
            const hasTrailingComma = lines[endLine] && lines[endLine].trim().endsWith(',');
            lines[i] = `${beforeBracket}${openBracket}...${closeBracket}${hasTrailingComma ? ',' : ''}`;

            // Remove content lines
            lines.splice(i + 1, endLine - i);
          }
        }
      }
    }

    textarea.value = lines.join('\n');
  }


  // Parse selector and generate CSS rule for dark theme
  parseSelectorToHostRule(selector) {
    if (!selector || selector === '') {
      // Fallback: use data attribute on host element
      return ':host([data-color-scheme="dark"])';
    }

    // Check if it's a simple class on host (.dark)
    if (selector.startsWith('.') && !selector.includes(' ')) {
      return `:host(${selector})`;
    }

    // Complex selector - use :host-context for parent elements
    return `:host-context(${selector})`;
  }

  // Generate and inject theme CSS based on dark selector
  updateThemeCSS() {
    const darkSelector = this.getAttribute('dark-selector') || '.dark';

    // Parse selector to create CSS rule for dark theme
    const darkRule = this.parseSelectorToHostRule(darkSelector);
    // Light theme is the default (no selector = light)
    const lightRule = ':host';

    // Find or create theme style element
    let themeStyle = this.shadowRoot.getElementById('theme-styles');
    if (!themeStyle) {
      themeStyle = document.createElement('style');
      themeStyle.id = 'theme-styles';
      // Insert at the beginning of shadow root to ensure it's before static styles
      this.shadowRoot.insertBefore(themeStyle, this.shadowRoot.firstChild);
    }

    // Generate CSS with theme variables (light first as default, then dark overrides)
    const css = `
      ${lightRule} {
        --bg-color: ${this.themes.light.background};
        --text-color: ${this.themes.light.textColor};
        --caret-color: ${this.themes.light.caretColor};
        --gutter-bg: ${this.themes.light.gutterBackground};
        --gutter-border: ${this.themes.light.gutterBorder};
        --json-key: ${this.themes.light.jsonKey};
        --json-string: ${this.themes.light.jsonString};
        --json-number: ${this.themes.light.jsonNumber};
        --json-boolean: ${this.themes.light.jsonBoolean};
        --json-null: ${this.themes.light.jsonNull};
        --json-punct: ${this.themes.light.jsonPunctuation};
        --control-color: ${this.themes.light.controlColor};
        --control-bg: ${this.themes.light.controlBg};
        --control-border: ${this.themes.light.controlBorder};
        --geojson-key: ${this.themes.light.geojsonKey};
        --geojson-type: ${this.themes.light.geojsonType};
        --geojson-type-invalid: ${this.themes.light.geojsonTypeInvalid};
        --json-key-invalid: ${this.themes.light.jsonKeyInvalid};
      }

      ${darkRule} {
        --bg-color: ${this.themes.dark.background};
        --text-color: ${this.themes.dark.textColor};
        --caret-color: ${this.themes.dark.caretColor};
        --gutter-bg: ${this.themes.dark.gutterBackground};
        --gutter-border: ${this.themes.dark.gutterBorder};
        --json-key: ${this.themes.dark.jsonKey};
        --json-string: ${this.themes.dark.jsonString};
        --json-number: ${this.themes.dark.jsonNumber};
        --json-boolean: ${this.themes.dark.jsonBoolean};
        --json-null: ${this.themes.dark.jsonNull};
        --json-punct: ${this.themes.dark.jsonPunctuation};
        --control-color: ${this.themes.dark.controlColor};
        --control-bg: ${this.themes.dark.controlBg};
        --control-border: ${this.themes.dark.controlBorder};
        --geojson-key: ${this.themes.dark.geojsonKey};
        --geojson-type: ${this.themes.dark.geojsonType};
        --geojson-type-invalid: ${this.themes.dark.geojsonTypeInvalid};
        --json-key-invalid: ${this.themes.dark.jsonKeyInvalid};
      }
    `;

    themeStyle.textContent = css;
  }

  // Public API: Theme management
  getTheme() {
    return {
      dark: { ...this.themes.dark },
      light: { ...this.themes.light }
    };
  }

  setTheme(theme) {
    if (theme.dark) {
      this.themes.dark = { ...this.themes.dark, ...theme.dark };
    }
    if (theme.light) {
      this.themes.light = { ...this.themes.light, ...theme.light };
    }

    // Regenerate CSS with new theme values
    this.updateThemeCSS();
  }

  resetTheme() {
    // Reset to defaults
    this.themes = {
      dark: { ...GeoJsonEditor.DEFAULT_THEMES.dark },
      light: { ...GeoJsonEditor.DEFAULT_THEMES.light }
    };
    this.updateThemeCSS();
  }

  // ========================================
  // Features API - Programmatic manipulation
  // ========================================

  /**
   * Normalize a Python-style index (supports negative values)
   * @param {number} index - Index to normalize (negative = from end)
   * @param {number} length - Length of the array
   * @param {boolean} clamp - If true, clamp to valid range; if false, return -1 for out of bounds
   * @returns {number} Normalized index, or -1 if out of bounds (when clamp=false)
   * @private
   */
  _normalizeIndex(index, length, clamp = false) {
    let idx = index;
    if (idx < 0) {
      idx = length + idx;
    }
    if (clamp) {
      return Math.max(0, Math.min(idx, length));
    }
    return (idx < 0 || idx >= length) ? -1 : idx;
  }

  /**
   * Parse current textarea content into an array of features
   * @returns {Array} Array of feature objects
   * @private
   */
  _parseFeatures() {
    const textarea = this.shadowRoot.getElementById('textarea');
    if (!textarea || !textarea.value.trim()) {
      return [];
    }

    try {
      // Expand collapsed nodes to get full content
      const content = this.expandAllCollapsed(textarea.value);
      // Wrap in array brackets and parse
      const wrapped = '[' + content + ']';
      return JSON.parse(wrapped);
    } catch (e) {
      return [];
    }
  }

  /**
   * Update textarea with features array and trigger all updates
   * @param {Array} features - Array of feature objects
   * @private
   */
  _setFeatures(features) {
    const textarea = this.shadowRoot.getElementById('textarea');
    if (!textarea) return;

    // Clear internal state when replacing features (prevent memory leaks)
    this.collapsedData.clear();
    this.hiddenFeatures.clear();

    if (!features || features.length === 0) {
      textarea.value = '';
    } else {
      // Format each feature and join with comma
      const formatted = features
        .map(f => JSON.stringify(f, null, 2))
        .join(',\n');

      textarea.value = formatted;
    }

    // Trigger all updates
    this.updateHighlight();
    this.updatePlaceholderVisibility();

    // Auto-collapse coordinates
    if (textarea.value) {
      requestAnimationFrame(() => {
        this.applyAutoCollapsed();
      });
    }

    // Emit change event
    this.emitChange();
  }

  /**
   * Validate a single feature object
   * @param {Object} feature - Feature object to validate
   * @returns {string[]} Array of validation error messages (empty if valid)
   * @private
   */
  _validateFeature(feature) {
    const errors = [];

    if (!feature || typeof feature !== 'object') {
      errors.push('Feature must be an object');
      return errors;
    }

    if (Array.isArray(feature)) {
      errors.push('Feature cannot be an array');
      return errors;
    }

    // Check required type field
    if (!('type' in feature)) {
      errors.push('Feature must have a "type" property');
    } else if (feature.type !== 'Feature') {
      errors.push(`Feature type must be "Feature", got "${feature.type}"`);
    }

    // Check geometry field exists (can be null for features without location)
    if (!('geometry' in feature)) {
      errors.push('Feature must have a "geometry" property (can be null)');
    } else if (feature.geometry !== null) {
      // Validate geometry if not null
      if (typeof feature.geometry !== 'object' || Array.isArray(feature.geometry)) {
        errors.push('Feature geometry must be an object or null');
      } else {
        // Check geometry has valid type
        if (!('type' in feature.geometry)) {
          errors.push('Geometry must have a "type" property');
        } else if (!GeoJsonEditor.GEOJSON_TYPES_GEOMETRY.includes(feature.geometry.type)) {
          errors.push(`Invalid geometry type "${feature.geometry.type}" (expected: ${GeoJsonEditor.GEOJSON_TYPES_GEOMETRY.join(', ')})`);
        }

        // Check geometry has coordinates (except GeometryCollection)
        if (feature.geometry.type !== 'GeometryCollection' && !('coordinates' in feature.geometry)) {
          errors.push('Geometry must have a "coordinates" property');
        }

        // GeometryCollection must have geometries array
        if (feature.geometry.type === 'GeometryCollection' && !Array.isArray(feature.geometry.geometries)) {
          errors.push('GeometryCollection must have a "geometries" array');
        }
      }
    }

    // Check properties field exists (can be null)
    if (!('properties' in feature)) {
      errors.push('Feature must have a "properties" property (can be null)');
    } else if (feature.properties !== null && (typeof feature.properties !== 'object' || Array.isArray(feature.properties))) {
      errors.push('Feature properties must be an object or null');
    }

    return errors;
  }

  /**
   * Replace all features with the given array
   * @param {Array} features - Array of feature objects to set
   * @throws {Error} If features is not an array or contains invalid features
   */
  set(features) {
    if (!Array.isArray(features)) {
      throw new Error('set() expects an array of features');
    }

    // Validate each feature
    const allErrors = [];
    features.forEach((feature, index) => {
      const errors = this._validateFeature(feature);
      if (errors.length > 0) {
        allErrors.push(`Feature[${index}]: ${errors.join(', ')}`);
      }
    });

    if (allErrors.length > 0) {
      throw new Error(`Invalid features: ${allErrors.join('; ')}`);
    }

    this._setFeatures(features);
  }

  /**
   * Add a feature at the end of the list
   * @param {Object} feature - Feature object to add
   * @throws {Error} If feature is invalid
   */
  add(feature) {
    const errors = this._validateFeature(feature);
    if (errors.length > 0) {
      throw new Error(`Invalid feature: ${errors.join(', ')}`);
    }

    const features = this._parseFeatures();
    features.push(feature);
    this._setFeatures(features);
  }

  /**
   * Insert a feature at the specified index
   * @param {Object} feature - Feature object to insert
   * @param {number} index - Index to insert at (negative = from end)
   * @throws {Error} If feature is invalid
   */
  insertAt(feature, index) {
    const errors = this._validateFeature(feature);
    if (errors.length > 0) {
      throw new Error(`Invalid feature: ${errors.join(', ')}`);
    }

    const features = this._parseFeatures();
    const idx = this._normalizeIndex(index, features.length, true);

    features.splice(idx, 0, feature);
    this._setFeatures(features);
  }

  /**
   * Remove the feature at the specified index
   * @param {number} index - Index to remove (negative = from end)
   * @returns {Object|undefined} The removed feature, or undefined if index out of bounds
   */
  removeAt(index) {
    const features = this._parseFeatures();
    if (features.length === 0) return undefined;

    const idx = this._normalizeIndex(index, features.length);
    if (idx === -1) return undefined;

    const removed = features.splice(idx, 1)[0];
    this._setFeatures(features);
    return removed;
  }

  /**
   * Remove all features
   * @returns {Array} Array of removed features
   */
  removeAll() {
    const removed = this._parseFeatures();
    this._setFeatures([]);
    return removed;
  }

  /**
   * Get the feature at the specified index
   * @param {number} index - Index to get (negative = from end)
   * @returns {Object|undefined} The feature, or undefined if index out of bounds
   */
  get(index) {
    const features = this._parseFeatures();
    if (features.length === 0) return undefined;

    const idx = this._normalizeIndex(index, features.length);
    if (idx === -1) return undefined;

    return features[idx];
  }

  /**
   * Get all features as an array
   * @returns {Array} Array of all feature objects
   */
  getAll() {
    return this._parseFeatures();
  }

  /**
   * Emit the current document on the change event
   */
  emit() {
    this.emitChange();
  }
}

// Register the custom element
customElements.define('geojson-editor', GeoJsonEditor);
