import styles from './geojson-editor.css?inline';
import { getTemplate } from './geojson-editor.template.js';
import type { Feature, FeatureCollection } from 'geojson';

// ========== Imports from extracted modules ==========
import type {
  SetOptions,
  ThemeSettings
} from './types.js';

import type {
  CursorPosition,
  FeatureInput,
  LineMeta,
  VisibleLine,
  FeatureRange,
  NodeRangeInfo,
  EditorSnapshot,
  CollapsedZoneContext,
  CollapsedNodeInfo
} from './internal-types.js';

import {
  VERSION,
  RAW_COLORS,
  RE_CONTEXT_GEOMETRY,
  RE_CONTEXT_PROPERTIES,
  RE_CONTEXT_FEATURES,
  RE_ATTR_VALUE,
  RE_ATTR_VALUE_SINGLE,
  RE_NORMALIZE_COLOR,
  RE_COLOR_HEX,
  RE_NAMED_COLOR,
  RE_IS_FEATURE,
  RE_KV_MATCH,
  RE_ROOT_MATCH,
  RE_BRACKET_POS,
  RE_IS_WORD_CHAR,
  RE_ATTR_AND_BOOL_VALUE,
  RE_TO_KEBAB,
  RE_OPEN_BRACES,
  RE_CLOSE_BRACES,
  RE_OPEN_BRACKETS,
  RE_CLOSE_BRACKET
} from './constants.js';

import { createElement, getFeatureKey, countBrackets, parseSelectorToHostRule } from './utils.js';
import { validateGeoJSON, normalizeToFeatures } from './validation.js';
import { highlightSyntax, namedColorToHex } from './syntax-highlighter.js';

// Re-export public types
export type { SetOptions, ThemeConfig, ThemeSettings } from './types.js';

// Alias for minification
const _ce = createElement;

/**
 * GeoJSON Editor Web Component
 * Monaco-like architecture with virtualized line rendering
 */
class GeoJsonEditor extends HTMLElement {
  // ========== Model (Source of Truth) ==========
  lines: string[] = [];
  collapsedNodes: Set<string> = new Set();
  hiddenFeatures: Set<string> = new Set();

  // ========== Node ID Management ==========
  private _nodeIdCounter: number = 0;
  private _lineToNodeId: Map<number, string> = new Map();
  private _nodeIdToLines: Map<string, NodeRangeInfo> = new Map();

  // ========== Derived State (computed from model) ==========
  visibleLines: VisibleLine[] = [];
  lineMetadata: Map<number, LineMeta> = new Map();
  featureRanges: Map<string, FeatureRange> = new Map();

  // ========== View State ==========
  viewportHeight: number = 0;
  lineHeight: number = 19.5;
  bufferLines: number = 5;

  // ========== Render Cache ==========
  private _lastStartIndex: number = -1;
  private _lastEndIndex: number = -1;
  private _lastTotalLines: number = -1;
  private _scrollRaf: number | null = null;

  // ========== Cursor/Selection ==========
  cursorLine: number = 0;
  cursorColumn: number = 0;
  selectionStart: CursorPosition | null = null;
  selectionEnd: CursorPosition | null = null;

  // ========== Debounce ==========
  private renderTimer: number | null = null;
  private inputTimer: number | null = null;

  // ========== Theme ==========
  themes: ThemeSettings = { dark: {}, light: {} };

  // ========== Undo/Redo History ==========
  private _undoStack: EditorSnapshot[] = [];
  private _redoStack: EditorSnapshot[] = [];
  private _maxHistorySize: number = 100;
  private _lastActionTime: number = 0;
  private _lastActionType: string | null = null;
  private _groupingDelay: number = 500;

  // ========== Internal State ==========
  private _isSelecting: boolean = false;
  private _isComposing: boolean = false;
  private _blockRender: boolean = false;
  private _insertMode: boolean = true; // true = insert, false = overwrite
  private _charWidth: number | null = null;
  private _contextMapCache: Map<number, string> | null = null;
  private _contextMapLinesLength: number = 0;
  private _contextMapFirstLine: string | undefined = undefined;
  private _contextMapLastLine: string | undefined = undefined;

  // ========== Cached DOM Elements ==========
  private _viewport: HTMLElement | null = null;
  private _linesContainer: HTMLElement | null = null;
  private _scrollContent: HTMLElement | null = null;
  private _hiddenTextarea: HTMLTextAreaElement | null = null;
  private _gutterContent: HTMLElement | null = null;
  private _gutterScrollContent: HTMLElement | null = null;
  private _gutterScroll: HTMLElement | null = null;
  private _gutter: HTMLElement | null = null;
  private _clearBtn: HTMLButtonElement | null = null;
  private _editorWrapper: HTMLElement | null = null;
  private _placeholderLayer: HTMLElement | null = null;
  private _editorPrefix: HTMLElement | null = null;
  private _editorSuffix: HTMLElement | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  // ========== Render Cache ==========
  private _invalidateRenderCache() {
    this._lastStartIndex = -1;
    this._lastEndIndex = -1;
    this._lastTotalLines = -1;
  }

  // ========== Undo/Redo System ==========

  /**
   * Create a snapshot of current editor state
   * @returns {Object} State snapshot
   */
  private _createSnapshot() {
    return {
      lines: [...this.lines],
      cursorLine: this.cursorLine,
      cursorColumn: this.cursorColumn,
      timestamp: Date.now()
    };
  }

  /**
   * Restore editor state from snapshot
   */
  private _restoreSnapshot(snapshot: EditorSnapshot): void {
    this.lines = [...snapshot.lines];
    this.cursorLine = snapshot.cursorLine;
    this.cursorColumn = snapshot.cursorColumn;
    this.updateModel();
    this._invalidateRenderCache();
    this.scheduleRender();
    this.updatePlaceholderVisibility();
    this.emitChange();
  }

  /**
   * Save current state to undo stack before making changes
   * @param {string} actionType - Type of action (insert, delete, paste, etc.)
   */
  private _saveToHistory(actionType = 'edit') {
    const now = Date.now();
    const shouldGroup = (
      actionType === this._lastActionType &&
      (now - this._lastActionTime) < this._groupingDelay
    );

    // If same action type within grouping delay, don't create new entry
    if (!shouldGroup) {
      const snapshot = this._createSnapshot();
      this._undoStack.push(snapshot);

      // Limit stack size
      if (this._undoStack.length > this._maxHistorySize) {
        this._undoStack.shift();
      }

      // Clear redo stack on new action
      this._redoStack = [];
    }

    this._lastActionTime = now;
    this._lastActionType = actionType;
  }

  /**
   * Undo last action
   * @returns {boolean} True if undo was performed
   */
  undo() {
    if (this._undoStack.length === 0) return false;

    // Save current state to redo stack
    this._redoStack.push(this._createSnapshot());

    // Restore previous state
    const previousState = this._undoStack.pop();
    this._restoreSnapshot(previousState);

    // Reset action tracking
    this._lastActionType = null;
    this._lastActionTime = 0;

    return true;
  }

  /**
   * Redo previously undone action
   * @returns {boolean} True if redo was performed
   */
  redo() {
    if (this._redoStack.length === 0) return false;

    // Save current state to undo stack
    this._undoStack.push(this._createSnapshot());

    // Restore next state
    const nextState = this._redoStack.pop();
    this._restoreSnapshot(nextState);

    // Reset action tracking
    this._lastActionType = null;
    this._lastActionTime = 0;

    return true;
  }

  /**
   * Clear undo/redo history
   */
  clearHistory() {
    this._undoStack = [];
    this._redoStack = [];
    this._lastActionType = null;
    this._lastActionTime = 0;
  }

  /**
   * Check if undo is available
   * @returns {boolean}
   */
  canUndo() {
    return this._undoStack.length > 0;
  }

  /**
   * Check if redo is available
   * @returns {boolean}
   */
  canRedo() {
    return this._redoStack.length > 0;
  }

  // ========== Unique ID Generation ==========
  private _generateNodeId() {
    return `node_${++this._nodeIdCounter}`;
  }

  /**
   * Check if a line is inside a collapsed node (hidden lines between opening and closing)
   */
  private _getCollapsedRangeForLine(lineIndex: number): CollapsedNodeInfo | null {
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
   */
  private _getCollapsedClosingLine(lineIndex: number): CollapsedNodeInfo | null {
    for (const [nodeId, info] of this._nodeIdToLines) {
      if (this.collapsedNodes.has(nodeId) && lineIndex === info.endLine) {
        return { nodeId, ...info };
      }
    }
    return null;
  }

  /**
   * Get the position of the closing bracket on a line
   */
  private _getClosingBracketPos(line: string): number {
    // Find the last ] or } on the line
    const lastBracket = Math.max(line.lastIndexOf(']'), line.lastIndexOf('}'));
    return lastBracket;
  }

  /**
   * Check if cursor is on the opening line of a collapsed node
   */
  private _getCollapsedNodeAtLine(lineIndex: number): CollapsedNodeInfo | null {
    const nodeId = this._lineToNodeId.get(lineIndex);
    if (nodeId && this.collapsedNodes.has(nodeId)) {
      const info = this._nodeIdToLines.get(nodeId);
      if (info) return { nodeId, ...info };
    }
    return null;
  }

  /**
   * Find the innermost expanded node that contains the given line
   * Used for Shift+Tab to collapse the parent node from anywhere inside it
   */
  private _getContainingExpandedNode(lineIndex: number): CollapsedNodeInfo | null {
    let bestMatch: CollapsedNodeInfo | null = null;

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
   */
  private _deleteCollapsedNode(range: CollapsedNodeInfo): void {
    this._saveToHistory('delete');

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
  private _rebuildNodeIdMappings() {
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
      const kvMatch = line.match(RE_KV_MATCH);
      // Also match standalone { or {, (root Feature objects)
      const rootMatch = !kvMatch && line.match(RE_ROOT_MATCH);
      
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
      const counts = countBrackets(rest, openBracket);
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
    this._cacheElements();
    this.setupEventListeners();
    this.updatePrefixSuffix();
    this.updateThemeCSS();

    if (this.value) {
      this.setValue(this.value);
    }
    this.updatePlaceholderVisibility();
  }

  disconnectedCallback(): void {
    if (this.renderTimer) clearTimeout(this.renderTimer);
    if (this.inputTimer) clearTimeout(this.inputTimer);

    // Cleanup color picker
    const colorPicker = document.querySelector('.geojson-color-picker-input') as HTMLInputElement & { _closeListener?: EventListener };
    if (colorPicker) {
      if (colorPicker._closeListener) {
        document.removeEventListener('click', colorPicker._closeListener, true);
      }
      colorPicker.remove();
    }
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
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
    const styleEl = _ce('style');
    styleEl.textContent = styles;
    
    const template = _ce('div');
    template.innerHTML = getTemplate(this.placeholder, VERSION);
    
    this.shadowRoot.innerHTML = '';
    this.shadowRoot.appendChild(styleEl);
    while (template.firstChild) {
      this.shadowRoot.appendChild(template.firstChild);
    }
  }

  // ========== DOM Element Cache ==========
  private _cacheElements() {
    this._viewport = this.shadowRoot.getElementById('viewport');
    this._linesContainer = this.shadowRoot.getElementById('linesContainer');
    this._scrollContent = this.shadowRoot.getElementById('scrollContent');
    this._hiddenTextarea = this.shadowRoot.getElementById('hiddenTextarea') as HTMLTextAreaElement;
    this._gutterContent = this.shadowRoot.getElementById('gutterContent');
    this._gutterScrollContent = this.shadowRoot.getElementById('gutterScrollContent');
    this._gutterScroll = this.shadowRoot.getElementById('gutterScroll');
    this._gutter = this.shadowRoot.querySelector('.gutter');
    this._clearBtn = this.shadowRoot.getElementById('clearBtn') as HTMLButtonElement;
    this._editorWrapper = this.shadowRoot.querySelector('.editor-wrapper');
    this._placeholderLayer = this.shadowRoot.getElementById('placeholderLayer');
    this._editorPrefix = this.shadowRoot.getElementById('editorPrefix');
    this._editorSuffix = this.shadowRoot.getElementById('editorSuffix');
  }

  // ========== Event Listeners ==========
  setupEventListeners() {
    const hiddenTextarea = this._hiddenTextarea;
    const viewport = this._viewport;
    const gutterContent = this._gutterContent;
    const gutter = this._gutter;
    const clearBtn = this._clearBtn;
    const editorWrapper = this._editorWrapper;

    // Mouse selection state
    this._isSelecting = false;

    // Focus hidden textarea when clicking viewport
    // Editor inline control clicks (color swatches, checkboxes, visibility icons)
    // Use capture phase to intercept before mousedown
    viewport.addEventListener('click', (e) => {
      this.handleEditorClick(e);
    }, true);

    viewport.addEventListener('mousedown', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Skip if clicking on visibility pseudo-element (line-level)
      const lineEl = target.closest('.line.has-visibility');
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
      if (target.classList.contains('json-color') ||
          target.classList.contains('json-boolean')) {
        const rect = target.getBoundingClientRect();
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
      this._invalidateRenderCache();
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
      
      this._invalidateRenderCache();
      this.scheduleRender();
    });
    
    // Mouse up to end selection
    document.addEventListener('mouseup', () => {
      this._isSelecting = false;
    });

    // Focus/blur handling to show/hide cursor
    hiddenTextarea.addEventListener('focus', () => {
      editorWrapper.classList.add('focused');
      this._invalidateRenderCache(); // Force re-render to show cursor
      this.scheduleRender();
    });

    hiddenTextarea.addEventListener('blur', () => {
      editorWrapper.classList.remove('focused');
      this._invalidateRenderCache(); // Force re-render to hide cursor
      this.scheduleRender();
    });

    // Scroll handling
    let isRendering = false;
    viewport.addEventListener('scroll', () => {
      if (isRendering) return;
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
    gutter.addEventListener('wheel', (e: WheelEvent) => {
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
  setValue(value: string | null, autoCollapse = true): void {
    // Save to history only if there's existing content
    if (this.lines.length > 0) {
      this._saveToHistory('setValue');
    }

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

    // Auto-collapse coordinates (unless disabled)
    if (autoCollapse && this.lines.length > 0) {
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
    // Invalidate context map cache since content changed
    this._contextMapCache = null;

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
        
        if (!inFeature && RE_IS_FEATURE.test(line)) {
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
            const counts = countBrackets(this.lines[k], '{');
            if (k === startLine) {
              braceDepth += (counts.open - 1) - counts.close;
            } else {
              braceDepth += counts.open - counts.close;
            }
          }
          
          if (featureIndex < parsed.features.length) {
            currentFeatureKey = getFeatureKey(parsed.features[featureIndex]);
          }
        } else if (inFeature) {
          const counts = countBrackets(line, '{');
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
      const meta: LineMeta = {
        colors: [],
        booleans: [],
        collapseButton: null,
        visibilityButton: null,
        isHidden: false,
        isCollapsed: false,
        featureKey: null
      };
      
      // Detect colors and booleans in a single pass
      RE_ATTR_VALUE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = RE_ATTR_VALUE.exec(line)) !== null) {
        const [, attributeName, strValue, boolValue] = match;
        if (boolValue) {
          // Boolean value
          meta.booleans.push({ attributeName, value: boolValue === 'true' });
        } else if (strValue) {
          // String value - check if it's a color
          if (RE_COLOR_HEX.test(strValue)) {
            // Hex color (#fff or #ffffff)
            meta.colors.push({ attributeName, color: strValue });
          } else if (RE_NAMED_COLOR.test(strValue) && RAW_COLORS.includes(strValue.toLowerCase())) {
            // Named CSS color (red, blue, etc.)
            meta.colors.push({ attributeName, color: strValue });
          }
        }
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
    this._invalidateRenderCache();
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
    const viewport = this._viewport;
    const linesContainer = this._linesContainer;
    const scrollContent = this._scrollContent;

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
    const isFocused = this._editorWrapper?.classList.contains('focused');
    
    // Render visible lines
    const fragment = document.createDocumentFragment();
    
    // Handle empty editor: render an empty line with cursor
    if (totalLines === 0) {
      const lineEl = _ce('div');
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
      
      const lineEl = _ce('div');
      lineEl.className = 'line';
      lineEl.dataset.lineIndex = String(lineData.index);
      
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
      let html = highlightSyntax(lineData.content, context, lineData.meta);
      
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
   * In overwrite mode, cursor is a block covering the next character
   */
  private _insertCursor(column: number): string {
    const charWidth = this._getCharWidth();
    const left = column * charWidth;
    if (this._insertMode) {
      // Insert mode: thin line cursor
      return `<span class="cursor" style="left: ${left}px"></span>`;
    } else {
      // Overwrite mode: block cursor covering the character
      return `<span class="cursor cursor-block" style="left: ${left}px; width: ${charWidth}px"></span>`;
    }
  }

  /**
   * Add selection highlight to a line
   */
  private _addSelectionHighlight(html: string, lineIndex: number, content: string): string {
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
  private _getCharWidth() {
    if (!this._charWidth) {
      const canvas = _ce('canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      // Use exact same font as CSS: 'Courier New', Courier, monospace at 13px
      ctx.font = "13px 'Courier New', Courier, monospace";
      this._charWidth = ctx.measureText('M').width;
    }
    return this._charWidth;
  }

  renderGutter(startIndex: number, endIndex: number): void {
    const gutterContent = this._gutterContent;
    const gutterScrollContent = this._gutterScrollContent;
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
      
      const gutterLine = _ce('div');
      gutterLine.className = 'gutter-line';
      
      const meta = lineData.meta;
      
      // Line number first
      const lineNum = _ce('span');
      lineNum.className = 'line-number';
      lineNum.textContent = String(lineData.index + 1);
      gutterLine.appendChild(lineNum);
      
      // Collapse column (always present for alignment)
      const collapseCol = _ce('div');
      collapseCol.className = 'collapse-column';
      if (meta?.collapseButton) {
        const btn = _ce('div');
        btn.className = 'collapse-button' + (meta.collapseButton.isCollapsed ? ' collapsed' : '');
        btn.textContent = meta.collapseButton.isCollapsed ? '›' : '⌄';
        btn.dataset.line = String(lineData.index);
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
    if (this._gutterScroll && this._viewport) {
      // Sync gutter scroll position with viewport
      this._gutterScroll.scrollTop = this._viewport.scrollTop;
    }
  }

  // ========== Input Handling ==========

  handleInput(): void {
    const textarea = this._hiddenTextarea;
    const inputValue = textarea?.value;

    if (!inputValue) return;

    // Delete selection first if any (replace selection with input)
    if (this._hasSelection()) {
      this._deleteSelection();
    }

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
      const bracketPos = line.search(RE_BRACKET_POS);
      if (this.cursorColumn > bracketPos) {
        textarea.value = '';
        return;
      }
    }

    // Insert or overwrite the input at cursor position
    if (this.cursorLine < this.lines.length) {
      const line = this.lines[this.cursorLine];
      const before = line.substring(0, this.cursorColumn);

      // Handle newlines in input
      const inputLines = inputValue.split('\n');
      if (inputLines.length === 1) {
        // Single line input: insert or overwrite mode
        if (this._insertMode) {
          // Insert mode: keep text after cursor
          const after = line.substring(this.cursorColumn);
          this.lines[this.cursorLine] = before + inputValue + after;
        } else {
          // Overwrite mode: replace characters after cursor
          const after = line.substring(this.cursorColumn + inputValue.length);
          this.lines[this.cursorLine] = before + inputValue + after;
        }
        this.cursorColumn += inputValue.length;
      } else {
        // Multi-line input: always insert mode
        const after = line.substring(this.cursorColumn);
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

  handleKeydown(e: KeyboardEvent): void {
    // Build context for collapsed zone detection
    const ctx: CollapsedZoneContext = {
      inCollapsedZone: this._getCollapsedRangeForLine(this.cursorLine),
      onCollapsedNode: this._getCollapsedNodeAtLine(this.cursorLine),
      onClosingLine: this._getCollapsedClosingLine(this.cursorLine)
    };

    // Lookup table for key handlers
    const keyHandlers: Record<string, () => void> = {
      'Enter': () => this._handleEnter(ctx),
      'Backspace': () => this._handleBackspace(ctx),
      'Delete': () => this._handleDelete(ctx),
      'ArrowUp': () => this._handleArrowKey(-1, 0, e.shiftKey, e.ctrlKey || e.metaKey),
      'ArrowDown': () => this._handleArrowKey(1, 0, e.shiftKey, e.ctrlKey || e.metaKey),
      'ArrowLeft': () => this._handleArrowKey(0, -1, e.shiftKey, e.ctrlKey || e.metaKey),
      'ArrowRight': () => this._handleArrowKey(0, 1, e.shiftKey, e.ctrlKey || e.metaKey),
      'Home': () => this._handleHomeEnd('home', e.shiftKey, ctx.onClosingLine),
      'End': () => this._handleHomeEnd('end', e.shiftKey, ctx.onClosingLine),
      'Tab': () => this._handleTab(e.shiftKey, ctx),
      'Insert': () => { this._insertMode = !this._insertMode; this.scheduleRender(); }
    };

    // Modifier key handlers (Ctrl/Cmd)
    const modifierHandlers: Record<string, () => void | boolean | Promise<boolean>> = {
      'a': () => this._selectAll(),
      'z': () => e.shiftKey ? this.redo() : this.undo(),
      'y': () => this.redo(),
      's': () => this.save(),
      'o': () => !this.hasAttribute('readonly') && this.open()
    };

    // Check for direct key match
    if (keyHandlers[e.key]) {
      e.preventDefault();
      keyHandlers[e.key]();
      return;
    }

    // Check for modifier key combinations
    if ((e.ctrlKey || e.metaKey) && modifierHandlers[e.key]) {
      e.preventDefault();
      modifierHandlers[e.key]();
    }
  }

  private _handleEnter(ctx: CollapsedZoneContext): void {
    // Block in collapsed zones
    if (ctx.onCollapsedNode || ctx.inCollapsedZone) return;
    // On closing line, before bracket -> block
    if (ctx.onClosingLine) {
      const line = this.lines[this.cursorLine];
      const bracketPos = this._getClosingBracketPos(line);
      if (bracketPos >= 0 && this.cursorColumn <= bracketPos) {
        return;
      }
    }
    this.insertNewline();
  }

  private _handleBackspace(ctx: CollapsedZoneContext): void {
    // Delete selection if any
    if (this._hasSelection()) {
      this._deleteSelection();
      this.formatAndUpdate();
      return;
    }
    // On closing line
    if (ctx.onClosingLine) {
      const line = this.lines[this.cursorLine];
      const bracketPos = this._getClosingBracketPos(line);
      if (bracketPos >= 0 && this.cursorColumn > bracketPos + 1) {
        this.deleteBackward();
        return;
      }
      this._deleteCollapsedNode(ctx.onClosingLine);
      return;
    }
    // If on collapsed node opening line at position 0, delete whole node
    if (ctx.onCollapsedNode && this.cursorColumn === 0) {
      this._deleteCollapsedNode(ctx.onCollapsedNode);
      return;
    }
    // Block inside collapsed zones
    if (ctx.inCollapsedZone) return;
    // On opening line, allow editing before bracket
    if (ctx.onCollapsedNode) {
      const line = this.lines[this.cursorLine];
      const bracketPos = line.search(RE_BRACKET_POS);
      if (this.cursorColumn > bracketPos + 1) {
        this._deleteCollapsedNode(ctx.onCollapsedNode);
        return;
      }
    }
    this.deleteBackward();
  }

  private _handleDelete(ctx: CollapsedZoneContext): void {
    // Delete selection if any
    if (this._hasSelection()) {
      this._deleteSelection();
      this.formatAndUpdate();
      return;
    }
    // On closing line
    if (ctx.onClosingLine) {
      const line = this.lines[this.cursorLine];
      const bracketPos = this._getClosingBracketPos(line);
      if (bracketPos >= 0 && this.cursorColumn > bracketPos) {
        this.deleteForward();
        return;
      }
      this._deleteCollapsedNode(ctx.onClosingLine);
      return;
    }
    // If on collapsed node opening line
    if (ctx.onCollapsedNode) {
      const line = this.lines[this.cursorLine];
      const bracketPos = line.search(RE_BRACKET_POS);
      if (this.cursorColumn > bracketPos) {
        this._deleteCollapsedNode(ctx.onCollapsedNode);
        return;
      }
    }
    // Block inside collapsed zones
    if (ctx.inCollapsedZone) return;
    this.deleteForward();
  }

  private _handleTab(isShiftKey: boolean, ctx: CollapsedZoneContext): void {
    // Shift+Tab: collapse the containing expanded node
    if (isShiftKey) {
      const containingNode = this._getContainingExpandedNode(this.cursorLine);
      if (containingNode) {
        const startLine = this.lines[containingNode.startLine];
        const bracketPos = startLine.search(RE_BRACKET_POS);
        this.toggleCollapse(containingNode.nodeId);
        this.cursorLine = containingNode.startLine;
        this.cursorColumn = bracketPos >= 0 ? bracketPos + 1 : startLine.length;
        this._clearSelection();
        this._scrollToCursor();
      }
      return;
    }
    // Tab: expand collapsed node if on one
    if (ctx.onCollapsedNode) {
      this.toggleCollapse(ctx.onCollapsedNode.nodeId);
      return;
    }
    if (ctx.onClosingLine) {
      this.toggleCollapse(ctx.onClosingLine.nodeId);
    }
  }

  insertNewline() {
    this._saveToHistory('newline');

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
    this._saveToHistory('delete');

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
    this._saveToHistory('delete');

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
  moveCursorSkipCollapsed(deltaLine: number): void {
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
      } else {
        break; // Not in a collapsed zone, stop
      }
    }
    
    this.cursorLine = Math.max(0, Math.min(this.lines.length - 1, targetLine));
    
    // Clamp column to line length
    const maxCol = this.lines[this.cursorLine]?.length || 0;
    this.cursorColumn = Math.min(this.cursorColumn, maxCol);
    
    this._invalidateRenderCache();
    this._scrollToCursor();
    this.scheduleRender();
  }

  /**
   * Move cursor horizontally with smart navigation around collapsed nodes
   */
  moveCursorHorizontal(delta: number): void {
    if (delta > 0) {
      this._moveCursorRight();
    } else {
      this._moveCursorLeft();
    }
    this._invalidateRenderCache();
    this._scrollToCursor();
    this.scheduleRender();
  }

  private _moveCursorRight() {
    const line = this.lines[this.cursorLine];
    const onCollapsed = this._getCollapsedNodeAtLine(this.cursorLine);
    const onClosingLine = this._getCollapsedClosingLine(this.cursorLine);

    if (onClosingLine) {
      const bracketPos = this._getClosingBracketPos(line);
      if (this.cursorColumn < bracketPos) {
        this.cursorColumn = bracketPos;
      } else if (this.cursorColumn >= line.length) {
        if (this.cursorLine < this.lines.length - 1) {
          this.cursorLine++;
          this.cursorColumn = 0;
        }
      } else {
        this.cursorColumn++;
      }
    } else if (onCollapsed) {
      const bracketPos = line.search(RE_BRACKET_POS);
      if (this.cursorColumn < bracketPos) {
        this.cursorColumn++;
      } else if (this.cursorColumn === bracketPos) {
        this.cursorColumn = bracketPos + 1;
      } else {
        this.cursorLine = onCollapsed.endLine;
        this.cursorColumn = this._getClosingBracketPos(this.lines[this.cursorLine]);
      }
    } else if (this.cursorColumn >= line.length) {
      if (this.cursorLine < this.lines.length - 1) {
        this.cursorLine++;
        this.cursorColumn = 0;
        const collapsed = this._getCollapsedRangeForLine(this.cursorLine);
        if (collapsed) {
          this.cursorLine = collapsed.endLine;
          this.cursorColumn = 0;
        }
      }
    } else {
      this.cursorColumn++;
    }
  }

  private _moveCursorLeft() {
    const line = this.lines[this.cursorLine];
    const onCollapsed = this._getCollapsedNodeAtLine(this.cursorLine);
    const onClosingLine = this._getCollapsedClosingLine(this.cursorLine);

    if (onClosingLine) {
      const bracketPos = this._getClosingBracketPos(line);
      if (this.cursorColumn > bracketPos + 1) {
        this.cursorColumn--;
      } else {
        // Jump to opening line after bracket
        this.cursorLine = onClosingLine.startLine;
        const openLine = this.lines[this.cursorLine];
        this.cursorColumn = openLine.search(RE_BRACKET_POS) + 1;
      }
    } else if (onCollapsed) {
      const bracketPos = line.search(RE_BRACKET_POS);
      if (this.cursorColumn > bracketPos + 1) {
        this.cursorColumn = bracketPos + 1;
      } else if (this.cursorColumn === bracketPos + 1) {
        this.cursorColumn = bracketPos;
      } else if (this.cursorColumn > 0) {
        this.cursorColumn--;
      } else if (this.cursorLine > 0) {
        this.cursorLine--;
        this.cursorColumn = this.lines[this.cursorLine]?.length || 0;
      }
    } else if (this.cursorColumn > 0) {
      this.cursorColumn--;
    } else if (this.cursorLine > 0) {
      this.cursorLine--;
      const closing = this._getCollapsedClosingLine(this.cursorLine);
      if (closing) {
        this.cursorColumn = this.lines[this.cursorLine]?.length || 0;
      } else {
        const collapsed = this._getCollapsedRangeForLine(this.cursorLine);
        if (collapsed) {
          this.cursorLine = collapsed.startLine;
          const openLine = this.lines[this.cursorLine];
          this.cursorColumn = openLine.search(RE_BRACKET_POS) + 1;
        } else {
          this.cursorColumn = this.lines[this.cursorLine]?.length || 0;
        }
      }
    }
  }

  /**
   * Scroll viewport to ensure cursor is visible
   */
  private _scrollToCursor() {
    const viewport = this._viewport;
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
   * Handle arrow key with optional selection and word jump
   */
  private _handleArrowKey(deltaLine: number, deltaCol: number, isShift: boolean, isCtrl = false): void {
    // Start selection if shift is pressed and no selection exists
    if (isShift && !this.selectionStart) {
      this.selectionStart = { line: this.cursorLine, column: this.cursorColumn };
    }

    // Move cursor
    if (deltaLine !== 0) {
      this.moveCursorSkipCollapsed(deltaLine);
    } else if (deltaCol !== 0) {
      if (isCtrl) {
        // Word-by-word movement
        this._moveCursorByWord(deltaCol);
      } else {
        this.moveCursorHorizontal(deltaCol);
      }
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
   * Move cursor by word (Ctrl+Arrow)
   * Behavior matches VSCode/Monaco:
   * - Ctrl+Right: move to end of current word, or start of next word
   * - Ctrl+Left: move to start of current word, or start of previous word
   */
  private _moveCursorByWord(direction: number): void {
    const line = this.lines[this.cursorLine] || '';
    // Word character: alphanumeric, underscore, or hyphen (for kebab-case identifiers)
    const isWordChar = (ch: string) => RE_IS_WORD_CHAR.test(ch);

    // Check if we're on a collapsed node's opening line
    const onCollapsed = this._getCollapsedNodeAtLine(this.cursorLine);

    if (direction > 0) {
      // Move right
      let pos = this.cursorColumn;

      // If on collapsed node opening line and cursor is at/after the bracket, jump to closing line
      if (onCollapsed) {
        const bracketPos = line.search(RE_BRACKET_POS);
        if (bracketPos >= 0 && pos >= bracketPos) {
          this.cursorLine = onCollapsed.endLine;
          this.cursorColumn = (this.lines[this.cursorLine] || '').length;
          this._invalidateRenderCache();
          this._scrollToCursor();
          this.scheduleRender();
          return;
        }
      }

      if (pos >= line.length) {
        // At end of line, move to start of next visible line
        if (this.cursorLine < this.lines.length - 1) {
          let nextLine = this.cursorLine + 1;
          // Skip collapsed zones
          const collapsed = this._getCollapsedRangeForLine(nextLine);
          if (collapsed) {
            nextLine = collapsed.endLine;
          }
          this.cursorLine = Math.min(nextLine, this.lines.length - 1);
          this.cursorColumn = 0;
        }
      } else if (isWordChar(line[pos])) {
        // Inside a word: move to end of word
        while (pos < line.length && isWordChar(line[pos])) {
          pos++;
        }
        this.cursorColumn = pos;
      } else {
        // On non-word char: skip non-word chars only (stop at start of next word)
        while (pos < line.length && !isWordChar(line[pos])) {
          pos++;
        }
        this.cursorColumn = pos;
      }
    } else {
      // Move left
      let pos = this.cursorColumn;

      // Check if we're on closing line of a collapsed node
      const onClosingLine = this._getCollapsedClosingLine(this.cursorLine);
      if (onClosingLine) {
        const bracketPos = this._getClosingBracketPos(line);
        if (bracketPos >= 0 && pos <= bracketPos + 1) {
          // Jump to opening line, after the bracket
          this.cursorLine = onClosingLine.startLine;
          const openLine = this.lines[this.cursorLine] || '';
          const openBracketPos = openLine.search(RE_BRACKET_POS);
          this.cursorColumn = openBracketPos >= 0 ? openBracketPos : 0;
          this._invalidateRenderCache();
          this._scrollToCursor();
          this.scheduleRender();
          return;
        }
      }

      if (pos === 0) {
        // At start of line, move to end of previous visible line
        if (this.cursorLine > 0) {
          let prevLine = this.cursorLine - 1;
          // Skip collapsed zones
          const collapsed = this._getCollapsedRangeForLine(prevLine);
          if (collapsed) {
            prevLine = collapsed.startLine;
          }
          this.cursorLine = Math.max(prevLine, 0);
          this.cursorColumn = this.lines[this.cursorLine].length;
        }
      } else if (pos > 0 && isWordChar(line[pos - 1])) {
        // Just after a word char: move to start of word
        while (pos > 0 && isWordChar(line[pos - 1])) {
          pos--;
        }
        this.cursorColumn = pos;
      } else {
        // On or after non-word char: skip non-word chars, then skip word
        while (pos > 0 && !isWordChar(line[pos - 1])) {
          pos--;
        }
        while (pos > 0 && isWordChar(line[pos - 1])) {
          pos--;
        }
        this.cursorColumn = pos;
      }
    }

    this._invalidateRenderCache();
    this._scrollToCursor();
    this.scheduleRender();
  }

  /**
   * Handle Home/End with optional selection
   */
  private _handleHomeEnd(key: string, isShift: boolean, onClosingLine: CollapsedNodeInfo | null): void {
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
    
    this._invalidateRenderCache();
    this._scrollToCursor();
    this.scheduleRender();
  }

  /**
   * Select all content
   */
  private _selectAll() {
    this.selectionStart = { line: 0, column: 0 };
    const lastLine = this.lines.length - 1;
    this.selectionEnd = { line: lastLine, column: this.lines[lastLine]?.length || 0 };
    this.cursorLine = lastLine;
    this.cursorColumn = this.lines[lastLine]?.length || 0;
    
    this._invalidateRenderCache();
    this._scrollToCursor();
    this.scheduleRender();
  }

  /**
   * Get selected text
   */
  private _getSelectedText() {
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
  private _normalizeSelection() {
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
  private _hasSelection() {
    if (!this.selectionStart || !this.selectionEnd) return false;
    return this.selectionStart.line !== this.selectionEnd.line ||
           this.selectionStart.column !== this.selectionEnd.column;
  }

  /**
   * Clear the current selection
   */
  private _clearSelection() {
    this.selectionStart = null;
    this.selectionEnd = null;
  }

  /**
   * Delete selected text
   */
  private _deleteSelection() {
    if (!this._hasSelection()) return false;

    this._saveToHistory('delete');

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

  insertText(text: string): void {
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
      const bracketPos = line.search(RE_BRACKET_POS);
      if (this.cursorColumn > bracketPos) return;
    }

    // Save to history before making changes
    this._saveToHistory('insert');

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

  handlePaste(e: ClipboardEvent): void {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    const wasEmpty = this.lines.length === 0;

    // Try to parse as GeoJSON and normalize
    try {
      const parsed = JSON.parse(text);
      const features = normalizeToFeatures(parsed);
      // Valid GeoJSON - insert formatted features
      const formatted = features.map(f => JSON.stringify(f, null, 2)).join(',\n');
      this.insertText(formatted);
    } catch {
      // Invalid GeoJSON - fallback to raw text insertion
      this.insertText(text);
    }

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

  handleCopy(e: ClipboardEvent): void {
    e.preventDefault();
    // Copy selected text if there's a selection, otherwise copy all
    if (this._hasSelection()) {
      e.clipboardData.setData('text/plain', this._getSelectedText());
    } else {
      e.clipboardData.setData('text/plain', this.getContent());
    }
  }

  handleCut(e: ClipboardEvent): void {
    e.preventDefault();
    if (this._hasSelection()) {
      e.clipboardData.setData('text/plain', this._getSelectedText());
      this._saveToHistory('cut');
      this._deleteSelection();
      this.formatAndUpdate();
    } else {
      // Cut all content
      e.clipboardData.setData('text/plain', this.getContent());
      this._saveToHistory('cut');
      this.lines = [];
      this.cursorLine = 0;
      this.cursorColumn = 0;
      this.formatAndUpdate();
    }
  }

  /**
   * Get line/column position from mouse event
   */
  private _getPositionFromClick(e: MouseEvent): { line: number; column: number } {
    const viewport = this._viewport;
    const linesContainer = this._linesContainer;
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
          // Match any string attribute (hex or named color)
          // RE_ATTR_VALUE_SINGLE captures: [1] attributeName, [2] stringValue
          const match = line.match(RE_ATTR_VALUE_SINGLE);
          if (match && match[1]) {
            this.showColorPicker(e.target as HTMLElement, lineIndex, color, match[1]);
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
          const match = line.match(RE_ATTR_AND_BOOL_VALUE);
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
    this._invalidateRenderCache(); // Force re-render
    this.scheduleRender();
  }

  autoCollapseCoordinates() {
    this._applyCollapsedOption(['coordinates']);
  }

  /**
   * Helper to apply collapsed option from API methods
   * @param {object} options - Options object with optional collapsed property
   * @param {array} features - Features array for function mode
   */
  private _applyCollapsedFromOptions(options, features) {
    const collapsed = options.collapsed !== undefined ? options.collapsed : ['coordinates'];
    if (collapsed && (Array.isArray(collapsed) ? collapsed.length > 0 : true)) {
      this._applyCollapsedOption(collapsed, features);
    }
  }

  /**
   * Apply collapsed option to nodes
   * @param {string[]|function} collapsed - Attributes to collapse or function returning them
   * @param {array} features - Features array for function mode (optional)
   */
  private _applyCollapsedOption(collapsed, features = null) {
    const ranges = this._findCollapsibleRanges();

    // Group ranges by feature (root nodes)
    const featureRanges = ranges.filter(r => r.isRootFeature);

    // Determine which attributes to collapse per feature
    for (const range of ranges) {
      let shouldCollapse = false;

      if (typeof collapsed === 'function') {
        // Find which feature this range belongs to
        const featureIndex = featureRanges.findIndex(fr =>
          range.startLine >= fr.startLine && range.endLine <= fr.endLine
        );
        const feature = features?.[featureIndex] || null;
        const collapsedAttrs = collapsed(feature, featureIndex);

        // Check if this range should be collapsed
        if (range.isRootFeature) {
          shouldCollapse = collapsedAttrs.includes('$root');
        } else {
          shouldCollapse = collapsedAttrs.includes(range.nodeKey);
        }
      } else if (Array.isArray(collapsed)) {
        // Static list
        if (range.isRootFeature) {
          shouldCollapse = collapsed.includes('$root');
        } else {
          shouldCollapse = collapsed.includes(range.nodeKey);
        }
      }

      if (shouldCollapse) {
        this.collapsedNodes.add(range.nodeId);
      }
    }

    // Rebuild everything to ensure consistent state after collapse changes
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

  showColorPicker(indicator: HTMLElement, line: number, currentColor: string, attributeName: string) {
    // Remove existing picker and anchor
    const existing = document.querySelector('.geojson-color-picker-anchor');
    if (existing) {
      existing.remove();
    }

    // Create an anchor element at the pseudo-element position
    // The browser will position the color picker popup relative to this
    const anchor = _ce('div');
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

    const colorInput = _ce('input') as HTMLInputElement & { _closeListener?: EventListener };
    colorInput.type = 'color';
    // Convert color to hex format for the color picker
    let hexColor = currentColor;
    if (!currentColor.startsWith('#')) {
      // Named color - convert to hex
      hexColor = namedColorToHex(currentColor) || '#000000';
    } else {
      // Expand 3-char hex to 6-char (#abc -> #aabbcc)
      hexColor = currentColor.replace(RE_NORMALIZE_COLOR, '#$1$1$2$2$3$3');
    }
    colorInput.value = hexColor;
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

    colorInput.addEventListener('input', (e: Event) => {
      this.updateColorValue(line, (e.target as HTMLInputElement).value, attributeName);
    });

    const closeOnClickOutside = (e: Event) => {
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

  updateColorValue(line: number, newColor: string, attributeName: string) {
    // Match both hex colors (#xxx, #xxxxxx) and named colors (red, blue, etc.)
    const regex = new RegExp(`"${attributeName}"\\s*:\\s*"(?:#[0-9a-fA-F]{3,6}|[a-zA-Z]+)"`);
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
          const key = getFeatureKey(feature);
          return !this.hiddenFeatures.has(key);
        });
      }
      
      // Validate
      const errors = validateGeoJSON(parsed);
      
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
    // Use readOnly instead of disabled to allow text selection for copying
    if (this._hiddenTextarea) this._hiddenTextarea.readOnly = this.readonly;
    if (this._clearBtn) this._clearBtn.hidden = this.readonly;
  }

  updatePlaceholderVisibility() {
    if (this._placeholderLayer) {
      this._placeholderLayer.style.display = this.lines.length > 0 ? 'none' : 'block';
    }
  }

  updatePlaceholderContent() {
    if (this._placeholderLayer) {
      this._placeholderLayer.textContent = this.placeholder;
    }
    this.updatePlaceholderVisibility();
  }

  updatePrefixSuffix() {
    if (this._editorPrefix) this._editorPrefix.textContent = this.prefix;
    if (this._editorSuffix) this._editorSuffix.textContent = this.suffix;
  }

  // ========== Theme ==========
  
  updateThemeCSS() {
    const darkSelector = this.getAttribute('dark-selector') || '.dark';
    const darkRule = parseSelectorToHostRule(darkSelector);

    let themeStyle = this.shadowRoot.getElementById('theme-styles') as HTMLStyleElement;
    if (!themeStyle) {
      themeStyle = _ce('style') as HTMLStyleElement;
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
    
    RE_TO_KEBAB.lastIndex = 0;
    const toKebab = (str) => str.replace(RE_TO_KEBAB, '-$1').toLowerCase();
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

  setTheme(theme: ThemeSettings): void {
    if (theme.dark) this.themes.dark = { ...this.themes.dark, ...theme.dark };
    if (theme.light) this.themes.light = { ...this.themes.light, ...theme.light };
    this.updateThemeCSS();
  }

  resetTheme(): void {
    this.themes = { dark: {}, light: {} };
    this.updateThemeCSS();
  }

  getTheme(): ThemeSettings {
    return { ...this.themes };
  }

  /**
   * Find all collapsible ranges using the mappings built by _rebuildNodeIdMappings
   * This method only READS the existing mappings, it doesn't create new IDs
   */
  private _findCollapsibleRanges() {
    const ranges = [];
    
    // Simply iterate through the existing mappings
    for (const [lineIndex, nodeId] of this._lineToNodeId) {
      const rangeInfo = this._nodeIdToLines.get(nodeId);
      if (!rangeInfo) continue;
      
      const line = this.lines[lineIndex];
      if (!line) continue;
      
      // Match "key": { or "key": [
      const kvMatch = line.match(RE_KV_MATCH);
      // Also match standalone { or [ (root Feature objects)
      const rootMatch = !kvMatch && line.match(RE_ROOT_MATCH);
      
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

  private _findClosingLine(startLine, openBracket) {
    let depth = 1;
    const line = this.lines[startLine];
    const bracketPos = line.indexOf(openBracket);
    
    if (bracketPos !== -1) {
      const rest = line.substring(bracketPos + 1);
      const counts = countBrackets(rest, openBracket);
      depth += counts.open - counts.close;
      if (depth === 0) return startLine;
    }
    
    for (let i = startLine + 1; i < this.lines.length; i++) {
      const counts = countBrackets(this.lines[i], openBracket);
      depth += counts.open - counts.close;
      if (depth === 0) return i;
    }
    
    return -1;
  }

  private _buildContextMap() {
    // Memoization: return cached result if content hasn't changed
    const linesLength = this.lines.length;
    if (this._contextMapCache &&
        this._contextMapLinesLength === linesLength &&
        this._contextMapFirstLine === this.lines[0] &&
        this._contextMapLastLine === this.lines[linesLength - 1]) {
      return this._contextMapCache;
    }

    const contextMap = new Map();
    const contextStack = [];
    let pendingContext = null;

    for (let i = 0; i < linesLength; i++) {
      const line = this.lines[i];
      const currentContext = contextStack[contextStack.length - 1]?.context || 'Feature';
      contextMap.set(i, currentContext);

      // Check for context-changing keys
      if (RE_CONTEXT_GEOMETRY.test(line)) pendingContext = 'geometry';
      else if (RE_CONTEXT_PROPERTIES.test(line)) pendingContext = 'properties';
      else if (RE_CONTEXT_FEATURES.test(line)) pendingContext = 'Feature';

      // Track brackets
      RE_OPEN_BRACES.lastIndex = 0;
      RE_CLOSE_BRACES.lastIndex = 0;
      RE_OPEN_BRACKETS.lastIndex = 0;
      RE_CLOSE_BRACKET.lastIndex = 0;
      const openBraces = (line.match(RE_OPEN_BRACES) || []).length;
      const closeBraces = (line.match(RE_CLOSE_BRACES) || []).length;
      const openBrackets = (line.match(RE_OPEN_BRACKETS) || []).length;
      const closeBrackets = (line.match(RE_CLOSE_BRACKET) || []).length;

      for (let j = 0; j < openBraces + openBrackets; j++) {
        contextStack.push({ context: pendingContext || currentContext, isArray: j >= openBraces });
        pendingContext = null;
      }

      for (let j = 0; j < closeBraces + closeBrackets && contextStack.length > 0; j++) {
        contextStack.pop();
      }
    }

    // Cache the result
    this._contextMapCache = contextMap;
    this._contextMapLinesLength = linesLength;
    this._contextMapFirstLine = this.lines[0];
    this._contextMapLastLine = this.lines[linesLength - 1];

    return contextMap;
  }

// ========== Public API ==========

  /**
   * Replace all features in the editor
   * Accepts: FeatureCollection, Feature[], or single Feature
   * @param {object|array} input - Features to set
   * @param {object} options - Optional settings
   * @param {string[]|function} options.collapsed - Attributes to collapse (default: ['coordinates'])
   *   - string[]: List of attributes to collapse (e.g., ['coordinates', 'geometry'])
   *   - function(feature, index): Returns string[] of attributes to collapse per feature
   *   - Use '$root' to collapse the entire feature
   * @throws {Error} If input is invalid
   */
  set(input: FeatureInput, options: SetOptions = {}): void {
    const features = normalizeToFeatures(input);
    this._setFeaturesInternal(features, options);
  }

  /**
   * Add features to the end of the editor
   * Accepts: FeatureCollection, Feature[], or single Feature
   * @param {object|array} input - Features to add
   * @param {object} options - Optional settings
   * @param {string[]|function} options.collapsed - Attributes to collapse (default: ['coordinates'])
   * @throws {Error} If input is invalid
   */
  add(input: FeatureInput, options: SetOptions = {}): void {
    const newFeatures = normalizeToFeatures(input);
    const allFeatures = [...this._parseFeatures(), ...newFeatures];
    this._setFeaturesInternal(allFeatures, options);
  }

  /**
   * Insert features at a specific index
   * Accepts: FeatureCollection, Feature[], or single Feature
   * @param {object|array} input - Features to insert
   * @param {number} index - Index to insert at (negative = from end)
   * @param {object} options - Optional settings
   * @param {string[]|function} options.collapsed - Attributes to collapse (default: ['coordinates'])
   * @throws {Error} If input is invalid
   */
  insertAt(input: FeatureInput, index: number, options: SetOptions = {}): void {
    const newFeatures = normalizeToFeatures(input);
    const features = this._parseFeatures();
    const idx = index < 0 ? features.length + index : index;
    features.splice(Math.max(0, Math.min(idx, features.length)), 0, ...newFeatures);
    this._setFeaturesInternal(features, options);
  }

  /**
   * Internal method to set features with formatting and collapse options
   */
  private _setFeaturesInternal(features: Feature[], options: SetOptions): void {
    const formatted = features.map(f => JSON.stringify(f, null, 2)).join(',\n');
    this.setValue(formatted, false);
    this._applyCollapsedFromOptions(options, features);
  }

  removeAt(index: number): Feature | undefined {
    const features = this._parseFeatures();
    const idx = index < 0 ? features.length + index : index;
    if (idx >= 0 && idx < features.length) {
      const removed = features.splice(idx, 1)[0];
      this.set(features);
      return removed;
    }
    return undefined;
  }

  removeAll(): Feature[] {
    if (this.lines.length > 0) {
      this._saveToHistory('removeAll');
    }
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

  get(index: number): Feature | undefined {
    const features = this._parseFeatures();
    const idx = index < 0 ? features.length + index : index;
    return features[idx];
  }

  getAll(): Feature[] {
    return this._parseFeatures();
  }

  emit(): void {
    this.emitChange();
  }

  /**
   * Save GeoJSON to a file (triggers download)
   */
  save(filename: string = 'features.geojson'): boolean {
    try {
      const features = this._parseFeatures();
      const geojson = {
        type: 'FeatureCollection',
        features: features
      };
      const json = JSON.stringify(geojson, null, 2);
      const blob = new Blob([json], { type: 'application/geo+json' });
      const url = URL.createObjectURL(blob);

      const a = _ce('a') as HTMLAnchorElement;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Open a GeoJSON file from the client filesystem
   * Note: Available even in readonly mode via API (only Ctrl+O shortcut is blocked)
   * @param {object} options - Optional settings
   * @param {string[]|function} options.collapsed - Attributes to collapse (default: ['coordinates'])
   * @returns {Promise<boolean>} Promise that resolves to true if file was loaded successfully
   */
  open(options: SetOptions = {}): Promise<boolean> {
    return new Promise((resolve) => {
      const input = _ce('input') as HTMLInputElement;
      input.type = 'file';
      input.accept = '.geojson,.json,application/geo+json,application/json';
      input.style.display = 'none';

      input.addEventListener('change', (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          document.body.removeChild(input);
          resolve(false);
          return;
        }

        const reader = new FileReader();
        reader.onload = (event: ProgressEvent<FileReader>) => {
          try {
            const content = event.target?.result as string;
            const parsed = JSON.parse(content);

            // Normalize and validate features
            const features = normalizeToFeatures(parsed);

            // Load features into editor
            this._saveToHistory('open');
            this.set(features, options);
            this.clearHistory(); // Clear history after opening new file
            document.body.removeChild(input);
            resolve(true);
          } catch (err) {
            document.body.removeChild(input);
            resolve(false);
          }
        };

        reader.onerror = () => {
          document.body.removeChild(input);
          resolve(false);
        };

        reader.readAsText(file);
      });

      // Handle cancel (no file selected)
      input.addEventListener('cancel', () => {
        document.body.removeChild(input);
        resolve(false);
      });

      document.body.appendChild(input);
      input.click();
    });
  }

  private _parseFeatures() {
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
