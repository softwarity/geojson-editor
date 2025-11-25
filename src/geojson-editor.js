class GeoJsonEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // Internal state
    this.collapsedData = new Map(); // nodeKey -> {originalLines: string[], indent: number}
    this.colorPositions = []; // {line, color}
    this.nodeTogglePositions = []; // {line, nodeKey, isCollapsed, indent}

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
    return ['readonly', 'value', 'placeholder', 'auto-format', 'dark-selector', 'feature-collection'];
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
    colorInLine: /"(\w+)"\s*:\s*"(#[0-9a-fA-F]{6})"/g,
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
    } else if (name === 'feature-collection') {
      this.updatePrefixSuffix();
    } else if (name === 'auto-format') {
      // When auto-format is enabled, format the current content
      const textarea = this.shadowRoot?.getElementById('textarea');
      if (textarea && textarea.value && this.autoFormat) {
        this.autoFormatContent();
        this.updateHighlight();
      }
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

  get autoFormat() {
    return this.hasAttribute('auto-format');
  }

  get featureCollection() {
    return this.hasAttribute('feature-collection');
  }

  // Internal getters for prefix/suffix based on feature-collection mode
  get prefix() {
    return this.featureCollection ? GeoJsonEditor.FEATURE_COLLECTION_PREFIX : '';
  }

  get suffix() {
    return this.featureCollection ? GeoJsonEditor.FEATURE_COLLECTION_SUFFIX : '';
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

        /* Prefix and suffix styling */
        .editor-prefix,
        .editor-suffix {
          padding: 4px 12px;
          color: var(--text-color);
          background: var(--bg-color);
          user-select: none;
          white-space: pre-wrap;
          word-wrap: break-word;
          flex-shrink: 0;
          font-family: 'Courier New', Courier, monospace;
          font-size: 13px;
          line-height: 1.5;
          opacity: 0.6;
          border-left: 3px solid rgba(102, 126, 234, 0.5);
        }

        .editor-prefix {
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .editor-suffix {
          border-top: 1px solid rgba(255, 255, 255, 0.1);
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
      <div class="editor-prefix" id="editorPrefix"></div>
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
      <div class="editor-suffix" id="editorSuffix"></div>
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
        // Auto-format if enabled and JSON is valid
        if (this.autoFormat) {
          this.autoFormatContentWithCursor();
        }
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
        // Auto-format if enabled and JSON is valid
        if (this.autoFormat) {
          this.autoFormatContentWithCursor();
        }
        this.updateHighlight();
        this.emitChange();
      }, 10);
    });

    // Gutter clicks (color indicators and collapse buttons)
    const gutterContent = this.shadowRoot.getElementById('gutterContent');
    gutterContent.addEventListener('click', (e) => {
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

      // Apply auto-format if enabled
      if (this.autoFormat && newValue) {
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
    }
  }

  updatePrefixSuffix() {
    const prefixEl = this.shadowRoot.getElementById('editorPrefix');
    const suffixEl = this.shadowRoot.getElementById('editorSuffix');

    if (prefixEl) {
      if (this.prefix) {
        prefixEl.textContent = this.prefix;
        prefixEl.style.display = 'block';
      } else {
        prefixEl.textContent = '';
        prefixEl.style.display = 'none';
      }
    }

    if (suffixEl) {
      if (this.suffix) {
        suffixEl.textContent = this.suffix;
        suffixEl.style.display = 'block';
      } else {
        suffixEl.textContent = '';
        suffixEl.style.display = 'none';
      }
    }
  }

  updateHighlight() {
    const textarea = this.shadowRoot.getElementById('textarea');
    const highlightLayer = this.shadowRoot.getElementById('highlightLayer');

    if (!textarea || !highlightLayer) return;

    const text = textarea.value;

    // Parse and highlight
    const { highlighted, colors, toggles } = this.highlightJSON(text);

    highlightLayer.innerHTML = highlighted;
    this.colorPositions = colors;
    this.nodeTogglePositions = toggles;

    // Update gutter with color indicators
    this.updateGutter();
  }

  highlightJSON(text) {
    if (!text.trim()) {
      return { highlighted: '', colors: [], toggles: [] };
    }

    const lines = text.split('\n');
    const colors = [];
    const toggles = [];
    let highlightedLines = [];

    // Build context map for validation
    const contextMap = this.buildContextMap(text);

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
      highlightedLines.push(this.highlightSyntax(line, context));
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

    // Determine root context based on feature-collection mode
    const rootContext = this.featureCollection ? 'Feature' : null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Record context at START of line (for key validation)
      const lineContext = contextStack.length > 0
        ? contextStack[contextStack.length - 1]?.context
        : rootContext;
      contextMap.set(i, lineContext);

      // Process each character to track brackets for subsequent lines
      for (let j = 0; j < line.length; j++) {
        const char = line[j];

        // Check for key that changes context: "keyName":
        if (char === '"') {
          const keyMatch = line.substring(j).match(/^"([^"]+)"\s*:/);
          if (keyMatch) {
            const keyName = keyMatch[1];
            if (GeoJsonEditor.CONTEXT_CHANGING_KEYS[keyName]) {
              pendingContext = GeoJsonEditor.CONTEXT_CHANGING_KEYS[keyName];
            }
            j += keyMatch[0].length - 1;  // Skip past the key
            continue;
          }
        }

        // Check for type value to refine context: "type": "Point"
        if (char === '"' && contextStack.length > 0) {
          const typeMatch = line.substring(0, j).match(/"type"\s*:\s*$/);
          if (typeMatch) {
            const valueMatch = line.substring(j).match(/^"([^"]+)"/);
            if (valueMatch && GeoJsonEditor.GEOJSON_TYPES_ALL.includes(valueMatch[1])) {
              // Update current context to the specific type
              const currentCtx = contextStack[contextStack.length - 1];
              if (currentCtx) {
                currentCtx.context = valueMatch[1];
              }
            }
          }
        }

        // Opening bracket - push context
        if (char === '{' || char === '[') {
          let newContext;
          if (pendingContext) {
            newContext = pendingContext;
            pendingContext = null;
          } else if (contextStack.length === 0) {
            // Root level
            newContext = rootContext;
          } else {
            // Inherit from parent if in array
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
      .replace(R.jsonKey, (match, key) => {
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
      .replace(R.typeValue, (match, typeValue) => {
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

      // Find closing bracket in following lines
      let depth = 1;
      let endLine = line;
      const content = [];

      for (let i = line + 1; i < lines.length; i++) {
        const scanLine = lines[i];

        for (const char of scanLine) {
          if (char === openBracket) depth++;
          if (char === closeBracket) depth--;
        }

        content.push(scanLine);

        if (depth === 0) {
          endLine = i;
          break;
        }
      }

      // Store the original data with unique key
      const uniqueKey = `${line}-${nodeKey}`;
      this.collapsedData.set(uniqueKey, {
        originalLine: currentLine,
        content: content,
        indent: indent.length,
        nodeKey: nodeKey  // Store nodeKey for later use
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

          // Find closing bracket in following lines
          let depth = 1;
          let endLine = i;
          const content = [];

          for (let j = i + 1; j < lines.length; j++) {
            const scanLine = lines[j];

            for (const char of scanLine) {
              if (char === openBracket) depth++;
              if (char === closeBracket) depth--;
            }

            content.push(scanLine);

            if (depth === 0) {
              endLine = j;
              break;
            }
          }

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

    // Create a map of line -> elements (color, collapse button, or both)
    const lineElements = new Map();

    // Add color indicators
    this.colorPositions.forEach(({ line, color, attributeName }) => {
      if (!lineElements.has(line)) {
        lineElements.set(line, { colors: [], buttons: [] });
      }
      lineElements.get(line).colors.push({ color, attributeName });
    });

    // Add collapse buttons
    this.nodeTogglePositions.forEach(({ line, nodeKey, isCollapsed }) => {
      if (!lineElements.has(line)) {
        lineElements.set(line, { colors: [], buttons: [] });
      }
      lineElements.get(line).buttons.push({ nodeKey, isCollapsed });
    });

    // Create gutter lines with DocumentFragment (single DOM update)
    const fragment = document.createDocumentFragment();

    lineElements.forEach((elements, line) => {
      const gutterLine = document.createElement('div');
      gutterLine.className = 'gutter-line';
      gutterLine.style.top = `${paddingTop + line * lineHeight}px`;

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
    // Remove existing picker
    const existing = document.querySelector('.geojson-color-picker-input');
    if (existing) existing.remove();

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
        colorInput.remove();
        document.removeEventListener('click', closeOnClickOutside, true);
      }
    };

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

    // Replace collapsed markers with real content
    const expandedText = this.expandCollapsedMarkersInText(selectedText, start);

    // Put expanded text in clipboard
    e.preventDefault();
    e.clipboardData.setData('text/plain', expandedText);
  }

  expandCollapsedMarkersInText(text, startPos) {
    const textarea = this.shadowRoot.getElementById('textarea');
    const beforeSelection = textarea.value.substring(0, startPos);
    const startLineNum = beforeSelection.split('\n').length - 1;

    const lines = text.split('\n');
    const expandedLines = [];

    lines.forEach((line, relativeLineNum) => {
      const absoluteLineNum = startLineNum + relativeLineNum;

      // Check if this line has a collapsed marker
      if (line.includes('{...}') || line.includes('[...]')) {
        // Find the collapsed node for this line
        let found = false;
        this.collapsedData.forEach((collapsed, key) => {
          const collapsedLineNum = parseInt(key.split('-')[0]);
          if (collapsedLineNum === absoluteLineNum) {
            // Replace with original line and all collapsed content
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
      const parsed = JSON.parse(fullValue);

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

  // Helper: Check if bracket closes on same line
  bracketClosesOnSameLine(line, openBracket) {
    const closeBracket = openBracket === '{' ? '}' : ']';
    const bracketPos = line.indexOf(openBracket);
    if (bracketPos === -1) return false;
    const restOfLine = line.substring(bracketPos + 1);
    let depth = 1;
    for (const char of restOfLine) {
      if (char === openBracket) depth++;
      if (char === closeBracket) depth--;
      if (depth === 0) return true;
    }
    return false;
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

  autoFormatContent() {
    const textarea = this.shadowRoot.getElementById('textarea');

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

          // Find closing bracket
          let depth = 1;
          let endLine = i;
          const content = [];

          for (let j = i + 1; j < lines.length; j++) {
            const scanLine = lines[j];

            for (const char of scanLine) {
              if (char === openBracket) depth++;
              if (char === closeBracket) depth--;
            }

            content.push(scanLine);

            if (depth === 0) {
              endLine = j;
              break;
            }
          }

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
}

// Register the custom element
customElements.define('geojson-editor', GeoJsonEditor);
