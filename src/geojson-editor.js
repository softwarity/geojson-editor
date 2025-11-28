import styles from './geojson-editor.css?inline';
import { getTemplate } from './geojson-editor.template.js';

// Version injected by Vite build from package.json
const VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'dev';

// GeoJSON constants
const GEOJSON_KEYS = ['type', 'geometry', 'properties', 'coordinates', 'id', 'features'];
const GEOMETRY_TYPES = ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'];

/**
 * GeoJSON Editor Web Component
 * Monaco-like architecture with virtualized line rendering
 */
class GeoJsonEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // ========== Model (Source of Truth) ==========
    this.lines = [];              // Array of line strings
    this.collapsedNodes = new Set(); // Set of unique node IDs that are collapsed
    this.hiddenFeatures = new Set(); // Set of feature keys hidden from events
    
    // ========== Node ID Management ==========
    this._nodeIdCounter = 0;      // Counter for generating unique node IDs
    this._lineToNodeId = new Map(); // lineIndex -> nodeId (for collapsible lines)
    this._nodeIdToLines = new Map(); // nodeId -> {startLine, endLine} (range of collapsed content)
    
    // ========== Derived State (computed from model) ==========
    this.visibleLines = [];       // Lines to render (after collapse filter)
    this.lineMetadata = new Map(); // lineIndex -> {colors, booleans, collapse, visibility, hidden, featureKey}
    this.featureRanges = new Map(); // featureKey -> {startLine, endLine, featureIndex}
    
    // ========== View State ==========
    this.scrollTop = 0;
    this.viewportHeight = 0;
    this.lineHeight = 19.5;       // CSS: line-height * font-size = 1.5 * 13px
    this.bufferLines = 5;         // Extra lines to render above/below viewport
    
    // ========== Render Cache ==========
    this._lastStartIndex = -1;
    this._lastEndIndex = -1;
    this._lastTotalLines = -1;
    this._scrollRaf = null;
    
    // ========== Cursor/Selection ==========
    this.cursorLine = 0;
    this.cursorColumn = 0;
    this.selectionStart = null;   // {line, column}
    this.selectionEnd = null;     // {line, column}
    
    // ========== Debounce ==========
    this.renderTimer = null;
    this.inputTimer = null;
    
    // ========== Theme ==========
    this.themes = { dark: {}, light: {} };
  }

  // ========== Unique ID Generation ==========
  _generateNodeId() {
    return `node_${++this._nodeIdCounter}`;
  }

  /**
   * Check if a line is inside a collapsed node (hidden lines between opening and closing)
   * @param {number} lineIndex - The line index to check
   * @returns {Object|null} - The collapsed range info or null
   */
  _getCollapsedRangeForLine(lineIndex) {
    for (const [nodeId, info] of this._nodeIdToLines) {
      // Lines strictly between opening and closing are hidden
      if (this.collapsedNodes.has(nodeId) && lineIndex > info.startLine && lineIndex < info.endLine) {
        return { nodeId, ...info };
      }
    }
    return null;
  }

  /**
   * Check if cursor is on the closing line of a collapsed node
   * @param {number} lineIndex - The line index to check
   * @returns {Object|null} - The collapsed range info or null
   */
  _getCollapsedClosingLine(lineIndex) {
    for (const [nodeId, info] of this._nodeIdToLines) {
      if (this.collapsedNodes.has(nodeId) && lineIndex === info.endLine) {
        return { nodeId, ...info };
      }
    }
    return null;
  }

  /**
   * Get the position of the closing bracket on a line
   * @param {string} line - The line content
   * @returns {number} - Position of bracket or -1
   */
  _getClosingBracketPos(line) {
    // Find the last ] or } on the line
    const lastBracket = Math.max(line.lastIndexOf(']'), line.lastIndexOf('}'));
    return lastBracket;
  }

  /**
   * Check if cursor is on the opening line of a collapsed node
   * @param {number} lineIndex - The line index to check  
   * @returns {Object|null} - The collapsed range info or null
   */
  _getCollapsedNodeAtLine(lineIndex) {
    const nodeId = this._lineToNodeId.get(lineIndex);
    if (nodeId && this.collapsedNodes.has(nodeId)) {
      const info = this._nodeIdToLines.get(nodeId);
      return { nodeId, ...info };
    }
    return null;
  }

  /**
   * Check if cursor is on a line that has a collapsible node (expanded or collapsed)
   * @param {number} lineIndex - The line index to check  
   * @returns {Object|null} - The node info with isCollapsed flag or null
   */
  _getCollapsibleNodeAtLine(lineIndex) {
    const nodeId = this._lineToNodeId.get(lineIndex);
    if (nodeId) {
      const info = this._nodeIdToLines.get(nodeId);
      const isCollapsed = this.collapsedNodes.has(nodeId);
      return { nodeId, isCollapsed, ...info };
    }
    return null;
  }

  /**
   * Find the innermost expanded node that contains the given line
   * Used for Shift+Tab to collapse the parent node from anywhere inside it
   * @param {number} lineIndex - The line index to check  
   * @returns {Object|null} - The containing node info or null
   */
  _getContainingExpandedNode(lineIndex) {
    let bestMatch = null;
    
    for (const [nodeId, info] of this._nodeIdToLines) {
      // Skip collapsed nodes
      if (this.collapsedNodes.has(nodeId)) continue;
      
      // Check if line is within this node's range
      if (lineIndex >= info.startLine && lineIndex <= info.endLine) {
        // Prefer the innermost (smallest) containing node
        if (!bestMatch || (info.endLine - info.startLine) < (bestMatch.endLine - bestMatch.startLine)) {
          bestMatch = { nodeId, ...info };
        }
      }
    }
    
    return bestMatch;
  }

  /**
   * Delete an entire collapsed node (opening line to closing line)
   * @param {Object} range - The range info {startLine, endLine}
   */
  _deleteCollapsedNode(range) {
    // Remove all lines from startLine to endLine
    const count = range.endLine - range.startLine + 1;
    this.lines.splice(range.startLine, count);
    
    // Position cursor at the line where the node was
    this.cursorLine = Math.min(range.startLine, this.lines.length - 1);
    this.cursorColumn = 0;
    
    this.formatAndUpdate();
  }

  /**
   * Rebuild nodeId mappings after content changes
   * Preserves collapsed state by matching nodeKey + sequential occurrence
   */
  _rebuildNodeIdMappings() {
    // Save old state to try to preserve collapsed nodes
    const oldCollapsed = new Set(this.collapsedNodes);
    const oldNodeKeyMap = new Map(); // nodeId -> nodeKey
    for (const [nodeId, info] of this._nodeIdToLines) {
      if (info.nodeKey) oldNodeKeyMap.set(nodeId, info.nodeKey);
    }
    
    // Build list of collapsed nodeKeys for matching
    const collapsedNodeKeys = [];
    for (const nodeId of oldCollapsed) {
      const nodeKey = oldNodeKeyMap.get(nodeId);
      if (nodeKey) collapsedNodeKeys.push(nodeKey);
    }
    
    // Reset mappings
    this._nodeIdCounter = 0;
    this._lineToNodeId.clear();
    this._nodeIdToLines.clear();
    this.collapsedNodes.clear();
    
    // Track occurrences of each nodeKey for matching
    const nodeKeyOccurrences = new Map();
    
    // Assign fresh IDs to all collapsible nodes
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      
      // Match "key": { or "key": [
      const kvMatch = line.match(/^\s*"([^"]+)"\s*:\s*([{\[])/);
      // Also match standalone { or {, (root Feature objects)
      const rootMatch = !kvMatch && line.match(/^\s*([{\[]),?\s*$/);
      
      if (!kvMatch && !rootMatch) continue;
      
      let nodeKey, openBracket;
      
      if (kvMatch) {
        nodeKey = kvMatch[1];
        openBracket = kvMatch[2];
      } else {
        // Root object - use special key based on line number and bracket type
        openBracket = rootMatch[1];
        nodeKey = `__root_${openBracket}_${i}`;
      }
      
      // Check if closes on same line
      const rest = line.substring(line.indexOf(openBracket) + 1);
      const counts = this._countBrackets(rest, openBracket);
      if (counts.close > counts.open) continue;
      
      const endLine = this._findClosingLine(i, openBracket);
      if (endLine === -1 || endLine === i) continue;
      
      // Generate unique ID for this node
      const nodeId = this._generateNodeId();
      
      this._lineToNodeId.set(i, nodeId);
      this._nodeIdToLines.set(nodeId, { startLine: i, endLine, nodeKey, isRootFeature: !!rootMatch });
      
      // Track occurrence of this nodeKey
      const occurrence = nodeKeyOccurrences.get(nodeKey) || 0;
      nodeKeyOccurrences.set(nodeKey, occurrence + 1);
      
      // Check if this nodeKey was previously collapsed
      const keyIndex = collapsedNodeKeys.indexOf(nodeKey);
      if (keyIndex !== -1) {
        // Remove from list so we don't match it again
        collapsedNodeKeys.splice(keyIndex, 1);
        this.collapsedNodes.add(nodeId);
      }
    }
  }

  // ========== Observed Attributes ==========
  static get observedAttributes() {
    return ['readonly', 'value', 'placeholder', 'dark-selector'];
  }

  // ========== Lifecycle ==========
  connectedCallback() {
    this.render();
    this.setupEventListeners();
    this.updatePrefixSuffix();
    this.updateThemeCSS();
    
    if (this.value) {
      this.setValue(this.value);
    }
    this.updatePlaceholderVisibility();
  }

  disconnectedCallback() {
    if (this.renderTimer) clearTimeout(this.renderTimer);
    if (this.inputTimer) clearTimeout(this.inputTimer);
    
    // Cleanup color picker
    const colorPicker = document.querySelector('.geojson-color-picker-input');
    if (colorPicker) {
      if (colorPicker._closeListener) {
        document.removeEventListener('click', colorPicker._closeListener, true);
      }
      colorPicker.remove();
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    switch (name) {
      case 'value':
        this.setValue(newValue);
        break;
      case 'readonly':
        this.updateReadonly();
        break;
      case 'placeholder':
        this.updatePlaceholderContent();
        break;
      case 'dark-selector':
        this.updateThemeCSS();
        break;
    }
  }

  // ========== Properties ==========
  get readonly() { return this.hasAttribute('readonly'); }
  get value() { return this.getAttribute('value') || ''; }
  get placeholder() { return this.getAttribute('placeholder') || ''; }
  get prefix() { return '{"type": "FeatureCollection", "features": ['; }
  get suffix() { return ']}'; }

  // ========== Initial Render ==========
  render() {
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    
    const template = document.createElement('div');
    template.innerHTML = getTemplate(this.placeholder, VERSION);
    
    this.shadowRoot.innerHTML = '';
    this.shadowRoot.appendChild(styleEl);
    while (template.firstChild) {
      this.shadowRoot.appendChild(template.firstChild);
    }
  }

  // ========== Event Listeners ==========
  setupEventListeners() {
    const hiddenTextarea = this.shadowRoot.getElementById('hiddenTextarea');
    const viewport = this.shadowRoot.getElementById('viewport');
    const gutterContent = this.shadowRoot.getElementById('gutterContent');
    const gutter = this.shadowRoot.querySelector('.gutter');
    const clearBtn = this.shadowRoot.getElementById('clearBtn');
    const editorWrapper = this.shadowRoot.querySelector('.editor-wrapper');

    // Mouse selection state
    this._isSelecting = false;

    // Focus hidden textarea when clicking viewport
    // Editor inline control clicks (color swatches, checkboxes, visibility icons)
    // Use capture phase to intercept before mousedown
    viewport.addEventListener('click', (e) => {
      this.handleEditorClick(e);
    }, true);

    viewport.addEventListener('mousedown', (e) => {
      // Skip if clicking on visibility pseudo-element (line-level)
      const lineEl = e.target.closest('.line.has-visibility');
      if (lineEl) {
        const rect = lineEl.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        if (clickX < 14) {
          // Block render until click is processed to prevent DOM destruction
          this._blockRender = true;
          return;
        }
      }

      // Skip if clicking on an inline control pseudo-element (positioned with negative left)
      if (e.target.classList.contains('json-color') ||
          e.target.classList.contains('json-boolean')) {
        const rect = e.target.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        // Pseudo-element is at left: -8px, so clickX will be negative when clicking on it
        if (clickX < 0 && clickX >= -8) {
          // Block render until click is processed to prevent DOM destruction
          this._blockRender = true;
          return;
        }
      }
      
      // Prevent default to avoid losing focus after click
      e.preventDefault();
      
      // Calculate click position
      const pos = this._getPositionFromClick(e);
      
      if (e.shiftKey && this.selectionStart) {
        // Shift+click: extend selection
        this.selectionEnd = pos;
        this.cursorLine = pos.line;
        this.cursorColumn = pos.column;
      } else {
        // Normal click: start new selection
        this.cursorLine = pos.line;
        this.cursorColumn = pos.column;
        this.selectionStart = { line: pos.line, column: pos.column };
        this.selectionEnd = null;
        this._isSelecting = true;
      }
      
      // Focus textarea
      hiddenTextarea.focus();
      this._lastStartIndex = -1;
      this.scheduleRender();
    });
    
    // Mouse move for drag selection
    viewport.addEventListener('mousemove', (e) => {
      if (!this._isSelecting) return;
      
      const pos = this._getPositionFromClick(e);
      this.selectionEnd = pos;
      this.cursorLine = pos.line;
      this.cursorColumn = pos.column;
      
      // Auto-scroll when near edges
      const rect = viewport.getBoundingClientRect();
      const scrollMargin = 30; // pixels from edge to start scrolling
      const scrollSpeed = 20; // pixels to scroll per frame
      
      if (e.clientY < rect.top + scrollMargin) {
        // Near top edge, scroll up
        viewport.scrollTop -= scrollSpeed;
      } else if (e.clientY > rect.bottom - scrollMargin) {
        // Near bottom edge, scroll down
        viewport.scrollTop += scrollSpeed;
      }
      
      this._lastStartIndex = -1;
      this.scheduleRender();
    });
    
    // Mouse up to end selection
    document.addEventListener('mouseup', () => {
      this._isSelecting = false;
    });

    // Focus/blur handling to show/hide cursor
    hiddenTextarea.addEventListener('focus', () => {
      editorWrapper.classList.add('focused');
      this._lastStartIndex = -1; // Force re-render to show cursor
      this.scheduleRender();
    });

    hiddenTextarea.addEventListener('blur', () => {
      editorWrapper.classList.remove('focused');
      this._lastStartIndex = -1; // Force re-render to hide cursor
      this.scheduleRender();
    });

    // Scroll handling
    let isRendering = false;
    viewport.addEventListener('scroll', () => {
      if (isRendering) return;
      this.scrollTop = viewport.scrollTop;
      this.syncGutterScroll();
      
      // Use requestAnimationFrame to batch scroll updates
      if (!this._scrollRaf) {
        this._scrollRaf = requestAnimationFrame(() => {
          this._scrollRaf = null;
          isRendering = true;
          this.renderViewport();
          isRendering = false;
        });
      }
    });

    // Composition handling for international keyboards (dead keys)
    hiddenTextarea.addEventListener('compositionstart', () => {
      this._isComposing = true;
    });

    hiddenTextarea.addEventListener('compositionend', () => {
      this._isComposing = false;
      // Process the final composed text
      this.handleInput();
    });

    // Input handling (hidden textarea)
    hiddenTextarea.addEventListener('input', () => {
      // Skip input during composition (dead keys on international keyboards)
      if (this._isComposing) return;
      this.handleInput();
    });

    hiddenTextarea.addEventListener('keydown', (e) => {
      this.handleKeydown(e);
    });

    // Paste handling
    hiddenTextarea.addEventListener('paste', (e) => {
      this.handlePaste(e);
    });

    // Copy handling
    hiddenTextarea.addEventListener('copy', (e) => {
      this.handleCopy(e);
    });

    // Cut handling
    hiddenTextarea.addEventListener('cut', (e) => {
      this.handleCut(e);
    });

    // Gutter interactions
    gutterContent.addEventListener('click', (e) => {
      this.handleGutterClick(e);
    });
    
    // Prevent gutter from stealing focus
    gutter.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });

    // Wheel on gutter -> scroll viewport
    gutter.addEventListener('wheel', (e) => {
      e.preventDefault();
      viewport.scrollTop += e.deltaY;
    });

    // Clear button
    clearBtn.addEventListener('click', () => {
      this.removeAll();
    });

    // Initial readonly state
    this.updateReadonly();
  }

  // ========== Model Operations ==========
  
  /**
   * Set the editor content from a string value
   */
  setValue(value) {
    if (!value || !value.trim()) {
      this.lines = [];
    } else {
      // Try to format JSON
      try {
        const wrapped = '[' + value + ']';
        const parsed = JSON.parse(wrapped);
        const formatted = JSON.stringify(parsed, null, 2);
        const lines = formatted.split('\n');
        // Remove wrapper brackets
        this.lines = lines.slice(1, -1);
      } catch (e) {
        // Invalid JSON, use as-is
        this.lines = value.split('\n');
      }
    }
    
    // Clear state for new content
    this.collapsedNodes.clear();
    this.hiddenFeatures.clear();
    this._lineToNodeId.clear();
    this._nodeIdToLines.clear();
    this.cursorLine = 0;
    this.cursorColumn = 0;
    
    this.updateModel();
    this.scheduleRender();
    this.updatePlaceholderVisibility();
    
    // Auto-collapse coordinates
    if (this.lines.length > 0) {
      requestAnimationFrame(() => {
        this.autoCollapseCoordinates();
      });
    }
    
    this.emitChange();
  }

  /**
   * Get full content as string (expanded, no hidden markers)
   */
  getContent() {
    return this.lines.join('\n');
  }

  /**
   * Update derived state from model
   * Rebuilds line-to-nodeId mapping while preserving collapsed state
   */
  updateModel() {
    // Rebuild lineToNodeId mapping (may shift due to edits)
    this._rebuildNodeIdMappings();
    
    this.computeFeatureRanges();
    this.computeLineMetadata();
    this.computeVisibleLines();
  }

  /**
   * Update view state without rebuilding nodeId mappings
   * Used for collapse/expand operations where content doesn't change
   */
  updateView() {
    this.computeLineMetadata();
    this.computeVisibleLines();
  }

  /**
   * Compute feature ranges (which lines belong to which feature)
   */
  computeFeatureRanges() {
    this.featureRanges.clear();
    
    try {
      const content = this.lines.join('\n');
      const fullValue = this.prefix + content + this.suffix;
      const parsed = JSON.parse(fullValue);
      
      if (!parsed.features) return;
      
      let featureIndex = 0;
      let braceDepth = 0;
      let inFeature = false;
      let featureStartLine = -1;
      let currentFeatureKey = null;
      
      for (let i = 0; i < this.lines.length; i++) {
        const line = this.lines[i];
        
        if (!inFeature && /"type"\s*:\s*"Feature"/.test(line)) {
          // Find opening brace
          let startLine = i;
          for (let j = i; j >= 0; j--) {
            const trimmed = this.lines[j].trim();
            if (trimmed === '{' || trimmed === '{,') {
              startLine = j;
              break;
            }
          }
          featureStartLine = startLine;
          inFeature = true;
          braceDepth = 1;
          
          // Count braces from start to current line
          for (let k = startLine; k <= i; k++) {
            const counts = this._countBrackets(this.lines[k], '{');
            if (k === startLine) {
              braceDepth += (counts.open - 1) - counts.close;
            } else {
              braceDepth += counts.open - counts.close;
            }
          }
          
          if (featureIndex < parsed.features.length) {
            currentFeatureKey = this._getFeatureKey(parsed.features[featureIndex]);
          }
        } else if (inFeature) {
          const counts = this._countBrackets(line, '{');
          braceDepth += counts.open - counts.close;
          
          if (braceDepth <= 0) {
            if (currentFeatureKey) {
              this.featureRanges.set(currentFeatureKey, {
                startLine: featureStartLine,
                endLine: i,
                featureIndex
              });
            }
            featureIndex++;
            inFeature = false;
            currentFeatureKey = null;
          }
        }
      }
    } catch (e) {
      // Invalid JSON
    }
  }

  /**
   * Compute metadata for each line (colors, booleans, collapse buttons, etc.)
   */
  computeLineMetadata() {
    this.lineMetadata.clear();
    
    const collapsibleRanges = this._findCollapsibleRanges();
    
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const meta = {
        colors: [],
        booleans: [],
        collapseButton: null,
        visibilityButton: null,
        isHidden: false,
        isCollapsed: false,
        featureKey: null
      };
      
      // Detect colors
      const colorRegex = /"([\w-]+)"\s*:\s*"(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}))"/g;
      let colorMatch;
      while ((colorMatch = colorRegex.exec(line)) !== null) {
        meta.colors.push({ attributeName: colorMatch[1], color: colorMatch[2] });
      }
      
      // Detect booleans
      const boolRegex = /"([\w-]+)"\s*:\s*(true|false)/g;
      let boolMatch;
      while ((boolMatch = boolRegex.exec(line)) !== null) {
        meta.booleans.push({ attributeName: boolMatch[1], value: boolMatch[2] === 'true' });
      }
      
      // Check if line starts a collapsible node
      const collapsible = collapsibleRanges.find(r => r.startLine === i);
      if (collapsible) {
        meta.collapseButton = {
          nodeKey: collapsible.nodeKey,
          nodeId: collapsible.nodeId,
          isCollapsed: this.collapsedNodes.has(collapsible.nodeId)
        };
      }
      
      // Check if line is inside a collapsed node (exclude closing bracket line)
      const insideCollapsed = collapsibleRanges.find(r => 
        this.collapsedNodes.has(r.nodeId) && i > r.startLine && i < r.endLine
      );
      if (insideCollapsed) {
        meta.isCollapsed = true;
      }
      
      // Check if line belongs to a hidden feature
      for (const [featureKey, range] of this.featureRanges) {
        if (i >= range.startLine && i <= range.endLine) {
          meta.featureKey = featureKey;
          if (this.hiddenFeatures.has(featureKey)) {
            meta.isHidden = true;
          }
          // Add visibility button only on feature start line
          if (i === range.startLine) {
            meta.visibilityButton = {
              featureKey,
              isHidden: this.hiddenFeatures.has(featureKey)
            };
          }
          break;
        }
      }
      
      this.lineMetadata.set(i, meta);
    }
  }

  /**
   * Compute which lines are visible (not inside collapsed nodes)
   */
  computeVisibleLines() {
    this.visibleLines = [];
    
    for (let i = 0; i < this.lines.length; i++) {
      const meta = this.lineMetadata.get(i);
      if (!meta || !meta.isCollapsed) {
        this.visibleLines.push({
          index: i,
          content: this.lines[i],
          meta
        });
      }
    }
    
    // Reset render cache to force re-render
    this._lastStartIndex = -1;
    this._lastEndIndex = -1;
    this._lastTotalLines = -1;
  }

  // ========== Rendering ==========
  
  scheduleRender() {
    if (this.renderTimer) return;
    this.renderTimer = requestAnimationFrame(() => {
      this.renderTimer = null;
      this.renderViewport();
    });
  }

  renderViewport() {
    // Skip render if blocked (during inline control click to prevent DOM destruction)
    if (this._blockRender) {
      return;
    }
    const viewport = this.shadowRoot.getElementById('viewport');
    const linesContainer = this.shadowRoot.getElementById('linesContainer');
    const scrollContent = this.shadowRoot.getElementById('scrollContent');
    const gutterContent = this.shadowRoot.getElementById('gutterContent');

    if (!viewport || !linesContainer) return;
    
    this.viewportHeight = viewport.clientHeight;
    
    const totalLines = this.visibleLines.length;
    const totalHeight = totalLines * this.lineHeight;
    
    // Set total scrollable height (only once or when content changes)
    if (scrollContent) {
      scrollContent.style.height = `${totalHeight}px`;
    }
    
    // Calculate visible range based on scroll position
    const scrollTop = viewport.scrollTop;
    const firstVisible = Math.floor(scrollTop / this.lineHeight);
    const visibleCount = Math.ceil(this.viewportHeight / this.lineHeight);
    
    const startIndex = Math.max(0, firstVisible - this.bufferLines);
    const endIndex = Math.min(totalLines, firstVisible + visibleCount + this.bufferLines);
    
    // Skip render if visible range hasn't changed (but always render if empty editor)
    if (totalLines > 0 && this._lastStartIndex === startIndex && this._lastEndIndex === endIndex && this._lastTotalLines === totalLines) {
      return;
    }
    this._lastStartIndex = startIndex;
    this._lastEndIndex = endIndex;
    this._lastTotalLines = totalLines;
    
    // Position linesContainer using transform (no layout recalc)
    const offsetY = startIndex * this.lineHeight;
    linesContainer.style.transform = `translateY(${offsetY}px)`;
    
    // Build context map for syntax highlighting
    const contextMap = this._buildContextMap();
    
    // Check if editor is focused (for cursor display)
    const editorWrapper = this.shadowRoot.querySelector('.editor-wrapper');
    const isFocused = editorWrapper?.classList.contains('focused');
    
    // Render visible lines
    const fragment = document.createDocumentFragment();
    
    // Handle empty editor: render an empty line with cursor
    if (totalLines === 0) {
      const lineEl = document.createElement('div');
      lineEl.className = 'line empty-line';
      lineEl.dataset.lineIndex = '0';
      if (isFocused) {
        lineEl.innerHTML = this._insertCursor(0);
      }
      fragment.appendChild(lineEl);
      linesContainer.innerHTML = '';
      linesContainer.appendChild(fragment);
      this.renderGutter(0, 0);
      return;
    }
    
    for (let i = startIndex; i < endIndex; i++) {
      const lineData = this.visibleLines[i];
      if (!lineData) continue;
      
      const lineEl = document.createElement('div');
      lineEl.className = 'line';
      lineEl.dataset.lineIndex = lineData.index;
      
      // Add visibility button on line (uses ::before pseudo-element)
      if (lineData.meta?.visibilityButton) {
        lineEl.classList.add('has-visibility');
        lineEl.dataset.featureKey = lineData.meta.visibilityButton.featureKey;
        if (lineData.meta.visibilityButton.isHidden) {
          lineEl.classList.add('feature-hidden');
        }
      }
      
      // Add hidden class if feature is hidden
      if (lineData.meta?.isHidden) {
        lineEl.classList.add('line-hidden');
      }
      
      // Highlight syntax and add cursor if this is the cursor line and editor is focused
      const context = contextMap.get(lineData.index);
      let html = this._highlightSyntax(lineData.content, context, lineData.meta);
      
      // Add selection highlight if line is in selection
      if (isFocused && this._hasSelection()) {
        html = this._addSelectionHighlight(html, lineData.index, lineData.content);
      }
      
      // Add cursor if this is the cursor line and editor is focused
      if (isFocused && lineData.index === this.cursorLine) {
        html += this._insertCursor(this.cursorColumn);
      }
      
      lineEl.innerHTML = html;
      
      fragment.appendChild(lineEl);
    }
    
    linesContainer.innerHTML = '';
    linesContainer.appendChild(fragment);
    
    // Render gutter with same range
    this.renderGutter(startIndex, endIndex);
  }
  
  /**
   * Insert cursor element at the specified column position
   * Uses absolute positioning to avoid affecting text layout
   */
  _insertCursor(column) {
    // Calculate cursor position in pixels using character width
    const charWidth = this._getCharWidth();
    const left = column * charWidth;
    return `<span class="cursor" style="left: ${left}px"></span>`;
  }

  /**
   * Add selection highlight to a line
   */
  _addSelectionHighlight(html, lineIndex, content) {
    const { start, end } = this._normalizeSelection();
    if (!start || !end) return html;
    
    // Check if this line is in the selection
    if (lineIndex < start.line || lineIndex > end.line) return html;
    
    const charWidth = this._getCharWidth();
    let selStart, selEnd;
    
    if (lineIndex === start.line && lineIndex === end.line) {
      // Selection is within this line
      selStart = start.column;
      selEnd = end.column;
    } else if (lineIndex === start.line) {
      // Selection starts on this line
      selStart = start.column;
      selEnd = content.length;
    } else if (lineIndex === end.line) {
      // Selection ends on this line
      selStart = 0;
      selEnd = end.column;
    } else {
      // Entire line is selected
      selStart = 0;
      selEnd = content.length;
    }
    
    const left = selStart * charWidth;
    const width = (selEnd - selStart) * charWidth;
    
    // Add selection overlay
    const selectionSpan = `<span class="selection" style="left: ${left}px; width: ${width}px"></span>`;
    return selectionSpan + html;
  }
  
  /**
   * Get character width for monospace font
   */
  _getCharWidth() {
    if (!this._charWidth) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      // Use exact same font as CSS: 'Courier New', Courier, monospace at 13px
      ctx.font = "13px 'Courier New', Courier, monospace";
      this._charWidth = ctx.measureText('M').width;
    }
    return this._charWidth;
  }

  renderGutter(startIndex, endIndex) {
    const gutterContent = this.shadowRoot.getElementById('gutterContent');
    const gutterScrollContent = this.shadowRoot.getElementById('gutterScrollContent');
    if (!gutterContent) return;
    
    // Set total height for gutter scroll
    const totalHeight = this.visibleLines.length * this.lineHeight;
    if (gutterScrollContent) {
      gutterScrollContent.style.height = `${totalHeight}px`;
    }
    
    // Position gutter content using transform
    const offsetY = startIndex * this.lineHeight;
    gutterContent.style.transform = `translateY(${offsetY}px)`;
    
    const fragment = document.createDocumentFragment();
    
    for (let i = startIndex; i < endIndex; i++) {
      const lineData = this.visibleLines[i];
      if (!lineData) continue;
      
      const gutterLine = document.createElement('div');
      gutterLine.className = 'gutter-line';
      
      const meta = lineData.meta;
      
      // Line number first
      const lineNum = document.createElement('span');
      lineNum.className = 'line-number';
      lineNum.textContent = lineData.index + 1;
      gutterLine.appendChild(lineNum);
      
      // Collapse column (always present for alignment)
      const collapseCol = document.createElement('div');
      collapseCol.className = 'collapse-column';
      if (meta?.collapseButton) {
        const btn = document.createElement('div');
        btn.className = 'collapse-button' + (meta.collapseButton.isCollapsed ? ' collapsed' : '');
        btn.textContent = meta.collapseButton.isCollapsed ? '›' : '⌄';
        btn.dataset.line = lineData.index;
        btn.dataset.nodeId = meta.collapseButton.nodeId;
        btn.title = meta.collapseButton.isCollapsed ? 'Expand' : 'Collapse';
        collapseCol.appendChild(btn);
      }
      gutterLine.appendChild(collapseCol);
      
      fragment.appendChild(gutterLine);
    }
    
    gutterContent.innerHTML = '';
    gutterContent.appendChild(fragment);
  }

  syncGutterScroll() {
    const gutterScroll = this.shadowRoot.getElementById('gutterScroll');
    const viewport = this.shadowRoot.getElementById('viewport');
    if (gutterScroll && viewport) {
      // Sync gutter scroll position with viewport
      gutterScroll.scrollTop = viewport.scrollTop;
    }
  }

  // ========== Input Handling ==========
  
  handleInput() {
    const textarea = this.shadowRoot.getElementById('hiddenTextarea');
    const inputValue = textarea.value;
    
    if (!inputValue) return;
    
    // Block input in hidden collapsed zones
    if (this._getCollapsedRangeForLine(this.cursorLine)) {
      textarea.value = '';
      return;
    }
    
    // On closing line, only allow after bracket
    const onClosingLine = this._getCollapsedClosingLine(this.cursorLine);
    if (onClosingLine) {
      const line = this.lines[this.cursorLine];
      const bracketPos = this._getClosingBracketPos(line);
      if (this.cursorColumn <= bracketPos) {
        textarea.value = '';
        return;
      }
    }
    
    // On collapsed opening line, only allow before bracket
    const onCollapsed = this._getCollapsedNodeAtLine(this.cursorLine);
    if (onCollapsed) {
      const line = this.lines[this.cursorLine];
      const bracketPos = line.search(/[{\[]/);
      if (this.cursorColumn > bracketPos) {
        textarea.value = '';
        return;
      }
    }
    
    // Insert the input at cursor position
    if (this.cursorLine < this.lines.length) {
      const line = this.lines[this.cursorLine];
      const before = line.substring(0, this.cursorColumn);
      const after = line.substring(this.cursorColumn);
      
      // Handle newlines in input
      const inputLines = inputValue.split('\n');
      if (inputLines.length === 1) {
        this.lines[this.cursorLine] = before + inputValue + after;
        this.cursorColumn += inputValue.length;
      } else {
        // Multi-line input
        this.lines[this.cursorLine] = before + inputLines[0];
        for (let i = 1; i < inputLines.length - 1; i++) {
          this.lines.splice(this.cursorLine + i, 0, inputLines[i]);
        }
        const lastLine = inputLines[inputLines.length - 1] + after;
        this.lines.splice(this.cursorLine + inputLines.length - 1, 0, lastLine);
        this.cursorLine += inputLines.length - 1;
        this.cursorColumn = inputLines[inputLines.length - 1].length;
      }
    } else {
      // Append new lines
      const inputLines = inputValue.split('\n');
      this.lines.push(...inputLines);
      this.cursorLine = this.lines.length - 1;
      this.cursorColumn = this.lines[this.cursorLine].length;
    }
    
    // Clear textarea
    textarea.value = '';
    
    // Debounce formatting and update
    clearTimeout(this.inputTimer);
    this.inputTimer = setTimeout(() => {
      this.formatAndUpdate();
    }, 150);
  }

  handleKeydown(e) {
    // Check if cursor is in a collapsed zone
    const inCollapsedZone = this._getCollapsedRangeForLine(this.cursorLine);
    const onCollapsedNode = this._getCollapsedNodeAtLine(this.cursorLine);
    const onClosingLine = this._getCollapsedClosingLine(this.cursorLine);
    
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        // Block in collapsed zones
        if (onCollapsedNode || inCollapsedZone) return;
        // On closing line, before bracket -> block
        if (onClosingLine) {
          const line = this.lines[this.cursorLine];
          const bracketPos = this._getClosingBracketPos(line);
          if (bracketPos >= 0 && this.cursorColumn <= bracketPos) {
            return;
          }
          // After bracket, allow normal enter (add new line)
        }
        this.insertNewline();
        break;
      case 'Backspace':
        e.preventDefault();
        // Delete selection if any
        if (this._hasSelection()) {
          this._deleteSelection();
          this.formatAndUpdate();
          return;
        }
        // On closing line
        if (onClosingLine) {
          const line = this.lines[this.cursorLine];
          const bracketPos = this._getClosingBracketPos(line);
          if (bracketPos >= 0 && this.cursorColumn > bracketPos + 1) {
            // After bracket, allow delete
            this.deleteBackward();
            return;
          } else if (this.cursorColumn === bracketPos + 1) {
            // Just after bracket, delete whole node
            this._deleteCollapsedNode(onClosingLine);
            return;
          }
          // On or before bracket, delete whole node
          this._deleteCollapsedNode(onClosingLine);
          return;
        }
        // If on collapsed node opening line at position 0, delete whole node
        if (onCollapsedNode && this.cursorColumn === 0) {
          this._deleteCollapsedNode(onCollapsedNode);
          return;
        }
        // Block inside collapsed zones
        if (inCollapsedZone) return;
        // On opening line, allow editing before and at bracket
        if (onCollapsedNode) {
          const line = this.lines[this.cursorLine];
          const bracketPos = line.search(/[{\[]/);
          if (this.cursorColumn > bracketPos + 1) {
            // After bracket, delete whole node
            this._deleteCollapsedNode(onCollapsedNode);
            return;
          }
        }
        this.deleteBackward();
        break;
      case 'Delete':
        e.preventDefault();
        // Delete selection if any
        if (this._hasSelection()) {
          this._deleteSelection();
          this.formatAndUpdate();
          return;
        }
        // On closing line
        if (onClosingLine) {
          const line = this.lines[this.cursorLine];
          const bracketPos = this._getClosingBracketPos(line);
          if (bracketPos >= 0 && this.cursorColumn > bracketPos) {
            // After bracket, allow delete
            this.deleteForward();
            return;
          }
          // On or before bracket, delete whole node
          this._deleteCollapsedNode(onClosingLine);
          return;
        }
        // If on collapsed node opening line
        if (onCollapsedNode) {
          const line = this.lines[this.cursorLine];
          const bracketPos = line.search(/[{\[]/);
          if (this.cursorColumn > bracketPos) {
            // After bracket, delete whole node
            this._deleteCollapsedNode(onCollapsedNode);
            return;
          }
          // Before bracket, allow editing key name
        }
        // Block inside collapsed zones
        if (inCollapsedZone) return;
        this.deleteForward();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this._handleArrowKey(-1, 0, e.shiftKey);
        break;
      case 'ArrowDown':
        e.preventDefault();
        this._handleArrowKey(1, 0, e.shiftKey);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this._handleArrowKey(0, -1, e.shiftKey);
        break;
      case 'ArrowRight':
        e.preventDefault();
        this._handleArrowKey(0, 1, e.shiftKey);
        break;
      case 'Home':
        e.preventDefault();
        this._handleHomeEnd('home', e.shiftKey, onClosingLine);
        break;
      case 'End':
        e.preventDefault();
        this._handleHomeEnd('end', e.shiftKey, onClosingLine);
        break;
      case 'a':
        // Ctrl+A or Cmd+A: select all
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this._selectAll();
          return;
        }
        break;
      case 'Tab':
        e.preventDefault();
        
        // Shift+Tab: collapse the containing expanded node
        if (e.shiftKey) {
          const containingNode = this._getContainingExpandedNode(this.cursorLine);
          if (containingNode) {
            // Find the position just after the opening bracket
            const startLine = this.lines[containingNode.startLine];
            const bracketPos = startLine.search(/[{\[]/);
            
            this.toggleCollapse(containingNode.nodeId);
            
            // Move cursor to just after the opening bracket
            this.cursorLine = containingNode.startLine;
            this.cursorColumn = bracketPos >= 0 ? bracketPos + 1 : startLine.length;
            this._clearSelection();
            this._scrollToCursor();
          }
          return;
        }
        
        // Tab: expand collapsed node if on one
        if (onCollapsedNode) {
          this.toggleCollapse(onCollapsedNode.nodeId);
          return;
        }
        if (onClosingLine) {
          this.toggleCollapse(onClosingLine.nodeId);
          return;
        }
        
        // Block in hidden collapsed zones
        if (inCollapsedZone) return;
        break;
    }
  }

  insertNewline() {
    if (this.cursorLine < this.lines.length) {
      const line = this.lines[this.cursorLine];
      const before = line.substring(0, this.cursorColumn);
      const after = line.substring(this.cursorColumn);
      
      this.lines[this.cursorLine] = before;
      this.lines.splice(this.cursorLine + 1, 0, after);
      this.cursorLine++;
      this.cursorColumn = 0;
    } else {
      this.lines.push('');
      this.cursorLine = this.lines.length - 1;
      this.cursorColumn = 0;
    }
    
    this.formatAndUpdate();
  }

  deleteBackward() {
    if (this.cursorColumn > 0) {
      const line = this.lines[this.cursorLine];
      this.lines[this.cursorLine] = line.substring(0, this.cursorColumn - 1) + line.substring(this.cursorColumn);
      this.cursorColumn--;
    } else if (this.cursorLine > 0) {
      // Merge with previous line
      const currentLine = this.lines[this.cursorLine];
      const prevLine = this.lines[this.cursorLine - 1];
      this.cursorColumn = prevLine.length;
      this.lines[this.cursorLine - 1] = prevLine + currentLine;
      this.lines.splice(this.cursorLine, 1);
      this.cursorLine--;
    }
    
    this.formatAndUpdate();
  }

  deleteForward() {
    if (this.cursorLine < this.lines.length) {
      const line = this.lines[this.cursorLine];
      if (this.cursorColumn < line.length) {
        this.lines[this.cursorLine] = line.substring(0, this.cursorColumn) + line.substring(this.cursorColumn + 1);
      } else if (this.cursorLine < this.lines.length - 1) {
        // Merge with next line
        this.lines[this.cursorLine] = line + this.lines[this.cursorLine + 1];
        this.lines.splice(this.cursorLine + 1, 1);
      }
    }
    
    this.formatAndUpdate();
  }

  /**
   * Move cursor vertically, skipping hidden collapsed lines only
   */
  moveCursorSkipCollapsed(deltaLine) {
    let targetLine = this.cursorLine + deltaLine;
    
    // Skip over hidden collapsed zones only (not opening/closing lines)
    while (targetLine >= 0 && targetLine < this.lines.length) {
      const collapsed = this._getCollapsedRangeForLine(targetLine);
      if (collapsed) {
        // Jump past the hidden zone
        if (deltaLine > 0) {
          targetLine = collapsed.endLine; // Jump to closing bracket line
        } else {
          targetLine = collapsed.startLine; // Jump to opening line
        }
      }
      break;
    }
    
    this.cursorLine = Math.max(0, Math.min(this.lines.length - 1, targetLine));
    
    // Clamp column to line length
    const maxCol = this.lines[this.cursorLine]?.length || 0;
    this.cursorColumn = Math.min(this.cursorColumn, maxCol);
    
    this._lastStartIndex = -1;
    this._scrollToCursor();
    this.scheduleRender();
  }

  /**
   * Move cursor horizontally with smart navigation around collapsed nodes
   */
  moveCursorHorizontal(delta) {
    const line = this.lines[this.cursorLine];
    const onCollapsed = this._getCollapsedNodeAtLine(this.cursorLine);
    const onClosingLine = this._getCollapsedClosingLine(this.cursorLine);
    
    if (delta > 0) {
      // Moving right
      if (onClosingLine) {
        const bracketPos = this._getClosingBracketPos(line);
        if (this.cursorColumn < bracketPos) {
          // Before bracket, jump to bracket
          this.cursorColumn = bracketPos;
        } else if (this.cursorColumn >= line.length) {
          // At end, go to next line
          if (this.cursorLine < this.lines.length - 1) {
            this.cursorLine++;
            this.cursorColumn = 0;
          }
        } else {
          // On or after bracket, move normally
          this.cursorColumn++;
        }
      } else if (onCollapsed) {
        const bracketPos = line.search(/[{\[]/);
        if (this.cursorColumn < bracketPos) {
          // Before bracket, move normally
          this.cursorColumn++;
        } else if (this.cursorColumn === bracketPos) {
          // On bracket, go to after bracket
          this.cursorColumn = bracketPos + 1;
        } else {
          // After bracket, jump to closing line at bracket
          this.cursorLine = onCollapsed.endLine;
          const closingLine = this.lines[this.cursorLine];
          this.cursorColumn = this._getClosingBracketPos(closingLine);
        }
      } else if (this.cursorColumn >= line.length) {
        // Move to next line
        if (this.cursorLine < this.lines.length - 1) {
          this.cursorLine++;
          this.cursorColumn = 0;
          // Skip hidden collapsed zones
          const collapsed = this._getCollapsedRangeForLine(this.cursorLine);
          if (collapsed) {
            this.cursorLine = collapsed.endLine;
            this.cursorColumn = 0;
          }
        }
      } else {
        this.cursorColumn++;
      }
    } else {
      // Moving left
      if (onClosingLine) {
        const bracketPos = this._getClosingBracketPos(line);
        if (this.cursorColumn > bracketPos + 1) {
          // After bracket, move normally
          this.cursorColumn--;
        } else if (this.cursorColumn === bracketPos + 1) {
          // Just after bracket, jump to opening line after bracket
          this.cursorLine = onClosingLine.startLine;
          const openLine = this.lines[this.cursorLine];
          const openBracketPos = openLine.search(/[{\[]/);
          this.cursorColumn = openBracketPos + 1;
        } else {
          // On bracket, jump to opening line after bracket
          this.cursorLine = onClosingLine.startLine;
          const openLine = this.lines[this.cursorLine];
          const openBracketPos = openLine.search(/[{\[]/);
          this.cursorColumn = openBracketPos + 1;
        }
      } else if (onCollapsed) {
        const bracketPos = line.search(/[{\[]/);
        if (this.cursorColumn > bracketPos + 1) {
          // After bracket, go to just after bracket
          this.cursorColumn = bracketPos + 1;
        } else if (this.cursorColumn === bracketPos + 1) {
          // Just after bracket, go to bracket
          this.cursorColumn = bracketPos;
        } else if (this.cursorColumn > 0) {
          // Before bracket, move normally
          this.cursorColumn--;
        } else {
          // At start, go to previous line
          if (this.cursorLine > 0) {
            this.cursorLine--;
            this.cursorColumn = this.lines[this.cursorLine]?.length || 0;
          }
        }
      } else if (this.cursorColumn > 0) {
        this.cursorColumn--;
      } else if (this.cursorLine > 0) {
        // Move to previous line
        this.cursorLine--;
        
        // Check if previous line is closing line of collapsed
        const closing = this._getCollapsedClosingLine(this.cursorLine);
        if (closing) {
          // Go to end of closing line
          this.cursorColumn = this.lines[this.cursorLine]?.length || 0;
        } else {
          // Check if previous line is inside collapsed zone
          const collapsed = this._getCollapsedRangeForLine(this.cursorLine);
          if (collapsed) {
            // Jump to opening line after bracket
            this.cursorLine = collapsed.startLine;
            const openLine = this.lines[this.cursorLine];
            const bracketPos = openLine.search(/[{\[]/);
            this.cursorColumn = bracketPos + 1;
          } else {
            this.cursorColumn = this.lines[this.cursorLine]?.length || 0;
          }
        }
      }
    }
    
    this._lastStartIndex = -1;
    this._scrollToCursor();
    this.scheduleRender();
  }

  /**
   * Scroll viewport to ensure cursor is visible
   */
  _scrollToCursor() {
    const viewport = this.shadowRoot.getElementById('viewport');
    if (!viewport) return;
    
    // Find the visible line index for the cursor
    const visibleIndex = this.visibleLines.findIndex(vl => vl.index === this.cursorLine);
    if (visibleIndex === -1) return;
    
    const cursorY = visibleIndex * this.lineHeight;
    const viewportTop = viewport.scrollTop;
    const viewportBottom = viewportTop + viewport.clientHeight;
    
    // Scroll up if cursor is above viewport
    if (cursorY < viewportTop) {
      viewport.scrollTop = cursorY;
    }
    // Scroll down if cursor is below viewport
    else if (cursorY + this.lineHeight > viewportBottom) {
      viewport.scrollTop = cursorY + this.lineHeight - viewport.clientHeight;
    }
  }

  /**
   * Legacy moveCursor for compatibility
   */
  moveCursor(deltaLine, deltaCol) {
    if (deltaLine !== 0) {
      this.moveCursorSkipCollapsed(deltaLine);
    } else if (deltaCol !== 0) {
      this.moveCursorHorizontal(deltaCol);
    }
  }

  /**
   * Handle arrow key with optional selection
   */
  _handleArrowKey(deltaLine, deltaCol, isShift) {
    // Start selection if shift is pressed and no selection exists
    if (isShift && !this.selectionStart) {
      this.selectionStart = { line: this.cursorLine, column: this.cursorColumn };
    }
    
    // Move cursor
    if (deltaLine !== 0) {
      this.moveCursorSkipCollapsed(deltaLine);
    } else if (deltaCol !== 0) {
      this.moveCursorHorizontal(deltaCol);
    }
    
    // Update selection end if shift is pressed
    if (isShift) {
      this.selectionEnd = { line: this.cursorLine, column: this.cursorColumn };
    } else {
      // Clear selection if shift not pressed
      this.selectionStart = null;
      this.selectionEnd = null;
    }
  }

  /**
   * Handle Home/End with optional selection
   */
  _handleHomeEnd(key, isShift, onClosingLine) {
    // Start selection if shift is pressed and no selection exists
    if (isShift && !this.selectionStart) {
      this.selectionStart = { line: this.cursorLine, column: this.cursorColumn };
    }
    
    if (key === 'home') {
      if (onClosingLine) {
        this.cursorLine = onClosingLine.startLine;
      }
      this.cursorColumn = 0;
    } else {
      if (this.cursorLine < this.lines.length) {
        this.cursorColumn = this.lines[this.cursorLine].length;
      }
    }
    
    // Update selection end if shift is pressed
    if (isShift) {
      this.selectionEnd = { line: this.cursorLine, column: this.cursorColumn };
    } else {
      this.selectionStart = null;
      this.selectionEnd = null;
    }
    
    this._lastStartIndex = -1;
    this._scrollToCursor();
    this.scheduleRender();
  }

  /**
   * Select all content
   */
  _selectAll() {
    this.selectionStart = { line: 0, column: 0 };
    const lastLine = this.lines.length - 1;
    this.selectionEnd = { line: lastLine, column: this.lines[lastLine]?.length || 0 };
    this.cursorLine = lastLine;
    this.cursorColumn = this.lines[lastLine]?.length || 0;
    
    this._lastStartIndex = -1;
    this._scrollToCursor();
    this.scheduleRender();
  }

  /**
   * Get selected text
   */
  _getSelectedText() {
    if (!this.selectionStart || !this.selectionEnd) return '';
    
    const { start, end } = this._normalizeSelection();
    if (!start || !end) return '';
    
    if (start.line === end.line) {
      return this.lines[start.line].substring(start.column, end.column);
    }
    
    let text = this.lines[start.line].substring(start.column) + '\n';
    for (let i = start.line + 1; i < end.line; i++) {
      text += this.lines[i] + '\n';
    }
    text += this.lines[end.line].substring(0, end.column);
    
    return text;
  }

  /**
   * Normalize selection so start is before end
   */
  _normalizeSelection() {
    if (!this.selectionStart || !this.selectionEnd) {
      return { start: null, end: null };
    }
    
    const s = this.selectionStart;
    const e = this.selectionEnd;
    
    if (s.line < e.line || (s.line === e.line && s.column <= e.column)) {
      return { start: s, end: e };
    } else {
      return { start: e, end: s };
    }
  }

  /**
   * Check if there is an active selection
   */
  _hasSelection() {
    if (!this.selectionStart || !this.selectionEnd) return false;
    return this.selectionStart.line !== this.selectionEnd.line ||
           this.selectionStart.column !== this.selectionEnd.column;
  }

  /**
   * Clear the current selection
   */
  _clearSelection() {
    this.selectionStart = null;
    this.selectionEnd = null;
  }

  /**
   * Delete selected text
   */
  _deleteSelection() {
    if (!this._hasSelection()) return false;
    
    const { start, end } = this._normalizeSelection();
    
    if (start.line === end.line) {
      // Single line selection
      const line = this.lines[start.line];
      this.lines[start.line] = line.substring(0, start.column) + line.substring(end.column);
    } else {
      // Multi-line selection
      const startLine = this.lines[start.line].substring(0, start.column);
      const endLine = this.lines[end.line].substring(end.column);
      this.lines[start.line] = startLine + endLine;
      this.lines.splice(start.line + 1, end.line - start.line);
    }
    
    this.cursorLine = start.line;
    this.cursorColumn = start.column;
    this.selectionStart = null;
    this.selectionEnd = null;
    
    return true;
  }

  insertText(text) {
    // Delete selection first if any
    if (this._hasSelection()) {
      this._deleteSelection();
    }
    
    // Block insertion in hidden collapsed zones
    if (this._getCollapsedRangeForLine(this.cursorLine)) return;
    
    // On closing line, only allow after bracket
    const onClosingLine = this._getCollapsedClosingLine(this.cursorLine);
    if (onClosingLine) {
      const line = this.lines[this.cursorLine];
      const bracketPos = this._getClosingBracketPos(line);
      if (this.cursorColumn <= bracketPos) return;
    }
    
    // On collapsed opening line, only allow before bracket
    const onCollapsed = this._getCollapsedNodeAtLine(this.cursorLine);
    if (onCollapsed) {
      const line = this.lines[this.cursorLine];
      const bracketPos = line.search(/[{\[]/);
      if (this.cursorColumn > bracketPos) return;
    }
    
    // Handle empty editor case
    if (this.lines.length === 0) {
      // Split text by newlines to properly handle multi-line paste
      const textLines = text.split('\n');
      this.lines = textLines;
      this.cursorLine = textLines.length - 1;
      this.cursorColumn = textLines[textLines.length - 1].length;
    } else if (this.cursorLine < this.lines.length) {
      const line = this.lines[this.cursorLine];
      this.lines[this.cursorLine] = line.substring(0, this.cursorColumn) + text + line.substring(this.cursorColumn);
      this.cursorColumn += text.length;
    }
    this.formatAndUpdate();
  }

  handlePaste(e) {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (text) {
      const wasEmpty = this.lines.length === 0;
      this.insertText(text);
      // Auto-collapse coordinates after pasting into empty editor
      if (wasEmpty && this.lines.length > 0) {
        // Cancel pending render, collapse first, then render once
        if (this.renderTimer) {
          cancelAnimationFrame(this.renderTimer);
          this.renderTimer = null;
        }
        this.autoCollapseCoordinates();
      }
    }
  }

  handleCopy(e) {
    e.preventDefault();
    // Copy selected text if there's a selection, otherwise copy all
    if (this._hasSelection()) {
      e.clipboardData.setData('text/plain', this._getSelectedText());
    } else {
      e.clipboardData.setData('text/plain', this.getContent());
    }
  }

  handleCut(e) {
    e.preventDefault();
    if (this._hasSelection()) {
      e.clipboardData.setData('text/plain', this._getSelectedText());
      this._deleteSelection();
      this.formatAndUpdate();
    } else {
      // Cut all content
      e.clipboardData.setData('text/plain', this.getContent());
      this.lines = [];
      this.cursorLine = 0;
      this.cursorColumn = 0;
      this.formatAndUpdate();
    }
  }

  /**
   * Get line/column position from mouse event
   */
  _getPositionFromClick(e) {
    const viewport = this.shadowRoot.getElementById('viewport');
    const linesContainer = this.shadowRoot.getElementById('linesContainer');
    const rect = viewport.getBoundingClientRect();

    const paddingTop = 8;

    const y = e.clientY - rect.top + viewport.scrollTop - paddingTop;
    const visibleLineIndex = Math.floor(y / this.lineHeight);

    let line = 0;
    let column = 0;

    if (visibleLineIndex >= 0 && visibleLineIndex < this.visibleLines.length) {
      const lineData = this.visibleLines[visibleLineIndex];
      line = lineData.index;

      // Get actual line element to calculate column position accurately
      const lineEl = linesContainer?.querySelector(`.line[data-line-index="${lineData.index}"]`);
      const charWidth = this._getCharWidth();

      if (lineEl) {
        // Use line element's actual position for accurate column calculation
        const lineRect = lineEl.getBoundingClientRect();
        const clickRelativeToLine = e.clientX - lineRect.left;
        const rawColumn = Math.round(clickRelativeToLine / charWidth);
        const lineLength = lineData.content?.length || 0;
        column = Math.max(0, Math.min(rawColumn, lineLength));
      } else {
        // Fallback to padding-based calculation if line element not found
        const paddingLeft = 12;
        const x = e.clientX - rect.left + viewport.scrollLeft - paddingLeft;
        const rawColumn = Math.round(x / charWidth);
        const lineLength = lineData.content?.length || 0;
        column = Math.max(0, Math.min(rawColumn, lineLength));
      }
    }

    return { line, column };
  }

  // ========== Gutter Interactions ==========
  
  handleGutterClick(e) {
    // Visibility button in gutter
    const visBtn = e.target.closest('.visibility-button');
    if (visBtn) {
      this.toggleFeatureVisibility(visBtn.dataset.featureKey);
      return;
    }
    
    // Collapse button in gutter
    if (e.target.classList.contains('collapse-button')) {
      const nodeId = e.target.dataset.nodeId;
      this.toggleCollapse(nodeId);
      return;
    }
  }
  
  handleEditorClick(e) {
    // Unblock render now that click is being processed
    this._blockRender = false;

    // Line-level visibility button (pseudo-element ::before on .line.has-visibility)
    const lineEl = e.target.closest('.line.has-visibility');
    if (lineEl) {
      const rect = lineEl.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      if (clickX < 14) {
        e.preventDefault();
        e.stopPropagation();
        const featureKey = lineEl.dataset.featureKey;
        if (featureKey) {
          this.toggleFeatureVisibility(featureKey);
        }
        return;
      }
    }
    
    // Inline color swatch (pseudo-element positioned with left: -8px)
    if (e.target.classList.contains('json-color')) {
      const rect = e.target.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      // Pseudo-element is at left: -8px, so clickX will be negative when clicking on it
      if (clickX < 0 && clickX >= -8) {
        e.preventDefault();
        e.stopPropagation();
        const color = e.target.dataset.color;
        const targetLineEl = e.target.closest('.line');
        if (targetLineEl) {
          const lineIndex = parseInt(targetLineEl.dataset.lineIndex);
          const line = this.lines[lineIndex];
          const match = line.match(/"([\w-]+)"\s*:\s*"#/);
          if (match) {
            this.showColorPicker(e.target, lineIndex, color, match[1]);
          }
        }
        return;
      }
    }
    
    // Inline boolean checkbox (pseudo-element positioned with left: -8px)
    if (e.target.classList.contains('json-boolean')) {
      const rect = e.target.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      // Pseudo-element is at left: -8px, so clickX will be negative when clicking on it
      if (clickX < 0 && clickX >= -8) {
        e.preventDefault();
        e.stopPropagation();
        const targetLineEl = e.target.closest('.line');
        if (targetLineEl) {
          const lineIndex = parseInt(targetLineEl.dataset.lineIndex);
          const line = this.lines[lineIndex];
          const match = line.match(/"([\w-]+)"\s*:\s*(true|false)/);
          if (match) {
            const currentValue = match[2] === 'true';
            this.updateBooleanValue(lineIndex, !currentValue, match[1]);
          }
        }
        return;
      }
    }
  }

  // ========== Collapse/Expand ==========
  
  toggleCollapse(nodeId) {
    if (this.collapsedNodes.has(nodeId)) {
      this.collapsedNodes.delete(nodeId);
    } else {
      this.collapsedNodes.add(nodeId);
    }
    
    // Use updateView - don't rebuild nodeId mappings since content didn't change
    this.updateView();
    this._lastStartIndex = -1; // Force re-render
    this.scheduleRender();
  }

  autoCollapseCoordinates() {
    const ranges = this._findCollapsibleRanges();

    for (const range of ranges) {
      if (range.nodeKey === 'coordinates') {
        this.collapsedNodes.add(range.nodeId);
      }
    }

    // Rebuild everything to ensure consistent state after collapse changes
    // This is especially important after paste into empty editor
    this.updateModel();
    this.scheduleRender();
  }

  // ========== Feature Visibility ==========

  toggleFeatureVisibility(featureKey) {
    if (this.hiddenFeatures.has(featureKey)) {
      this.hiddenFeatures.delete(featureKey);
    } else {
      this.hiddenFeatures.add(featureKey);
    }

    // Use updateView - content didn't change, just visibility
    this.updateView();
    this.scheduleRender();
    this.emitChange();
  }

  // ========== Color Picker ==========
  
  showColorPicker(indicator, line, currentColor, attributeName) {
    // Remove existing picker and anchor
    const existing = document.querySelector('.geojson-color-picker-anchor');
    if (existing) {
      existing.remove();
    }
    
    // Create an anchor element at the pseudo-element position
    // The browser will position the color picker popup relative to this
    const anchor = document.createElement('div');
    anchor.className = 'geojson-color-picker-anchor';
    const rect = indicator.getBoundingClientRect();
    anchor.style.cssText = `
      position: fixed;
      left: ${rect.left - 8}px;
      top: ${rect.top + rect.height}px;
      width: 10px;
      height: 10px;
      z-index: 9998;
    `;
    document.body.appendChild(anchor);
    
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = currentColor;
    colorInput.className = 'geojson-color-picker-input';
    
    // Position the color input inside the anchor
    colorInput.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      width: 10px;
      height: 10px;
      opacity: 0;
      border: none;
      padding: 0;
      cursor: pointer;
    `;
    anchor.appendChild(colorInput);
    
    colorInput.addEventListener('input', (e) => {
      this.updateColorValue(line, e.target.value, attributeName);
    });
    
    const closeOnClickOutside = (e) => {
      if (e.target !== colorInput) {
        document.removeEventListener('click', closeOnClickOutside, true);
        anchor.remove(); // Remove anchor (which contains the input)
      }
    };
    
    colorInput._closeListener = closeOnClickOutside;
    
    setTimeout(() => {
      document.addEventListener('click', closeOnClickOutside, true);
    }, 100);
    
    colorInput.focus();
    colorInput.click();
  }

  updateColorValue(line, newColor, attributeName) {
    const regex = new RegExp(`"${attributeName}"\\s*:\\s*"#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})"`);
    this.lines[line] = this.lines[line].replace(regex, `"${attributeName}": "${newColor}"`);
    
    // Use updateView to preserve collapsed state (line count didn't change)
    this.updateView();
    this.scheduleRender();
    this.emitChange();
  }

  updateBooleanValue(line, newValue, attributeName) {
    const regex = new RegExp(`"${attributeName}"\\s*:\\s*(true|false)`);
    this.lines[line] = this.lines[line].replace(regex, `"${attributeName}": ${newValue}`);
    
    // Use updateView to preserve collapsed state (line count didn't change)
    this.updateView();
    this.scheduleRender();
    this.emitChange();
  }

  // ========== Format and Update ==========
  
  formatAndUpdate() {
    try {
      const content = this.lines.join('\n');
      const wrapped = '[' + content + ']';
      const parsed = JSON.parse(wrapped);
      
      const formatted = JSON.stringify(parsed, null, 2);
      const lines = formatted.split('\n');
      this.lines = lines.slice(1, -1); // Remove wrapper brackets
    } catch (e) {
      // Invalid JSON, keep as-is
    }
    
    this.updateModel();
    this.scheduleRender();
    this.updatePlaceholderVisibility();
    this.emitChange();
  }

  // ========== Event Emission ==========
  
  emitChange() {
    const content = this.getContent();
    const fullValue = this.prefix + content + this.suffix;
    
    try {
      let parsed = JSON.parse(fullValue);
      
      // Filter hidden features
      if (this.hiddenFeatures.size > 0) {
        parsed.features = parsed.features.filter((feature) => {
          const key = this._getFeatureKey(feature);
          return !this.hiddenFeatures.has(key);
        });
      }
      
      // Validate
      const errors = this._validateGeoJSON(parsed);
      
      if (errors.length > 0) {
        this.dispatchEvent(new CustomEvent('error', {
          detail: { error: errors.join('; '), errors, content },
          bubbles: true,
          composed: true
        }));
      } else {
        this.dispatchEvent(new CustomEvent('change', {
          detail: parsed,
          bubbles: true,
          composed: true
        }));
      }
    } catch (e) {
      this.dispatchEvent(new CustomEvent('error', {
        detail: { error: e.message, content },
        bubbles: true,
        composed: true
      }));
    }
  }

  // ========== UI Updates ==========
  
  updateReadonly() {
    const textarea = this.shadowRoot.getElementById('hiddenTextarea');
    const clearBtn = this.shadowRoot.getElementById('clearBtn');
    
    // Use readOnly instead of disabled to allow text selection for copying
    if (textarea) textarea.readOnly = this.readonly;
    if (clearBtn) clearBtn.hidden = this.readonly;
  }

  updatePlaceholderVisibility() {
    const placeholder = this.shadowRoot.getElementById('placeholderLayer');
    if (placeholder) {
      placeholder.style.display = this.lines.length > 0 ? 'none' : 'block';
    }
  }

  updatePlaceholderContent() {
    const placeholder = this.shadowRoot.getElementById('placeholderLayer');
    if (placeholder) {
      placeholder.textContent = this.placeholder;
    }
    this.updatePlaceholderVisibility();
  }

  updatePrefixSuffix() {
    const prefix = this.shadowRoot.getElementById('editorPrefix');
    const suffix = this.shadowRoot.getElementById('editorSuffix');
    
    if (prefix) prefix.textContent = this.prefix;
    if (suffix) suffix.textContent = this.suffix;
  }

  // ========== Theme ==========
  
  updateThemeCSS() {
    const darkSelector = this.getAttribute('dark-selector') || '.dark';
    const darkRule = this._parseSelectorToHostRule(darkSelector);
    
    let themeStyle = this.shadowRoot.getElementById('theme-styles');
    if (!themeStyle) {
      themeStyle = document.createElement('style');
      themeStyle.id = 'theme-styles';
      this.shadowRoot.insertBefore(themeStyle, this.shadowRoot.firstChild);
    }
    
    const darkDefaults = {
      bgColor: '#2b2b2b',
      textColor: '#a9b7c6',
      caretColor: '#bbbbbb',
      gutterBg: '#313335',
      gutterBorder: '#3c3f41',
      gutterText: '#606366',
      jsonKey: '#9876aa',
      jsonString: '#6a8759',
      jsonNumber: '#6897bb',
      jsonBoolean: '#cc7832',
      jsonNull: '#cc7832',
      jsonPunct: '#a9b7c6',
      jsonError: '#ff6b68',
      controlColor: '#cc7832',
      controlBg: '#3c3f41',
      controlBorder: '#5a5a5a',
      geojsonKey: '#9876aa',
      geojsonType: '#6a8759',
      geojsonTypeInvalid: '#ff6b68',
      jsonKeyInvalid: '#ff6b68'
    };
    
    const toKebab = (str) => str.replace(/([A-Z])/g, '-$1').toLowerCase();
    const generateVars = (obj) => Object.entries(obj)
      .map(([k, v]) => `--${toKebab(k)}: ${v};`)
      .join('\n        ');
    
    const lightVars = generateVars(this.themes.light || {});
    const darkTheme = { ...darkDefaults, ...this.themes.dark };
    const darkVars = generateVars(darkTheme);
    
    let css = lightVars ? `:host {\n        ${lightVars}\n      }\n` : '';
    css += `${darkRule} {\n        ${darkVars}\n      }`;
    
    themeStyle.textContent = css;
  }

  _parseSelectorToHostRule(selector) {
    if (!selector) return ':host([data-color-scheme="dark"])';
    if (selector.startsWith('.') && !selector.includes(' ')) {
      return `:host(${selector})`;
    }
    return `:host-context(${selector})`;
  }

  setTheme(theme) {
    if (theme.dark) this.themes.dark = { ...this.themes.dark, ...theme.dark };
    if (theme.light) this.themes.light = { ...this.themes.light, ...theme.light };
    this.updateThemeCSS();
  }

  resetTheme() {
    this.themes = { dark: {}, light: {} };
    this.updateThemeCSS();
  }

  // ========== Helper Methods ==========
  
  _getFeatureKey(feature) {
    if (!feature) return null;
    if (feature.id !== undefined) return `id:${feature.id}`;
    if (feature.properties?.id !== undefined) return `prop:${feature.properties.id}`;
    
    const geomType = feature.geometry?.type || 'null';
    const coords = JSON.stringify(feature.geometry?.coordinates || []);
    let hash = 0;
    for (let i = 0; i < coords.length; i++) {
      hash = ((hash << 5) - hash) + coords.charCodeAt(i);
      hash = hash & hash;
    }
    return `hash:${geomType}:${hash.toString(36)}`;
  }

  _countBrackets(line, openBracket) {
    const closeBracket = openBracket === '{' ? '}' : ']';
    let open = 0, close = 0, inString = false, escape = false;
    
    for (const char of line) {
      if (escape) { escape = false; continue; }
      if (char === '\\' && inString) { escape = true; continue; }
      if (char === '"') { inString = !inString; continue; }
      if (!inString) {
        if (char === openBracket) open++;
        if (char === closeBracket) close++;
      }
    }
    
    return { open, close };
  }

  /**
   * Find all collapsible ranges using the mappings built by _rebuildNodeIdMappings
   * This method only READS the existing mappings, it doesn't create new IDs
   */
  _findCollapsibleRanges() {
    const ranges = [];
    
    // Simply iterate through the existing mappings
    for (const [lineIndex, nodeId] of this._lineToNodeId) {
      const rangeInfo = this._nodeIdToLines.get(nodeId);
      if (!rangeInfo) continue;
      
      const line = this.lines[lineIndex];
      if (!line) continue;
      
      // Match "key": { or "key": [
      const kvMatch = line.match(/^\s*"([^"]+)"\s*:\s*([{\[])/);
      // Also match standalone { or [ (root Feature objects)
      const rootMatch = !kvMatch && line.match(/^\s*([{\[]),?\s*$/);
      
      if (!kvMatch && !rootMatch) continue;
      
      const openBracket = kvMatch ? kvMatch[2] : rootMatch[1];
      
      ranges.push({
        startLine: rangeInfo.startLine,
        endLine: rangeInfo.endLine,
        nodeKey: rangeInfo.nodeKey || (kvMatch ? kvMatch[1] : `__root_${lineIndex}`),
        nodeId,
        openBracket,
        isRootFeature: !!rootMatch
      });
    }
    
    // Sort by startLine for consistent ordering
    ranges.sort((a, b) => a.startLine - b.startLine);
    
    return ranges;
  }

  _findClosingLine(startLine, openBracket) {
    let depth = 1;
    const line = this.lines[startLine];
    const bracketPos = line.indexOf(openBracket);
    
    if (bracketPos !== -1) {
      const rest = line.substring(bracketPos + 1);
      const counts = this._countBrackets(rest, openBracket);
      depth += counts.open - counts.close;
      if (depth === 0) return startLine;
    }
    
    for (let i = startLine + 1; i < this.lines.length; i++) {
      const counts = this._countBrackets(this.lines[i], openBracket);
      depth += counts.open - counts.close;
      if (depth === 0) return i;
    }
    
    return -1;
  }

  _buildContextMap() {
    const contextMap = new Map();
    const contextStack = [];
    let pendingContext = null;
    
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const currentContext = contextStack[contextStack.length - 1]?.context || 'Feature';
      contextMap.set(i, currentContext);
      
      // Check for context-changing keys
      if (/"geometry"\s*:/.test(line)) pendingContext = 'geometry';
      else if (/"properties"\s*:/.test(line)) pendingContext = 'properties';
      else if (/"features"\s*:/.test(line)) pendingContext = 'Feature';
      
      // Track brackets
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      const openBrackets = (line.match(/\[/g) || []).length;
      const closeBrackets = (line.match(/\]/g) || []).length;
      
      for (let j = 0; j < openBraces + openBrackets; j++) {
        contextStack.push({ context: pendingContext || currentContext, isArray: j >= openBraces });
        pendingContext = null;
      }
      
      for (let j = 0; j < closeBraces + closeBrackets && contextStack.length > 0; j++) {
        contextStack.pop();
      }
    }
    
    return contextMap;
  }

  _highlightSyntax(text, context, meta) {
    if (!text) return '';
    
    // For collapsed nodes, truncate the text at the opening bracket
    let displayText = text;
    let collapsedBracket = null;
    
    if (meta?.collapseButton?.isCollapsed) {
      // Match "key": { or "key": [
      const bracketMatch = text.match(/^(\s*"[^"]+"\s*:\s*)([{\[])/);
      // Also match standalone { or [ (root Feature objects)
      const rootMatch = !bracketMatch && text.match(/^(\s*)([{\[]),?\s*$/);
      
      if (bracketMatch) {
        // Keep only the part up to and including the opening bracket
        displayText = bracketMatch[1] + bracketMatch[2];
        collapsedBracket = bracketMatch[2];
      } else if (rootMatch) {
        // Root object - just keep the bracket
        displayText = rootMatch[1] + rootMatch[2];
        collapsedBracket = rootMatch[2];
      }
    }
    
    // Escape HTML first
    let result = displayText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Punctuation FIRST (before other replacements can interfere)
    result = result.replace(/([{}[\],:])/g, '<span class="json-punctuation">$1</span>');
    
    // JSON keys - match "key" followed by :
    // In properties context, all keys are treated as regular JSON keys
    result = result.replace(/"([^"]+)"(<span class="json-punctuation">:<\/span>)/g, (match, key, colon) => {
      if (context !== 'properties' && GEOJSON_KEYS.includes(key)) {
        return `<span class="geojson-key">"${key}"</span>${colon}`;
      }
      return `<span class="json-key">"${key}"</span>${colon}`;
    });
    
    // Type values - "type": "Value" - but NOT inside properties context
    // IMPORTANT: Preserve original spacing by capturing and re-emitting whitespace
    if (context !== 'properties') {
      result = result.replace(
        /<span class="geojson-key">"type"<\/span><span class="json-punctuation">:<\/span>(\s*)"([^"]*)"/g,
        (match, space, type) => {
          const isValid = type === 'Feature' || type === 'FeatureCollection' || GEOMETRY_TYPES.includes(type);
          const cls = isValid ? 'geojson-type' : 'geojson-type-invalid';
          return `<span class="geojson-key">"type"</span><span class="json-punctuation">:</span>${space}<span class="${cls}">"${type}"</span>`;
        }
      );
    }

    // String values (not already wrapped in spans)
    // IMPORTANT: Preserve original spacing by capturing and re-emitting whitespace
    result = result.replace(
      /(<span class="json-punctuation">:<\/span>)(\s*)"([^"]*)"/g,
      (match, colon, space, val) => {
        // Don't double-wrap if already has a span after colon
        if (match.includes('geojson-type') || match.includes('json-string')) return match;

        // Check if it's a color value (hex) - use ::before for swatch via CSS class
        if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val)) {
          return `${colon}${space}<span class="json-string json-color" data-color="${val}" style="--swatch-color: ${val}">"${val}"</span>`;
        }

        return `${colon}${space}<span class="json-string">"${val}"</span>`;
      }
    );

    // Numbers after colon
    // IMPORTANT: Preserve original spacing by capturing and re-emitting whitespace
    result = result.replace(
      /(<span class="json-punctuation">:<\/span>)(\s*)(-?\d+\.?\d*(?:e[+-]?\d+)?)/gi,
      '$1$2<span class="json-number">$3</span>'
    );

    // Numbers in arrays (after [ or ,)
    result = result.replace(
      /(<span class="json-punctuation">[\[,]<\/span>)(\s*)(-?\d+\.?\d*(?:e[+-]?\d+)?)/gi,
      '$1$2<span class="json-number">$3</span>'
    );

    // Standalone numbers at start of line (coordinates arrays)
    result = result.replace(
      /^(\s*)(-?\d+\.?\d*(?:e[+-]?\d+)?)/gim,
      '$1<span class="json-number">$2</span>'
    );

    // Booleans - use ::before for checkbox via CSS class
    // IMPORTANT: Preserve original spacing by capturing and re-emitting whitespace
    result = result.replace(
      /(<span class="json-punctuation">:<\/span>)(\s*)(true|false)/g,
      (match, colon, space, val) => {
        const checkedClass = val === 'true' ? ' json-bool-true' : ' json-bool-false';
        return `${colon}${space}<span class="json-boolean${checkedClass}">${val}</span>`;
      }
    );

    // Null
    // IMPORTANT: Preserve original spacing by capturing and re-emitting whitespace
    result = result.replace(
      /(<span class="json-punctuation">:<\/span>)(\s*)(null)/g,
      '$1$2<span class="json-null">$3</span>'
    );
    
    // Collapsed bracket indicator - just add the class, CSS ::after adds the "...]" or "...}"
    if (collapsedBracket) {
      const bracketClass = collapsedBracket === '[' ? 'collapsed-bracket-array' : 'collapsed-bracket-object';
      // Replace the last punctuation span (the opening bracket) with collapsed style class
      result = result.replace(
        new RegExp(`<span class="json-punctuation">\\${collapsedBracket}<\\/span>$`),
        `<span class="${bracketClass}">${collapsedBracket}</span>`
      );
    }
    
    // Mark unrecognized text as error - text that's not inside a span and not just whitespace
    // This catches invalid JSON like unquoted strings, malformed values, etc.
    result = result.replace(
      /(<\/span>|^)([^<]+)(<span|$)/g,
      (match, before, text, after) => {
        // Skip if text is only whitespace or empty
        if (!text || /^\s*$/.test(text)) return match;
        // Check for unrecognized words/tokens (not whitespace, not just spaces/commas)
        // Keep whitespace as-is, wrap any non-whitespace unrecognized token
        const parts = text.split(/(\s+)/);
        let hasError = false;
        const processed = parts.map(part => {
          // If it's whitespace, keep it
          if (/^\s*$/.test(part)) return part;
          // Mark as error
          hasError = true;
          return `<span class="json-error">${part}</span>`;
        }).join('');
        return hasError ? before + processed + after : match;
      }
    );
    
    // Note: visibility is now handled at line level (has-visibility class on .line element)
    
    return result;
  }

  _validateGeoJSON(parsed) {
    const errors = [];
    
    if (!parsed.features) return errors;
    
    parsed.features.forEach((feature, i) => {
      if (feature.type !== 'Feature') {
        errors.push(`features[${i}]: type must be "Feature"`);
      }
      if (feature.geometry && feature.geometry.type) {
        if (!GEOMETRY_TYPES.includes(feature.geometry.type)) {
          errors.push(`features[${i}].geometry: invalid type "${feature.geometry.type}"`);
        }
      }
    });
    
    return errors;
  }

  // ========== Public API ==========
  
  set(features) {
    if (!Array.isArray(features)) throw new Error('set() expects an array');
    const formatted = features.map(f => JSON.stringify(f, null, 2)).join(',\n');
    this.setValue(formatted);
  }

  add(feature) {
    const features = this._parseFeatures();
    features.push(feature);
    this.set(features);
  }

  insertAt(feature, index) {
    const features = this._parseFeatures();
    const idx = index < 0 ? features.length + index : index;
    features.splice(Math.max(0, Math.min(idx, features.length)), 0, feature);
    this.set(features);
  }

  removeAt(index) {
    const features = this._parseFeatures();
    const idx = index < 0 ? features.length + index : index;
    if (idx >= 0 && idx < features.length) {
      const removed = features.splice(idx, 1)[0];
      this.set(features);
      return removed;
    }
    return undefined;
  }

  removeAll() {
    const removed = this._parseFeatures();
    this.lines = [];
    this.collapsedNodes.clear();
    this.hiddenFeatures.clear();
    this.updateModel();
    this.scheduleRender();
    this.updatePlaceholderVisibility();
    this.emitChange();
    return removed;
  }

  get(index) {
    const features = this._parseFeatures();
    const idx = index < 0 ? features.length + index : index;
    return features[idx];
  }

  getAll() {
    return this._parseFeatures();
  }

  emit() {
    this.emitChange();
  }

  _parseFeatures() {
    try {
      const content = this.lines.join('\n');
      if (!content.trim()) return [];
      return JSON.parse('[' + content + ']');
    } catch (e) {
      return [];
    }
  }
}

// Register custom element only if not already defined
if (!customElements.get('geojson-editor')) {
  customElements.define('geojson-editor', GeoJsonEditor);
}

export default GeoJsonEditor;
