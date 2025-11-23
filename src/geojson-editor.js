/**
 * GeoJSON Editor Web Component
 * Features:
 * - Syntax highlighting for JSON
 * - Collapsible nodes with [-]/[+] buttons
 * - Color picker in left gutter
 * - Support for array and JSON modes
 */
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

    // MutationObserver for theme detection
    this.themeObserver = null;

    // Default themes
    this.themes = {
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
        collapseButton: '#c586c0',
        collapseButtonBg: '#3e3e42',
        collapseButtonBorder: '#555'
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
        collapseButton: '#a31515',
        collapseButtonBg: '#e0e0e0',
        collapseButtonBorder: '#999'
      }
    };

    // Current theme
    this.currentTheme = { ...this.themes.dark };
  }

  static get observedAttributes() {
    return ['readonly', 'collapsable', 'collapsed', 'color-attributes', 'value', 'placeholder', 'color-scheme', 'auto-format', 'dark-selector', 'light-selector', 'prefix', 'suffix'];
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();

    // Update prefix/suffix display
    this.updatePrefixSuffix();

    // Setup theme detection
    this.setupThemeDetection();

    // Initial highlight
    if (this.value) {
      this.updateHighlight();
      // Apply default collapsed nodes after initial rendering
      if (this.defaultCollapsed.length > 0) {
        requestAnimationFrame(() => {
          this.applyDefaultCollapsed();
        });
      }
    }
  }

  disconnectedCallback() {
    // Cleanup observer
    if (this.themeObserver) {
      this.themeObserver.disconnect();
      this.themeObserver = null;
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    if (name === 'value') {
      this.updateValue(newValue);
    } else if (name === 'readonly') {
      this.updateReadonly();
    } else if (name === 'placeholder') {
      const textarea = this.shadowRoot.querySelector('textarea');
      if (textarea) textarea.placeholder = newValue || '';
    } else if (name === 'color-scheme') {
      this.applyColorScheme(newValue || 'dark');
    } else if (name === 'dark-selector' || name === 'light-selector') {
      this.setupThemeDetection();
    } else if (name === 'prefix' || name === 'suffix') {
      this.updatePrefixSuffix();
    } else if (name === 'collapsable') {
      // Re-render collapse buttons when collapsable list changes
      const textarea = this.shadowRoot?.getElementById('textarea');
      if (textarea && textarea.value) {
        // First expand nodes that are no longer collapsable
        this.expandNodesNotInCollapsable();
        // Then update the highlight to refresh button visibility
        this.updateHighlight();
      }
    } else if (name === 'color-attributes') {
      // Re-render color indicators when color attribute list changes
      const textarea = this.shadowRoot?.getElementById('textarea');
      if (textarea && textarea.value) {
        this.updateHighlight();
      }
    } else if (name === 'collapsed') {
      // Only apply if textarea exists (component is initialized)
      const textarea = this.shadowRoot?.getElementById('textarea');
      if (textarea && textarea.value) {
        // First expand nodes that are no longer in collapsed list
        this.expandNodesNotInCollapsed();
        // Then apply new collapsed nodes
        this.applyDefaultCollapsed();
      }
    }
  }

  // Properties
  get readonly() {
    return this.hasAttribute('readonly');
  }

  get collapsableNodes() {
    const attr = this.getAttribute('collapsable');
    if (!attr) return null; // null = all nodes collapsable
    try {
      const parsed = JSON.parse(attr);
      // Only accept arrays, treat everything else as "all collapsable"
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  get defaultCollapsed() {
    const attr = this.getAttribute('collapsed');
    if (!attr) return [];
    try {
      return JSON.parse(attr);
    } catch {
      return [];
    }
  }

  get colorAttributeNames() {
    const attr = this.getAttribute('color-attributes');
    if (!attr) return ['color']; // Default: only "color" attribute
    try {
      const parsed = JSON.parse(attr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
      return ['color'];
    } catch {
      return ['color'];
    }
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

  get prefix() {
    return this.getAttribute('prefix') || '';
  }

  get suffix() {
    return this.getAttribute('suffix') || '';
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

        .editor-wrapper {
          position: relative;
          width: 100%;
          flex: 1;
          background: var(--bg-color, #1e1e1e);
          display: flex;
          font-family: 'Courier New', Courier, monospace;
          font-size: 13px;
          line-height: 1.5;
        }

        .gutter {
          width: 24px;
          height: 100%;
          background: var(--gutter-bg, #252526);
          border-right: 1px solid var(--gutter-border, #3e3e42);
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
          background: var(--collapse-btn-bg, #3e3e42);
          border: 1px solid var(--collapse-btn-border, #555);
          border-radius: 2px;
          color: var(--collapse-btn, #c586c0);
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
          background: var(--collapse-btn-bg, #4e4e4e);
          border-color: var(--collapse-btn, #c586c0);
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
          color: var(--text-color, #d4d4d4);
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
          caret-color: var(--caret-color, #fff);
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
          color: #6a6a6a;
          font-family: 'Courier New', Courier, monospace;
          font-size: 13px;
          font-weight: normal;
          font-style: normal;
          opacity: 1;
        }

        textarea:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        /* Syntax highlighting colors */
        .json-key {
          color: var(--json-key, #9cdcfe);
        }

        .json-string {
          color: var(--json-string, #ce9178);
        }

        .json-number {
          color: var(--json-number, #b5cea8);
        }

        .json-boolean {
          color: var(--json-boolean, #569cd6);
        }

        .json-null {
          color: var(--json-null, #569cd6);
        }

        .json-punctuation {
          color: var(--json-punct, #d4d4d4);
        }

        /* Prefix and suffix styling */
        .editor-prefix,
        .editor-suffix {
          padding: 4px 12px;
          color: var(--text-color, #d4d4d4);
          background: var(--bg-color, #1e1e1e);
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

        /* Scrollbar styling */
        textarea::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }

        textarea::-webkit-scrollbar-track {
          background: #1e1e1e;
        }

        textarea::-webkit-scrollbar-thumb {
          background: #424242;
          border-radius: 5px;
        }

        textarea::-webkit-scrollbar-thumb:hover {
          background: #4e4e4e;
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
          <div class="highlight-layer" id="highlightLayer"></div>
          <textarea
            id="textarea"
            spellcheck="false"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            placeholder="${this.placeholder}"
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

    // Input handling with debounced highlight
    textarea.addEventListener('input', () => {
      clearTimeout(this.highlightTimer);
      this.highlightTimer = setTimeout(() => {
        this.updateHighlight();
        this.emitChange();
      }, 150);
    });

    // Auto-format on blur (when user leaves the field)
    textarea.addEventListener('blur', () => {
      if (this.autoFormat) {
        this.autoFormatContent();
      }
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

      // Apply default collapsed nodes after value is set
      if (this.defaultCollapsed.length > 0 && textarea.value) {
        requestAnimationFrame(() => {
          this.applyDefaultCollapsed();
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

    lines.forEach((line, lineIndex) => {
      // Detect color properties for all configured attributes
      const colorAttrNames = this.colorAttributeNames;
      colorAttrNames.forEach(attrName => {
        const regex = new RegExp(`"${attrName}"\\s*:\\s*"(#[0-9a-fA-F]{6})"`);
        const colorMatch = line.match(regex);
        if (colorMatch) {
          colors.push({
            line: lineIndex,
            color: colorMatch[1],
            attributeName: attrName
          });
        }
      });

      // Detect collapsible nodes
      const nodeMatch = line.match(/^(\s*)"(\w+)"\s*:\s*([{\[])/);
      if (nodeMatch) {
        const nodeKey = nodeMatch[2];
        const collapsableList = this.collapsableNodes;
        const isCollapsable = collapsableList === null || collapsableList.includes(nodeKey);

        if (isCollapsable) {
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
            // Not collapsed - check if it closes on same line
            const openBracket = nodeMatch[3];
            const closeBracket = openBracket === '{' ? '}' : ']';
            const bracketPos = line.indexOf(openBracket);
            const restOfLine = line.substring(bracketPos + 1);
            let depth = 1;
            let closesOnSameLine = false;

            for (const char of restOfLine) {
              if (char === openBracket) depth++;
              if (char === closeBracket) depth--;
              if (depth === 0) {
                closesOnSameLine = true;
                break;
              }
            }

            // Only add toggle button if it doesn't close on same line
            if (!closesOnSameLine) {
              toggles.push({
                line: lineIndex,
                nodeKey,
                isCollapsed: false
              });
            }
          }
        }
      }

      // Highlight the line
      highlightedLines.push(this.highlightLine(line));
    });

    return {
      highlighted: highlightedLines.join('\n'),
      colors,
      toggles
    };
  }

  highlightLine(line) {
    // Just highlight syntax, no buttons in the text
    return this.highlightSyntax(line);
  }

  highlightSyntax(text) {
    if (!text.trim()) return '';

    return text
      // Escape HTML first
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Highlight JSON elements (same order as map-viewer.js)
      .replace(/"([^"]+)"\s*:/g, '<span class="json-key">"$1"</span>:') // Keys
      .replace(/:\s*"([^"]*)"/g, ': <span class="json-string">"$1"</span>') // String values
      .replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="json-number">$1</span>') // Numbers after colon
      .replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>') // Booleans
      .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>') // Null
      // Highlight standalone numbers (including in arrays)
      .replace(/\b(-?\d+\.?\d*)\b/g, '<span class="json-number">$1</span>') // All numbers
      .replace(/([{}[\],])/g, '<span class="json-punctuation">$1</span>'); // Punctuation (last!)
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

      // Check if bracket closes on same line (not collapsable)
      const bracketPos = currentLine.indexOf(openBracket);
      const restOfLine = currentLine.substring(bracketPos + 1);
      let depth = 1;

      for (const char of restOfLine) {
        if (char === openBracket) depth++;
        if (char === closeBracket) depth--;
        if (depth === 0) {
          // Closes on same line - not collapsable
          return;
        }
      }

      // Find closing bracket in following lines
      depth = 1;
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

  expandNodesNotInCollapsable() {
    const textarea = this.shadowRoot.getElementById('textarea');
    if (!textarea || !textarea.value) return;

    const collapsableList = this.collapsableNodes;
    const lines = textarea.value.split('\n');
    let modified = false;

    // Check all collapsed nodes
    for (const [key, data] of this.collapsedData.entries()) {
      const nodeKey = data.nodeKey;

      // If this nodeKey is no longer in the collapsable list, expand it
      if (collapsableList !== null && !collapsableList.includes(nodeKey)) {
        // Find the line with the marker
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const hasMarker = line.includes('{...}') || line.includes('[...]');

          if (hasMarker) {
            // Check if this is the right node by matching indent and position
            const currentIndent = line.match(/^(\s*)/)[1].length;
            if (currentIndent === data.indent && line.includes(`"${nodeKey}"`)) {
              // Expand this node
              // Restore original line
              lines[i] = data.originalLine;

              // Insert content lines
              lines.splice(i + 1, 0, ...data.content);

              // Remove from collapsedData
              this.collapsedData.delete(key);
              modified = true;
              break;
            }
          }
        }
      }
    }

    if (modified) {
      textarea.value = lines.join('\n');
      this.updateHighlight();
    }
  }

  expandNodesNotInCollapsed() {
    const textarea = this.shadowRoot.getElementById('textarea');
    if (!textarea || !textarea.value) return;

    const defaultCollapsed = this.defaultCollapsed;
    const lines = textarea.value.split('\n');
    let modified = false;

    // Check all collapsed nodes
    for (const [key, data] of this.collapsedData.entries()) {
      const nodeKey = data.nodeKey;

      // If this nodeKey is no longer in the collapsed list, expand it
      if (!defaultCollapsed.includes(nodeKey)) {
        // Find the line with the marker
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const hasMarker = line.includes('{...}') || line.includes('[...]');

          if (hasMarker) {
            // Check if this is the right node by matching indent and position
            const currentIndent = line.match(/^(\s*)/)[1].length;
            if (currentIndent === data.indent && line.includes(`"${nodeKey}"`)) {
              // Expand this node
              // Restore original line
              lines[i] = data.originalLine;

              // Insert content lines
              lines.splice(i + 1, 0, ...data.content);

              // Remove from collapsedData
              this.collapsedData.delete(key);
              modified = true;
              break;
            }
          }
        }
      }
    }

    if (modified) {
      textarea.value = lines.join('\n');
      this.updateHighlight();
    }
  }

  applyDefaultCollapsed() {
    const textarea = this.shadowRoot.getElementById('textarea');
    if (!textarea || !textarea.value) return;

    const defaultCollapsed = this.defaultCollapsed;
    if (defaultCollapsed.length === 0) return;

    const lines = textarea.value.split('\n');

    // Iterate backwards to avoid index issues when collapsing
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const match = line.match(/^(\s*)"(\w+)"\s*:\s*([{\[])/);

      if (match) {
        const nodeKey = match[2];

        // Check if this node should be collapsed by default
        if (defaultCollapsed.includes(nodeKey)) {
          const indent = match[1];
          const openBracket = match[3];
          const closeBracket = openBracket === '{' ? '}' : ']';

          // Check if bracket closes on same line (skip if so)
          const bracketPos = line.indexOf(openBracket);
          const restOfLine = line.substring(bracketPos + 1);
          let checkDepth = 1;
          let closesOnSameLine = false;

          for (const char of restOfLine) {
            if (char === openBracket) checkDepth++;
            if (char === closeBracket) checkDepth--;
            if (checkDepth === 0) {
              closesOnSameLine = true;
              break;
            }
          }

          if (closesOnSameLine) {
            continue; // Skip this node, go to next line in main loop
          }

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

    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight);
    const paddingTop = parseFloat(getComputedStyle(textarea).paddingTop);

    // Clear gutter
    gutterContent.innerHTML = '';

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

    // Create gutter lines with both elements
    lineElements.forEach((elements, line) => {
      const gutterLine = document.createElement('div');
      gutterLine.className = 'gutter-line';
      // Position at line start - flexbox centers the content automatically
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

      gutterContent.appendChild(gutterLine);
    });
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

    colorInput.addEventListener('change', (e) => {
      this.updateColorValue(line, e.target.value, attributeName);
      colorInput.remove();
    });

    colorInput.addEventListener('blur', () => {
      setTimeout(() => colorInput.remove(), 100);
    });

    // Add to document body with fixed positioning
    document.body.appendChild(colorInput);
    setTimeout(() => colorInput.click(), 10);
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
        this.collapsedNodes.forEach((collapsed, key) => {
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
      this.emitChange();
    }
  }

  emitChange() {
    const textarea = this.shadowRoot.getElementById('textarea');

    // Expand ALL collapsed nodes to get full content
    let editorContent = textarea.value;

    // Keep expanding until no more markers found
    while (editorContent.includes('{...}') || editorContent.includes('[...]')) {
      const lines = editorContent.split('\n');
      let expanded = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.includes('{...}') || line.includes('[...]')) {
          // Find which node this is
          const match = line.match(/^(\s*)"(\w+)"\s*:\s*([{\[])\.\.\.([\]\}])/);
          if (match) {
            const nodeKey = match[2];
            const currentIndent = match[1].length;

            // Search for this nodeKey in collapsedData
            let foundKey = null;
            const exactKey = `${i}-${nodeKey}`;

            if (this.collapsedData.has(exactKey)) {
              foundKey = exactKey;
            } else {
              // Search by nodeKey + indent
              for (const [key, data] of this.collapsedData.entries()) {
                if (data.nodeKey === nodeKey && data.indent === currentIndent) {
                  foundKey = key;
                  break;
                }
              }
            }

            if (foundKey) {
              const {originalLine, content} = this.collapsedData.get(foundKey);

              // Restore
              lines[i] = originalLine;
              lines.splice(i + 1, 0, ...content);

              expanded = true;
              break; // Restart scan from beginning with new line numbers
            }
          }
        }
      }

      if (!expanded) {
        break; // No more to expand
      }

      editorContent = lines.join('\n');
    }

    // Build complete value with prefix/suffix
    const prefix = this.prefix;
    const suffix = this.suffix;
    const fullValue = prefix + editorContent + suffix;

    // Try to parse
    try {
      const parsed = JSON.parse(fullValue);

      // Emit change event with parsed object
      this.dispatchEvent(new CustomEvent('change', {
        detail: {
          timestamp: new Date().toISOString(),
          value: parsed  // Parsed JSON object
        },
        bubbles: true,
        composed: true
      }));
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

  autoFormatContent() {
    const textarea = this.shadowRoot.getElementById('textarea');

    // Expand all collapsed to get full content
    let content = textarea.value;

    // Save collapsed node details (nodeKey + indent) instead of just keys
    const collapsedNodes = Array.from(this.collapsedData.values()).map(data => ({
      nodeKey: data.nodeKey,
      indent: data.indent
    }));

    // Expand all markers
    while (content.includes('{...}') || content.includes('[...]')) {
      const lines = content.split('\n');
      let expanded = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.includes('{...}') || line.includes('[...]')) {
          const match = line.match(/^(\s*)"(\w+)"\s*:\s*([{\[])\.\.\.([\]\}])/);
          if (match) {
            const nodeKey = match[2];
            const currentIndent = match[1].length;

            // Search for this nodeKey in collapsedData
            let foundKey = null;
            const exactKey = `${i}-${nodeKey}`;

            if (this.collapsedData.has(exactKey)) {
              foundKey = exactKey;
            } else {
              // Search by nodeKey + indent
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
        }
      }

      if (!expanded) break;
      content = lines.join('\n');
    }

    // Try to parse and format (with prefix/suffix for validation)
    try {
      const prefix = this.prefix;
      const suffix = this.suffix;

      // Check if prefix ends with [ and suffix starts with ]
      const prefixEndsWithBracket = prefix.trimEnd().endsWith('[');
      const suffixStartsWithBracket = suffix.trimStart().startsWith(']');

      let formattedContent;

      if (prefixEndsWithBracket && suffixStartsWithBracket) {
        // Wrap content in array brackets for validation and formatting
        const wrapped = '[' + content + ']';
        const parsed = JSON.parse(wrapped);
        const formatted = JSON.stringify(parsed, null, 2);

        // Remove first [ and last ] from formatted
        const lines = formatted.split('\n');
        if (lines.length > 2) {
          // Remove first line "[" and last line "]"
          formattedContent = lines.slice(1, -1).join('\n');
        } else {
          // Empty array case
          formattedContent = '';
        }
      } else {
        // No prefix/suffix or different pattern - format as-is
        const fullValue = prefix + content + suffix;
        const parsed = JSON.parse(fullValue);
        const formatted = JSON.stringify(parsed, null, 2);

        // If no prefix/suffix, use formatted directly
        if (!prefix && !suffix) {
          formattedContent = formatted;
        } else {
          // Complex case - keep original content
          formattedContent = content;
        }
      }

      // Only update if different
      if (formattedContent !== content) {
        // Clear collapsed data
        this.collapsedData.clear();

        // Update textarea
        textarea.value = formattedContent;

        // Re-apply collapsed nodes
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

          // Check if closes on same line
          const bracketPos = line.indexOf(openBracket);
          const restOfLine = line.substring(bracketPos + 1);
          let checkDepth = 1;
          let closesOnSameLine = false;

          for (const char of restOfLine) {
            if (char === openBracket) checkDepth++;
            if (char === closeBracket) checkDepth--;
            if (checkDepth === 0) {
              closesOnSameLine = true;
              break;
            }
          }

          if (closesOnSameLine) {
            continue;
          }

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


  // Theme detection setup
  setupThemeDetection() {
    // Cleanup existing observer
    if (this.themeObserver) {
      this.themeObserver.disconnect();
      this.themeObserver = null;
    }

    const darkSelector = this.getAttribute('dark-selector');
    const lightSelector = this.getAttribute('light-selector');

    // If no selectors, use color-scheme attribute or default to dark
    if (!darkSelector && !lightSelector) {
      const scheme = this.getAttribute('color-scheme') || 'dark';
      this.applyColorScheme(scheme);
      return;
    }

    // Evaluate selectors and apply theme
    this.evaluateAndApplyTheme();

    // Setup MutationObserver to watch for changes
    const observedElements = new Set();

    // Parse selectors to find which elements to observe
    [darkSelector, lightSelector].forEach(selector => {
      if (!selector) return;
      const element = this.getElementFromSelector(selector);
      if (element) observedElements.add(element);
    });

    // Observe all relevant elements
    if (observedElements.size > 0) {
      this.themeObserver = new MutationObserver(() => {
        this.evaluateAndApplyTheme();
      });

      observedElements.forEach(element => {
        this.themeObserver.observe(element, {
          attributes: true,
          attributeOldValue: false
        });
      });
    }
  }

  evaluateAndApplyTheme() {
    const darkSelector = this.getAttribute('dark-selector');
    const lightSelector = this.getAttribute('light-selector');

    // Check dark first, then light, default to dark
    if (darkSelector && this.evaluateSelector(darkSelector)) {
      this.applyColorScheme('dark');
    } else if (lightSelector && this.evaluateSelector(lightSelector)) {
      this.applyColorScheme('light');
    } else {
      // Default to dark if neither matches
      this.applyColorScheme('dark');
    }
  }

  evaluateSelector(selector) {
    if (!selector) return false;

    // Parse selector: "element@attribute=value" or "element.class" or "@attribute=value"

    // Check for class syntax: "element.class"
    const classMatch = selector.match(/^([a-zA-Z]*)?\.([a-zA-Z0-9_-]+)$/);
    if (classMatch) {
      const elementName = classMatch[1] || null;
      const className = classMatch[2];
      const element = elementName ? document.querySelector(elementName) : this;
      return element && element.classList && element.classList.contains(className);
    }

    // Check for attribute syntax: "element@attribute=value" or "@attribute=value"
    const attrMatch = selector.match(/^([a-zA-Z]*)?@([a-zA-Z0-9_-]+)=(.+)$/);
    if (attrMatch) {
      const elementName = attrMatch[1] || null;
      const attributeName = attrMatch[2];
      const expectedValue = attrMatch[3];
      const element = elementName ? document.querySelector(elementName) : this;
      return element && element.getAttribute(attributeName) === expectedValue;
    }

    return false;
  }

  getElementFromSelector(selector) {
    if (!selector) return null;

    // Extract element name from selector
    const classMatch = selector.match(/^([a-zA-Z]+)\./);
    if (classMatch) {
      return document.querySelector(classMatch[1]);
    }

    const attrMatch = selector.match(/^([a-zA-Z]+)@/);
    if (attrMatch) {
      return document.querySelector(attrMatch[1]);
    }

    // If selector starts with @, it's self
    if (selector.startsWith('@')) {
      return this;
    }

    return null;
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

    // Reapply current color scheme
    const scheme = this.getAttribute('color-scheme') || 'dark';
    this.applyColorScheme(scheme);
  }

  resetTheme() {
    // Reset to defaults
    this.themes = {
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
        collapseButton: '#c586c0',
        collapseButtonBg: '#3e3e42',
        collapseButtonBorder: '#555'
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
        collapseButton: '#a31515',
        collapseButtonBg: '#e0e0e0',
        collapseButtonBorder: '#999'
      }
    };

    const scheme = this.getAttribute('color-scheme') || 'dark';
    this.applyColorScheme(scheme);
  }

  applyColorScheme(scheme) {
    const theme = this.themes[scheme] || this.themes.dark;
    this.currentTheme = { ...theme };

    // Update CSS variables on :host so they cascade to all children including prefix/suffix
    this.style.setProperty('--bg-color', theme.background);
    this.style.setProperty('--text-color', theme.textColor);
    this.style.setProperty('--caret-color', theme.caretColor);
    this.style.setProperty('--gutter-bg', theme.gutterBackground);
    this.style.setProperty('--gutter-border', theme.gutterBorder);
    this.style.setProperty('--json-key', theme.jsonKey);
    this.style.setProperty('--json-string', theme.jsonString);
    this.style.setProperty('--json-number', theme.jsonNumber);
    this.style.setProperty('--json-boolean', theme.jsonBoolean);
    this.style.setProperty('--json-null', theme.jsonNull);
    this.style.setProperty('--json-punct', theme.jsonPunctuation);
    this.style.setProperty('--collapse-btn', theme.collapseButton);
    this.style.setProperty('--collapse-btn-bg', theme.collapseButtonBg);
    this.style.setProperty('--collapse-btn-border', theme.collapseButtonBorder);
  }
}

// Register the custom element
customElements.define('geojson-editor', GeoJsonEditor);
