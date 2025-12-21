import styles from './geojson-editor.css?inline';
import { getTemplate } from './geojson-editor.template.js';
import type { Feature } from 'geojson';

// ========== Imports from extracted modules ==========
import type {
  SetOptions
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
  RE_CONTEXT_GEOMETRY,
  RE_CONTEXT_PROPERTIES,
  RE_CONTEXT_FEATURES,
  RE_ATTR_VALUE,
  RE_ATTR_VALUE_SINGLE,
  RE_NORMALIZE_COLOR,
  RE_COLOR_HEX,
  RE_IS_FEATURE,
  RE_KV_MATCH,
  RE_ROOT_MATCH,
  RE_BRACKET_POS,
  RE_IS_WORD_CHAR,
  RE_ATTR_AND_BOOL_VALUE,
  RE_OPEN_BRACES,
  RE_CLOSE_BRACES,
  RE_OPEN_BRACKETS,
  RE_CLOSE_BRACKET
} from './constants.js';

import { createElement, countBrackets } from './utils.js';
import { validateGeoJSON, normalizeToFeatures } from './validation.js';
import { highlightSyntax, namedColorToHex, isNamedColor } from './syntax-highlighter.js';

// Re-export public types
export type { SetOptions } from './types.js';

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
  hiddenFeatures: Set<number> = new Set(); // Feature indices that are hidden

  // ========== Node ID Management ==========
  private _nodeIdCounter: number = 0;
  private _lineToNodeId: Map<number, string> = new Map();
  private _nodeIdToLines: Map<string, NodeRangeInfo> = new Map();
  private _openedNodeKeys: Set<string> = new Set(); // UniqueKeys (nodeKey:occurrence) that user opened

  // ========== Derived State (computed from model) ==========
  visibleLines: VisibleLine[] = [];
  lineMetadata: Map<number, LineMeta> = new Map();
  featureRanges: Map<number, FeatureRange> = new Map(); // featureIndex -> range

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
  private renderTimer: ReturnType<typeof setTimeout> | undefined = undefined;
  private inputTimer: ReturnType<typeof setTimeout> | undefined = undefined;


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
  private _errorLinesCache: Set<number> | null = null;
  private _lastCurrentFeatureIndices: string | null = null; // For current-features event deduplication (JSON stringified indices)

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
  private _errorNav: HTMLElement | null = null;
  private _errorCount: HTMLElement | null = null;
  private _prevErrorBtn: HTMLButtonElement | null = null;
  private _nextErrorBtn: HTMLButtonElement | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  // Alias for shadowRoot.getElementById (minification)
  private _id(id: string) { return this.shadowRoot!.getElementById(id); }

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
    // Collect uniqueKeys of collapsed nodes
    const collapsedUniqueKeys: string[] = [];
    for (const nodeId of this.collapsedNodes) {
      const info = this._nodeIdToLines.get(nodeId);
      if (info?.uniqueKey) collapsedUniqueKeys.push(info.uniqueKey);
    }

    return {
      lines: [...this.lines],
      cursorLine: this.cursorLine,
      cursorColumn: this.cursorColumn,
      timestamp: Date.now(),
      collapsedUniqueKeys
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

    // Restore collapsed state from snapshot
    if (snapshot.collapsedUniqueKeys !== undefined) {
      // Snapshot has collapsed state info - restore it (even if empty array = nothing collapsed)
      this.collapsedNodes.clear();
      const uniqueKeysToCollapse = new Set(snapshot.collapsedUniqueKeys);

      for (const [nodeId, info] of this._nodeIdToLines) {
        if (info.uniqueKey && uniqueKeysToCollapse.has(info.uniqueKey)) {
          this.collapsedNodes.add(nodeId);
        }
      }
    } else {
      // Old snapshot without collapsed state - apply default (collapse coordinates)
      this.collapsedNodes.clear();
      this._applyCollapsedOption(['coordinates']);
    }

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
  undo(): boolean {
    if (this._undoStack.length === 0) return false;

    // Save current state to redo stack
    this._redoStack.push(this._createSnapshot());

    // Restore previous state
    const previousState = this._undoStack.pop();
    if (previousState) this._restoreSnapshot(previousState);

    // Reset action tracking
    this._lastActionType = null;
    this._lastActionTime = 0;

    return true;
  }

  /**
   * Redo previously undone action
   * @returns {boolean} True if redo was performed
   */
  redo(): boolean {
    if (this._redoStack.length === 0) return false;

    // Save current state to undo stack
    this._undoStack.push(this._createSnapshot());

    // Restore next state
    const nextState = this._redoStack.pop();
    if (nextState) this._restoreSnapshot(nextState);

    // Reset action tracking
    this._lastActionType = null;
    this._lastActionTime = 0;

    return true;
  }

  /**
   * Clear undo/redo history
   */
  clearHistory(): void {
    this._undoStack = [];
    this._redoStack = [];
    this._lastActionType = null;
    this._lastActionTime = 0;
  }

  /**
   * Check if undo is available
   * @returns {boolean}
   */
  canUndo(): boolean {
    return this._undoStack.length > 0;
  }

  /**
   * Check if redo is available
   * @returns {boolean}
   */
  canRedo(): boolean {
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
    // Save collapsed uniqueKeys from old state
    const collapsedUniqueKeys = new Set<string>();
    for (const nodeId of this.collapsedNodes) {
      const info = this._nodeIdToLines.get(nodeId);
      if (info?.uniqueKey) collapsedUniqueKeys.add(info.uniqueKey);
    }

    // Reset mappings
    this._nodeIdCounter = 0;
    this._lineToNodeId.clear();
    this._nodeIdToLines.clear();
    this.collapsedNodes.clear();

    // Track occurrences of each nodeKey
    const nodeKeyOccurrences = new Map<string, number>();

    // Assign fresh IDs to all collapsible nodes
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];

      // Match "key": { or "key": [
      const kvMatch = line.match(RE_KV_MATCH);
      // Also match standalone { or {, (root Feature objects)
      const rootMatch = !kvMatch && line.match(RE_ROOT_MATCH);

      if (!kvMatch && !rootMatch) continue;

      let nodeKey: string;
      let openBracket: string;

      if (kvMatch) {
        nodeKey = kvMatch[1];
        openBracket = kvMatch[2];
      } else if (rootMatch) {
        // Root object - use special key based on line number and bracket type
        openBracket = rootMatch[1];
        nodeKey = `__root_${openBracket}_${i}`;
      } else {
        continue;
      }

      // Check if closes on same line
      const rest = line.substring(line.indexOf(openBracket) + 1);
      const counts = countBrackets(rest, openBracket);
      if (counts.close > counts.open) continue;

      const endLine = this._findClosingLine(i, openBracket);
      if (endLine === -1 || endLine === i) continue;

      // Generate unique ID and unique key for this node
      const nodeId = this._generateNodeId();
      const occurrence = nodeKeyOccurrences.get(nodeKey) || 0;
      nodeKeyOccurrences.set(nodeKey, occurrence + 1);
      const uniqueKey = `${nodeKey}:${occurrence}`;

      this._lineToNodeId.set(i, nodeId);
      this._nodeIdToLines.set(nodeId, { startLine: i, endLine, nodeKey, uniqueKey, isRootFeature: !!rootMatch });

      // Restore collapsed state if was collapsed and not explicitly opened
      if (collapsedUniqueKeys.has(uniqueKey) && !this._openedNodeKeys.has(uniqueKey)) {
        this.collapsedNodes.add(nodeId);
      }
    }
  }

  // ========== Observed Attributes ==========
  static get observedAttributes() {
    return ['readonly', 'value', 'placeholder', 'internal-add-shortcut'];
  }

  // ========== Lifecycle ==========
  connectedCallback() {
    this.render();
    this._cacheElements();
    this.setupEventListeners();
    this.updatePrefixSuffix();

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
    }
  }

  // ========== Properties ==========
  get readonly() { return this.hasAttribute('readonly'); }
  get value() { return this.getAttribute('value') || ''; }
  get placeholder() { return this.getAttribute('placeholder') || ''; }
  get internalAddShortcut() { return this.hasAttribute('internal-add-shortcut'); }
  get prefix() { return '{"type": "FeatureCollection", "features": ['; }
  get suffix() { return ']}'; }

  // ========== Initial Render ==========
  render() {
    const shadowRoot = this.shadowRoot!;
    const styleEl = _ce('style');
    styleEl.textContent = styles;

    const template = _ce('div');
    template.innerHTML = getTemplate(this.placeholder, VERSION);

    shadowRoot.innerHTML = '';
    shadowRoot.appendChild(styleEl);
    while (template.firstChild) {
      shadowRoot.appendChild(template.firstChild);
    }
  }

  // ========== DOM Element Cache ==========
  private _cacheElements() {
    this._viewport = this._id('viewport');
    this._linesContainer = this._id('linesContainer');
    this._scrollContent = this._id('scrollContent');
    this._hiddenTextarea = this._id('hiddenTextarea') as HTMLTextAreaElement;
    this._gutterContent = this._id('gutterContent');
    this._gutterScrollContent = this._id('gutterScrollContent');
    this._gutterScroll = this._id('gutterScroll');
    this._gutter = this.shadowRoot!.querySelector('.gutter');
    this._clearBtn = this._id('clearBtn') as HTMLButtonElement;
    this._editorWrapper = this.shadowRoot!.querySelector('.editor-wrapper');
    this._placeholderLayer = this._id('placeholderLayer');
    this._editorPrefix = this._id('editorPrefix');
    this._editorSuffix = this._id('editorSuffix');
    this._errorNav = this._id('errorNav');
    this._errorCount = this._id('errorCount');
    this._prevErrorBtn = this._id('prevErrorBtn') as HTMLButtonElement;
    this._nextErrorBtn = this._id('nextErrorBtn') as HTMLButtonElement;
  }

  // ========== Event Listeners ==========
  setupEventListeners() {
    const hiddenTextarea = this._hiddenTextarea;
    const viewport = this._viewport;
    const gutterContent = this._gutterContent;
    const gutter = this._gutter;
    const clearBtn = this._clearBtn;
    const editorWrapper = this._editorWrapper;

    // Guard: all elements must exist
    if (!hiddenTextarea || !viewport || !gutterContent || !gutter || !clearBtn || !editorWrapper) return;

    // Mouse selection state
    this._isSelecting = false;

    // Focus hidden textarea when clicking viewport
    // Editor inline control clicks (color swatches, checkboxes, visibility icons)
    // Use capture phase to intercept before mousedown
    viewport.addEventListener('click', (e) => {
      this.handleEditorClick(e as MouseEvent);
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

      // Double-click: select word (e.detail === 2)
      if (e.detail === 2) {
        const pos = this._getPositionFromClick(e);
        this._selectWordAt(pos.line, pos.column);
        this._isSelecting = false;
        hiddenTextarea.focus();
        this._invalidateRenderCache();
        this.scheduleRender();
        return;
      }

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
    
    // Auto-scroll interval for drag selection outside editor
    let autoScrollInterval: ReturnType<typeof setInterval> | null = null;

    const stopAutoScroll = () => {
      if (autoScrollInterval) {
        clearInterval(autoScrollInterval);
        autoScrollInterval = null;
      }
    };

    const startAutoScroll = (direction: 'up' | 'down') => {
      stopAutoScroll();
      const scrollSpeed = 20;
      autoScrollInterval = setInterval(() => {
        if (!this._isSelecting) {
          stopAutoScroll();
          return;
        }
        if (direction === 'up') {
          viewport.scrollTop -= scrollSpeed;
        } else {
          viewport.scrollTop += scrollSpeed;
        }
        // Update selection based on scroll position
        this._updateSelectionFromScroll(direction);
        this._invalidateRenderCache();
        this.scheduleRender();
      }, 50);
    };

    // Mouse move for drag selection - listen on document to handle drag outside editor
    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this._isSelecting) return;

      const rect = viewport.getBoundingClientRect();
      const scrollMargin = 30;
      const scrollSpeed = 20;

      // Check if mouse is outside the viewport
      if (e.clientY < rect.top) {
        // Mouse above viewport - start continuous scroll up
        startAutoScroll('up');
      } else if (e.clientY > rect.bottom) {
        // Mouse below viewport - start continuous scroll down
        startAutoScroll('down');
      } else {
        // Mouse inside viewport - stop auto-scroll and update normally
        stopAutoScroll();
        const pos = this._getPositionFromClick(e);
        this.selectionEnd = pos;
        this.cursorLine = pos.line;
        this.cursorColumn = pos.column;

        // Auto-scroll when near edges (inside viewport)
        if (e.clientY < rect.top + scrollMargin) {
          viewport.scrollTop -= scrollSpeed;
        } else if (e.clientY > rect.bottom - scrollMargin) {
          viewport.scrollTop += scrollSpeed;
        }

        this._invalidateRenderCache();
        this.scheduleRender();
      }
    });

    // Mouse up to end selection
    document.addEventListener('mouseup', () => {
      this._isSelecting = false;
      stopAutoScroll();
    });

    // Focus/blur handling to show/hide cursor
    hiddenTextarea.addEventListener('focus', () => {
      editorWrapper.classList.add('focused');
      this._invalidateRenderCache(); // Force re-render to show cursor
      this.scheduleRender();
      // Emit current feature on focus (force to always emit on focus gain)
      this._emitCurrentFeature(true);
    });

    hiddenTextarea.addEventListener('blur', () => {
      editorWrapper.classList.remove('focused');
      this._invalidateRenderCache(); // Force re-render to hide cursor
      this.scheduleRender();
      // Emit null on blur
      this._emitCurrentFeatureNull();
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
      this.handleKeydown(e as KeyboardEvent);
    });

    // Paste handling
    hiddenTextarea.addEventListener('paste', (e) => {
      this.handlePaste(e as ClipboardEvent);
    });

    // Copy handling
    hiddenTextarea.addEventListener('copy', (e) => {
      this.handleCopy(e as ClipboardEvent);
    });

    // Cut handling
    hiddenTextarea.addEventListener('cut', (e) => {
      this.handleCut(e as ClipboardEvent);
    });

    // Gutter interactions
    gutterContent.addEventListener('click', (e) => {
      this.handleGutterClick(e as MouseEvent);
    });

    // Prevent gutter from stealing focus
    gutter.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });

    // Wheel on gutter -> scroll viewport
    gutter.addEventListener('wheel', (e) => {
      e.preventDefault();
      viewport.scrollTop += (e as WheelEvent).deltaY;
    });

    // Clear button
    clearBtn.addEventListener('click', () => {
      this.removeAll();
    });

    // Info button - toggle popup
    const infoBtn = this._id('infoBtn');
    const infoPopup = this._id('infoPopup');
    if (infoBtn && infoPopup) {
      infoBtn.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        infoPopup.classList.toggle('visible');
      });
      // Close popup when clicking outside
      document.addEventListener('click', () => {
        infoPopup.classList.remove('visible');
      });
    }

    // Error navigation buttons
    this._prevErrorBtn?.addEventListener('click', () => {
      this.goToPrevError();
    });
    this._nextErrorBtn?.addEventListener('click', () => {
      this.goToNextError();
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
    this._openedNodeKeys.clear();
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
    // Invalidate caches since content changed
    this._contextMapCache = null;
    this._errorLinesCache = null;

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
        } else if (inFeature) {
          const counts = countBrackets(line, '{');
          braceDepth += counts.open - counts.close;

          if (braceDepth <= 0) {
            // Store by featureIndex instead of hash key
            this.featureRanges.set(featureIndex, {
              startLine: featureStartLine,
              endLine: i,
              featureIndex
            });
            featureIndex++;
            inFeature = false;
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

    // Compute error lines once (cached)
    const errorLines = this._computeErrorLines();

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const meta: LineMeta = {
        colors: [],
        booleans: [],
        collapseButton: null,
        visibilityButton: null,
        isHidden: false,
        isCollapsed: false,
        featureIndex: null,
        hasError: errorLines.has(i)
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
          } else if (isNamedColor(strValue)) {
            // Named CSS color (red, blue, etc.) - validated via browser
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
      for (const [featureIndex, range] of this.featureRanges) {
        if (i >= range.startLine && i <= range.endLine) {
          meta.featureIndex = featureIndex;
          if (this.hiddenFeatures.has(featureIndex)) {
            meta.isHidden = true;
          }
          // Add visibility button only on feature start line
          if (i === range.startLine) {
            meta.visibilityButton = {
              featureIndex,
              isHidden: this.hiddenFeatures.has(featureIndex)
            };
          }
          break;
        }
      }

      this.lineMetadata.set(i, meta);
    }
  }

  /**
   * Compute error lines (syntax highlighting + structural errors)
   * Called once per model update, result is used by computeLineMetadata
   */
  private _computeErrorLines(): Set<number> {
    if (this._errorLinesCache !== null) {
      return this._errorLinesCache;
    }

    const errorLines = new Set<number>();

    // Check syntax highlighting errors for each line
    for (let i = 0; i < this.lines.length; i++) {
      const highlighted = highlightSyntax(this.lines[i], '', undefined);
      if (highlighted.includes('json-error')) {
        errorLines.add(i);
      }
    }

    // Check structural error from JSON.parse
    try {
      const content = this.lines.join('\n');
      const wrapped = '[' + content + ']';
      JSON.parse(wrapped);
    } catch (e) {
      if (e instanceof Error) {
        // Try to extract line number from error message
        // Chrome/Node: "... at line X column Y"
        const lineMatch = e.message.match(/line (\d+)/);
        if (lineMatch) {
          // Subtract 1 because we wrapped with '[' on first line
          const errorLine = Math.max(0, parseInt(lineMatch[1], 10) - 1);
          errorLines.add(errorLine);
        }
      }
    }

    this._errorLinesCache = errorLines;
    return errorLines;
  }

  /**
   * Get all lines that have errors (for navigation and counting)
   * Returns array of line indices sorted by line number
   */
  private _getErrorLines(): number[] {
    const errorLines: number[] = [];
    for (const [lineIndex, meta] of this.lineMetadata) {
      if (meta.hasError) {
        errorLines.push(lineIndex);
      }
    }
    return errorLines.sort((a, b) => a - b);
  }

  /**
   * Navigate to the next error line
   */
  goToNextError(): boolean {
    const errorLines = this._getErrorLines();
    if (errorLines.length === 0) return false;

    // Find next error after current cursor position
    const nextError = errorLines.find(line => line > this.cursorLine);
    const targetLine = nextError !== undefined ? nextError : errorLines[0]; // Wrap to first

    return this._goToErrorLine(targetLine);
  }

  /**
   * Navigate to the previous error line
   */
  goToPrevError(): boolean {
    const errorLines = this._getErrorLines();
    if (errorLines.length === 0) return false;

    // Find previous error before current cursor position
    const prevErrors = errorLines.filter(line => line < this.cursorLine);
    const targetLine = prevErrors.length > 0 ? prevErrors[prevErrors.length - 1] : errorLines[errorLines.length - 1]; // Wrap to last

    return this._goToErrorLine(targetLine);
  }

  /**
   * Expand all collapsed nodes containing a specific line
   * Returns true if any nodes were expanded
   */
  private _expandNodesContainingLine(lineIndex: number): boolean {
    let expanded = false;
    for (const [nodeId, nodeInfo] of this._nodeIdToLines) {
      if (this.collapsedNodes.has(nodeId) && lineIndex > nodeInfo.startLine && lineIndex <= nodeInfo.endLine) {
        this.collapsedNodes.delete(nodeId);
        // Track that this node was opened - don't re-collapse during edits
        if (nodeInfo.uniqueKey) {
          this._openedNodeKeys.add(nodeInfo.uniqueKey);
        }
        expanded = true;
      }
    }
    return expanded;
  }

  /**
   * Navigate to a specific error line
   */
  private _goToErrorLine(lineIndex: number): boolean {
    if (this._expandNodesContainingLine(lineIndex)) {
      this.updateView();
    }

    this.cursorLine = lineIndex;
    this.cursorColumn = 0;
    this._invalidateRenderCache();
    this._scrollToCursor(true); // Center the error line
    this.renderViewport();
    this._updateErrorDisplay();

    // Focus the editor
    this._hiddenTextarea?.focus();
    return true;
  }

  /**
   * Expand all collapsed nodes that contain error lines
   */
  private _expandErrorNodes(): void {
    const errorLines = this._getErrorLines();
    if (errorLines.length === 0) return;

    let expanded = false;
    for (const errorLine of errorLines) {
      if (this._expandNodesContainingLine(errorLine)) {
        expanded = true;
      }
    }

    if (expanded) {
      this.updateView();
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
      this.renderTimer = undefined;
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

    // Set total scrollable dimensions (height and width based on content)
    if (scrollContent) {
      scrollContent.style.height = `${totalHeight}px`;
      // Calculate max line width to update horizontal scroll
      const charWidth = this._getCharWidth();
      const maxLineLength = this.lines.reduce((max, line) => Math.max(max, line.length), 0);
      const minWidth = maxLineLength * charWidth + 20; // 20px padding
      scrollContent.style.minWidth = `${minWidth}px`;
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
        lineEl.dataset.featureIndex = String(lineData.meta.visibilityButton.featureIndex);
        if (lineData.meta.visibilityButton.isHidden) {
          lineEl.classList.add('feature-hidden');
        }
      }
      
      // Add hidden class if feature is hidden
      if (lineData.meta?.isHidden) {
        lineEl.classList.add('line-hidden');
      }
      
      // Highlight syntax and add cursor if this is the cursor line and editor is focused
      const context = contextMap.get(lineData.index) || 'Feature';
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

    // Emit current-features event if feature changed (only when editor is focused)
    if (this._editorWrapper?.classList.contains('focused')) {
      this._emitCurrentFeature();
    }
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
    const sel = this._normalizeSelection();
    if (!sel) return html;
    const { start, end } = sel;
    
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
  private _getCharWidth(): number {
    if (!this._charWidth) {
      const canvas = _ce('canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Use exact same font as CSS: 'Courier New', Courier, monospace at 13px
        ctx.font = "13px 'Courier New', Courier, monospace";
        this._charWidth = ctx.measureText('M').width;
      } else {
        // Fallback to approximate monospace character width
        this._charWidth = 7.8;
      }
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

      // Add error indicator class
      if (meta?.hasError) {
        gutterLine.classList.add('has-error');
      }

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
      'Enter': () => this._handleEnter(e.shiftKey, ctx),
      'Backspace': () => this._handleBackspace(ctx),
      'Delete': () => this._handleDelete(ctx),
      'ArrowUp': () => this._handleArrowKey(-1, 0, e.shiftKey, e.ctrlKey || e.metaKey),
      'ArrowDown': () => this._handleArrowKey(1, 0, e.shiftKey, e.ctrlKey || e.metaKey),
      'ArrowLeft': () => this._handleArrowKey(0, -1, e.shiftKey, e.ctrlKey || e.metaKey),
      'ArrowRight': () => this._handleArrowKey(0, 1, e.shiftKey, e.ctrlKey || e.metaKey),
      'Home': () => this._handleHomeEnd('home', e.shiftKey, e.ctrlKey || e.metaKey, ctx.onClosingLine),
      'End': () => this._handleHomeEnd('end', e.shiftKey, e.ctrlKey || e.metaKey, ctx.onClosingLine),
      'PageUp': () => this._handlePageUpDown('up', e.shiftKey),
      'PageDown': () => this._handlePageUpDown('down', e.shiftKey),
      'Tab': () => this._handleTab(e.shiftKey, ctx),
      'Insert': () => { this._insertMode = !this._insertMode; this.scheduleRender(); }
    };

    // Modifier key handlers (Ctrl/Cmd)
    const modifierHandlers: Record<string, () => void | boolean | Promise<boolean>> = {
      'a': () => this._selectAll(),
      'z': () => e.shiftKey ? this.redo() : this.undo(),
      'y': () => this.redo(),
      's': () => this.save(),
      'o': () => !this.hasAttribute('readonly') && this.open(),
      'i': () => this.internalAddShortcut && !this.readonly && this._handleAddFeaturePrompt()
    };

    // Check for direct key match
    if (keyHandlers[e.key]) {
      e.preventDefault();
      e.stopPropagation();
      keyHandlers[e.key]();
      return;
    }

    // Check for modifier key combinations (use lowercase key for consistency)
    const lowerKey = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && modifierHandlers[lowerKey]) {
      e.preventDefault();
      e.stopPropagation();
      modifierHandlers[lowerKey]();
    }
  }

  private _handleEnter(isShiftKey: boolean, ctx: CollapsedZoneContext): void {
    // Shift+Enter: collapse the containing expanded node
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

    // Enter on collapsed node: expand it
    if (ctx.onCollapsedNode) {
      this.toggleCollapse(ctx.onCollapsedNode.nodeId);
      return;
    }

    // Enter on closing line of collapsed node: expand it
    if (ctx.onClosingLine) {
      const line = this.lines[this.cursorLine];
      const bracketPos = this._getClosingBracketPos(line);
      // If cursor is before or on bracket, expand
      if (bracketPos >= 0 && this.cursorColumn <= bracketPos) {
        this.toggleCollapse(ctx.onClosingLine.nodeId);
        return;
      }
    }

    // Block in collapsed zones
    if (ctx.inCollapsedZone) return;

    // Enter anywhere else: do nothing (JSON structure is managed automatically)
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

  private _handleTab(isShiftKey: boolean, _ctx: CollapsedZoneContext): void {
    // Tab/Shift+Tab: navigate between attributes (key and value)
    if (isShiftKey) {
      this._navigateToPrevAttribute();
    } else {
      this._navigateToNextAttribute();
    }
  }

  /**
   * Navigate to the next attribute (key or value) in the JSON
   * Also stops on collapsed node brackets to allow expansion with Enter
   */
  private _navigateToNextAttribute(): void {
    const totalLines = this.visibleLines.length;
    let currentVisibleIdx = this.visibleLines.findIndex(vl => vl.index === this.cursorLine);
    if (currentVisibleIdx < 0) currentVisibleIdx = 0;

    // Search from current position forward
    for (let i = currentVisibleIdx; i < totalLines; i++) {
      const vl = this.visibleLines[i];
      const line = this.lines[vl.index];
      const startCol = (i === currentVisibleIdx) ? this.cursorColumn : 0;

      const pos = this._findNextAttributeOrBracket(line, startCol, vl.index);
      if (pos !== null) {
        this.cursorLine = vl.index;
        this.cursorColumn = pos.start;
        // Select the attribute key or value (not brackets)
        if (!pos.isBracket) {
          this.selectionStart = { line: vl.index, column: pos.start };
          this.selectionEnd = { line: vl.index, column: pos.end };
        } else {
          this._clearSelection();
        }
        this._scrollToCursor();
        this._invalidateRenderCache();
        this.scheduleRender();
        return;
      }
    }

    // Wrap to beginning
    for (let i = 0; i < currentVisibleIdx; i++) {
      const vl = this.visibleLines[i];
      const line = this.lines[vl.index];
      const pos = this._findNextAttributeOrBracket(line, 0, vl.index);
      if (pos !== null) {
        this.cursorLine = vl.index;
        this.cursorColumn = pos.start;
        if (!pos.isBracket) {
          this.selectionStart = { line: vl.index, column: pos.start };
          this.selectionEnd = { line: vl.index, column: pos.end };
        } else {
          this._clearSelection();
        }
        this._scrollToCursor();
        this._invalidateRenderCache();
        this.scheduleRender();
        return;
      }
    }
  }

  /**
   * Navigate to the previous attribute (key or value) in the JSON
   * Also stops on collapsed node brackets to allow expansion with Enter
   */
  private _navigateToPrevAttribute(): void {
    const totalLines = this.visibleLines.length;
    let currentVisibleIdx = this.visibleLines.findIndex(vl => vl.index === this.cursorLine);
    if (currentVisibleIdx < 0) currentVisibleIdx = totalLines - 1;

    // Search from current position backward
    for (let i = currentVisibleIdx; i >= 0; i--) {
      const vl = this.visibleLines[i];
      const line = this.lines[vl.index];
      const endCol = (i === currentVisibleIdx) ? this.cursorColumn : line.length;

      const pos = this._findPrevAttributeOrBracket(line, endCol, vl.index);
      if (pos !== null) {
        this.cursorLine = vl.index;
        this.cursorColumn = pos.start;
        if (!pos.isBracket) {
          this.selectionStart = { line: vl.index, column: pos.start };
          this.selectionEnd = { line: vl.index, column: pos.end };
        } else {
          this._clearSelection();
        }
        this._scrollToCursor();
        this._invalidateRenderCache();
        this.scheduleRender();
        return;
      }
    }

    // Wrap to end
    for (let i = totalLines - 1; i > currentVisibleIdx; i--) {
      const vl = this.visibleLines[i];
      const line = this.lines[vl.index];
      const pos = this._findPrevAttributeOrBracket(line, line.length, vl.index);
      if (pos !== null) {
        this.cursorLine = vl.index;
        this.cursorColumn = pos.start;
        if (!pos.isBracket) {
          this.selectionStart = { line: vl.index, column: pos.start };
          this.selectionEnd = { line: vl.index, column: pos.end };
        } else {
          this._clearSelection();
        }
        this._scrollToCursor();
        this._invalidateRenderCache();
        this.scheduleRender();
        return;
      }
    }
  }

  /**
   * Find next attribute position in a line after startCol
   * Returns {start, end} for the key or value, or null if none found
   * Also finds standalone values (numbers in arrays, etc.)
   */
  private _findNextAttributeInLine(line: string, startCol: number): { start: number; end: number } | null {
    // Collect all navigable positions
    const positions: { start: number; end: number }[] = [];

    // Pattern for "key": value pairs
    const keyValueRe = /"([^"]+)"(?:\s*:\s*(?:"([^"]*)"|(-?\d+\.?\d*(?:e[+-]?\d+)?)|true|false|null))?/gi;
    let match;

    while ((match = keyValueRe.exec(line)) !== null) {
      const keyStart = match.index + 1; // Skip opening quote
      const keyEnd = keyStart + match[1].length;
      positions.push({ start: keyStart, end: keyEnd });

      // Check if there's a value (string, number, boolean, null)
      if (match[2] !== undefined) {
        // String value
        const valueMatch = line.substring(match.index).match(/:\s*"([^"]*)"/);
        if (valueMatch) {
          const valueStart = match.index + (valueMatch.index || 0) + valueMatch[0].indexOf('"') + 1;
          const valueEnd = valueStart + match[2].length;
          positions.push({ start: valueStart, end: valueEnd });
        }
      } else if (match[3] !== undefined) {
        // Number value after colon
        const numMatch = line.substring(match.index).match(/:\s*(-?\d+\.?\d*(?:e[+-]?\d+)?)/i);
        if (numMatch) {
          const valueStart = match.index + (numMatch.index || 0) + numMatch[0].indexOf(numMatch[1]);
          const valueEnd = valueStart + numMatch[1].length;
          positions.push({ start: valueStart, end: valueEnd });
        }
      } else {
        // Boolean or null
        const boolMatch = line.substring(match.index).match(/:\s*(true|false|null)/);
        if (boolMatch) {
          const valueStart = match.index + (boolMatch.index || 0) + boolMatch[0].indexOf(boolMatch[1]);
          const valueEnd = valueStart + boolMatch[1].length;
          positions.push({ start: valueStart, end: valueEnd });
        }
      }
    }

    // Also find standalone numbers (not after a colon) - for array elements
    const standaloneNumRe = /(?:^|[\[,\s])(-?\d+\.?\d*(?:e[+-]?\d+)?)\s*(?:[,\]]|$)/gi;
    while ((match = standaloneNumRe.exec(line)) !== null) {
      const numStr = match[1];
      const numStart = match.index + match[0].indexOf(numStr);
      const numEnd = numStart + numStr.length;
      // Avoid duplicates (numbers already captured by key-value pattern)
      if (!positions.some(p => p.start === numStart && p.end === numEnd)) {
        positions.push({ start: numStart, end: numEnd });
      }
    }

    // Sort by start position and find first after startCol
    positions.sort((a, b) => a.start - b.start);
    for (const pos of positions) {
      if (pos.start > startCol) {
        return pos;
      }
    }

    return null;
  }

  /**
   * Find previous attribute position in a line before endCol
   * Also finds standalone values (numbers in arrays, etc.)
   */
  private _findPrevAttributeInLine(line: string, endCol: number): { start: number; end: number } | null {
    // Collect all navigable positions
    const positions: { start: number; end: number }[] = [];

    // Pattern for "key": value pairs
    const keyValueRe = /"([^"]+)"(?:\s*:\s*(?:"([^"]*)"|(-?\d+\.?\d*(?:e[+-]?\d+)?)|true|false|null))?/gi;
    let match;

    while ((match = keyValueRe.exec(line)) !== null) {
      const keyStart = match.index + 1;
      const keyEnd = keyStart + match[1].length;
      positions.push({ start: keyStart, end: keyEnd });

      // Check for value
      if (match[2] !== undefined) {
        const valueMatch = line.substring(match.index).match(/:\s*"([^"]*)"/);
        if (valueMatch) {
          const valueStart = match.index + (valueMatch.index || 0) + valueMatch[0].indexOf('"') + 1;
          const valueEnd = valueStart + match[2].length;
          positions.push({ start: valueStart, end: valueEnd });
        }
      } else if (match[3] !== undefined) {
        const numMatch = line.substring(match.index).match(/:\s*(-?\d+\.?\d*(?:e[+-]?\d+)?)/i);
        if (numMatch) {
          const valueStart = match.index + (numMatch.index || 0) + numMatch[0].indexOf(numMatch[1]);
          const valueEnd = valueStart + numMatch[1].length;
          positions.push({ start: valueStart, end: valueEnd });
        }
      } else {
        const boolMatch = line.substring(match.index).match(/:\s*(true|false|null)/);
        if (boolMatch) {
          const valueStart = match.index + (boolMatch.index || 0) + boolMatch[0].indexOf(boolMatch[1]);
          const valueEnd = valueStart + boolMatch[1].length;
          positions.push({ start: valueStart, end: valueEnd });
        }
      }
    }

    // Also find standalone numbers (not after a colon) - for array elements
    const standaloneNumRe = /(?:^|[\[,\s])(-?\d+\.?\d*(?:e[+-]?\d+)?)\s*(?:[,\]]|$)/gi;
    while ((match = standaloneNumRe.exec(line)) !== null) {
      const numStr = match[1];
      const numStart = match.index + match[0].indexOf(numStr);
      const numEnd = numStart + numStr.length;
      // Avoid duplicates
      if (!positions.some(p => p.start === numStart && p.end === numEnd)) {
        positions.push({ start: numStart, end: numEnd });
      }
    }

    // Sort by start position and find last that ends before endCol
    positions.sort((a, b) => a.start - b.start);
    for (let i = positions.length - 1; i >= 0; i--) {
      if (positions[i].end < endCol) {
        return positions[i];
      }
    }

    return null;
  }

  /**
   * Find bracket position in a line (opening bracket for collapsible nodes)
   * Looks for { or [ at end of line (for both expanded and collapsed nodes)
   * Returns position AFTER the bracket, or null if not found
   */
  private _findBracketInLine(line: string): number | null {
    // Look for { or [ at end of line (indicates a collapsible node)
    // Works for both expanded and collapsed nodes - collapsed nodes still have
    // the bracket in raw text, the "..." is only added visually via CSS
    const bracketMatch = line.match(/[\[{]\s*$/);
    if (bracketMatch && bracketMatch.index !== undefined) {
      return bracketMatch.index + 1; // Position after bracket
    }
    return null;
  }

  /**
   * Find next attribute or bracket position in a line
   * Returns position with isBracket flag to indicate if it's a bracket
   * For brackets, cursor is placed AFTER the bracket (where Enter/Shift+Enter works)
   * Stops on ALL opening brackets to allow collapse/expand navigation
   */
  private _findNextAttributeOrBracket(line: string, startCol: number, _lineIndex: number): { start: number; end: number; isBracket: boolean } | null {
    // First check for regular attributes
    const attrPos = this._findNextAttributeInLine(line, startCol);

    // Find opening bracket position (collapsed or expanded)
    const bracketPos = this._findBracketInLine(line);

    // Return whichever comes first after startCol
    if (attrPos !== null && bracketPos !== null) {
      if (bracketPos > startCol && (bracketPos < attrPos.start)) {
        return { start: bracketPos, end: bracketPos, isBracket: true };
      }
      return { ...attrPos, isBracket: false };
    } else if (attrPos !== null) {
      return { ...attrPos, isBracket: false };
    } else if (bracketPos !== null && bracketPos > startCol) {
      return { start: bracketPos, end: bracketPos, isBracket: true };
    }

    return null;
  }

  /**
   * Find previous attribute or bracket position in a line
   * Returns position with isBracket flag to indicate if it's a bracket
   * For brackets, cursor is placed AFTER the bracket (where Enter/Shift+Enter works)
   * Stops on ALL opening brackets to allow collapse/expand navigation
   */
  private _findPrevAttributeOrBracket(line: string, endCol: number, _lineIndex: number): { start: number; end: number; isBracket: boolean } | null {
    // First check for regular attributes
    const attrPos = this._findPrevAttributeInLine(line, endCol);

    // Find opening bracket position (collapsed or expanded)
    const bracketPos = this._findBracketInLine(line);

    // Return whichever comes last STRICTLY BEFORE endCol (to avoid staying in place)
    if (attrPos !== null && bracketPos !== null) {
      if (bracketPos < endCol && bracketPos > attrPos.end) {
        return { start: bracketPos, end: bracketPos, isBracket: true };
      }
      return { ...attrPos, isBracket: false };
    } else if (attrPos !== null) {
      return { ...attrPos, isBracket: false };
    } else if (bracketPos !== null && bracketPos < endCol) {
      return { start: bracketPos, end: bracketPos, isBracket: true };
    }

    return null;
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
   * Scroll viewport to ensure cursor is visible with comfortable margin
   * @param center - if true, center the cursor line in the viewport
   */
  private _scrollToCursor(center = false) {
    const viewport = this._viewport;
    if (!viewport) return;

    // Find the visible line index for the cursor
    const visibleIndex = this.visibleLines.findIndex(vl => vl.index === this.cursorLine);
    if (visibleIndex === -1) return;

    const cursorY = visibleIndex * this.lineHeight;
    const viewportHeight = viewport.clientHeight;
    // Add margin of 2 lines for comfortable visibility
    const scrollMargin = this.lineHeight * 2;

    if (center) {
      // Center the cursor line in the viewport
      viewport.scrollTop = Math.max(0, cursorY - viewportHeight / 2 + this.lineHeight / 2);
    } else {
      const viewportTop = viewport.scrollTop;
      const viewportBottom = viewportTop + viewportHeight;

      // Scroll up if cursor is above viewport (with margin)
      if (cursorY < viewportTop + scrollMargin) {
        viewport.scrollTop = Math.max(0, cursorY - scrollMargin);
      }
      // Scroll down if cursor is below viewport (with margin)
      else if (cursorY + this.lineHeight > viewportBottom - scrollMargin) {
        viewport.scrollTop = cursorY + this.lineHeight + scrollMargin - viewportHeight;
      }
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
   * @param key - 'home' or 'end'
   * @param isShift - Shift key pressed (for selection)
   * @param isCtrl - Ctrl/Cmd key pressed (for document start/end)
   * @param onClosingLine - Collapsed node info if on closing line
   */
  private _handleHomeEnd(key: string, isShift: boolean, isCtrl: boolean, onClosingLine: CollapsedNodeInfo | null): void {
    // Start selection if shift is pressed and no selection exists
    if (isShift && !this.selectionStart) {
      this.selectionStart = { line: this.cursorLine, column: this.cursorColumn };
    }

    if (key === 'home') {
      if (isCtrl) {
        // Ctrl+Home: go to start of document
        this.cursorLine = 0;
        this.cursorColumn = 0;
      } else if (onClosingLine) {
        // On closing line of collapsed node: go to start line
        this.cursorLine = onClosingLine.startLine;
        this.cursorColumn = 0;
      } else {
        // Go to start of line
        this.cursorColumn = 0;
      }
    } else {
      if (isCtrl) {
        // Ctrl+End: go to end of document
        this.cursorLine = this.lines.length - 1;
        this.cursorColumn = this.lines[this.cursorLine]?.length || 0;
      } else {
        // Go to end of line
        const lineLength = this.lines[this.cursorLine]?.length || 0;
        this.cursorColumn = lineLength;
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
   * Handle PageUp/PageDown
   */
  private _handlePageUpDown(direction: 'up' | 'down', isShift: boolean): void {
    // Start selection if shift is pressed and no selection exists
    if (isShift && !this.selectionStart) {
      this.selectionStart = { line: this.cursorLine, column: this.cursorColumn };
    }

    const viewport = this._viewport;
    if (!viewport) return;

    // Calculate how many lines fit in the viewport
    const linesPerPage = Math.floor(viewport.clientHeight / this.lineHeight);

    if (direction === 'up') {
      // Find current visible index and move up by page
      const currentVisibleIdx = this.visibleLines.findIndex(vl => vl.index === this.cursorLine);
      const newVisibleIdx = Math.max(0, currentVisibleIdx - linesPerPage);
      this.cursorLine = this.visibleLines[newVisibleIdx]?.index || 0;
    } else {
      // Find current visible index and move down by page
      const currentVisibleIdx = this.visibleLines.findIndex(vl => vl.index === this.cursorLine);
      const newVisibleIdx = Math.min(this.visibleLines.length - 1, currentVisibleIdx + linesPerPage);
      this.cursorLine = this.visibleLines[newVisibleIdx]?.index || this.lines.length - 1;
    }

    // Clamp cursor column to line length
    this.cursorColumn = Math.min(this.cursorColumn, this.lines[this.cursorLine]?.length || 0);

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
    // Don't scroll - viewport should stay in place when selecting all
    this.scheduleRender();
  }

  /**
   * Get selected text
   */
  private _getSelectedText(): string {
    const sel = this._normalizeSelection();
    if (!sel) return '';
    const { start, end } = sel;
    
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
  private _normalizeSelection(): { start: CursorPosition; end: CursorPosition } | null {
    if (!this.selectionStart || !this.selectionEnd) {
      return null;
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
   * Select word/token at given position (for double-click)
   */
  private _selectWordAt(line: number, column: number): void {
    if (line < 0 || line >= this.lines.length) return;
    const lineContent = this.lines[line];
    if (!lineContent || column > lineContent.length) return;

    // Define word characters (letters, digits, underscore, hyphen for JSON keys)
    const isWordChar = (ch: string) => /[\w\-]/.test(ch);

    // Check if we're inside a string (find surrounding quotes)
    let inString = false;
    let stringStart = -1;
    let stringEnd = -1;
    let escaped = false;

    for (let i = 0; i < lineContent.length; i++) {
      const ch = lineContent[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        if (!inString) {
          inString = true;
          stringStart = i;
        } else {
          stringEnd = i;
          // Check if column is within this string (including quotes)
          if (column >= stringStart && column <= stringEnd) {
            // Select the string content (without quotes)
            this.selectionStart = { line, column: stringStart + 1 };
            this.selectionEnd = { line, column: stringEnd };
            this.cursorLine = line;
            this.cursorColumn = stringEnd;
            return;
          }
          inString = false;
          stringStart = -1;
          stringEnd = -1;
        }
      }
    }

    // Not in a string - select word characters
    let start = column;
    let end = column;

    // Find start of word
    while (start > 0 && isWordChar(lineContent[start - 1])) {
      start--;
    }

    // Find end of word
    while (end < lineContent.length && isWordChar(lineContent[end])) {
      end++;
    }

    // If we found a word, select it
    if (start < end) {
      this.selectionStart = { line, column: start };
      this.selectionEnd = { line, column: end };
      this.cursorLine = line;
      this.cursorColumn = end;
    }
  }

  /**
   * Delete selected text
   */
  private _deleteSelection(): boolean {
    const sel = this._normalizeSelection();
    if (!sel) return false;
    const { start, end } = sel;

    this._saveToHistory('delete');

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
      const textLines = text.split('\n');
      const line = this.lines[this.cursorLine];
      const before = line.substring(0, this.cursorColumn);
      const after = line.substring(this.cursorColumn);

      if (textLines.length === 1) {
        // Single line insertion
        this.lines[this.cursorLine] = before + text + after;
        this.cursorColumn += text.length;
      } else {
        // Multi-line insertion
        const firstLine = before + textLines[0];
        const lastLine = textLines[textLines.length - 1] + after;
        const middleLines = textLines.slice(1, -1);

        this.lines.splice(this.cursorLine, 1, firstLine, ...middleLines, lastLine);
        this.cursorLine += textLines.length - 1;
        this.cursorColumn = textLines[textLines.length - 1].length;
      }
    }
    this.formatAndUpdate();
  }

  handlePaste(e: ClipboardEvent): void {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain');
    if (!text) return;

    // Save collapsed state of existing features before paste
    const existingCollapsedKeys = new Set<string>();
    for (const nodeId of this.collapsedNodes) {
      const nodeInfo = this._nodeIdToLines.get(nodeId);
      if (nodeInfo?.nodeKey) {
        const featureIndex = this._getFeatureIndexForLine(nodeInfo.startLine);
        existingCollapsedKeys.add(`${featureIndex}:${nodeInfo.nodeKey}`);
      }
    }
    const existingFeatureCount = this._parseFeatures().length;

    // Try to parse as GeoJSON and normalize
    let pastedFeatureCount = 0;
    try {
      // First try direct parse (single Feature, Feature[], or FeatureCollection)
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        // If direct parse fails, try wrapping with [] (for "feature, feature" format from editor copy)
        parsed = JSON.parse('[' + text + ']');
      }
      const features = normalizeToFeatures(parsed);
      pastedFeatureCount = features.length;
      // Valid GeoJSON - insert formatted features
      const formatted = features.map(f => JSON.stringify(f, null, 2)).join(',\n');
      this.insertText(formatted);
    } catch {
      // Invalid GeoJSON - fallback to raw text insertion
      this.insertText(text);
    }

    // Cancel any pending render from insertText/formatAndUpdate
    if (this.renderTimer) {
      cancelAnimationFrame(this.renderTimer);
      this.renderTimer = undefined;
    }

    // Auto-collapse coordinates for pasted features (if valid GeoJSON was pasted)
    // Note: We collapse even if there are errors (e.g., missing comma) because
    // the user will fix them and we want the coordinates already collapsed
    if (pastedFeatureCount > 0) {
      // Restore collapsed state for existing features and collapse new features' coordinates
      const ranges = this._findCollapsibleRanges();

      for (const range of ranges) {
        // Find which feature this range belongs to using the correct featureRanges map
        const featureIndex = this._getFeatureIndexForLine(range.startLine);
        if (featureIndex === -1) continue;

        if (featureIndex < existingFeatureCount) {
          // Existing feature - restore collapsed state
          const key = `${featureIndex}:${range.nodeKey}`;
          if (existingCollapsedKeys.has(key)) {
            this.collapsedNodes.add(range.nodeId);
          }
        } else {
          // New feature - collapse coordinates
          if (range.nodeKey === 'coordinates') {
            this.collapsedNodes.add(range.nodeId);
          }
        }
      }

      this.updateView();
    }

    // Expand any collapsed nodes that contain errors
    this._expandErrorNodes();

    // Force immediate render (not via RAF) to ensure content displays instantly
    this.renderViewport();

    // Ensure cursor is visible in viewport after paste
    // Use RAF to ensure layout is updated before scrolling
    requestAnimationFrame(() => {
      this._scrollToCursor();
    });
  }

  handleCopy(e: ClipboardEvent): void {
    e.preventDefault();
    if (!e.clipboardData) return;
    // Copy selected text if there's a selection, otherwise copy all
    if (this._hasSelection()) {
      e.clipboardData.setData('text/plain', this._getSelectedText());
    } else {
      e.clipboardData.setData('text/plain', this.getContent());
    }
  }

  handleCut(e: ClipboardEvent): void {
    e.preventDefault();
    if (!e.clipboardData) return;
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
    if (!viewport) return { line: 0, column: 0 };
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

  /**
   * Update selection during auto-scroll when dragging outside editor
   */
  private _updateSelectionFromScroll(direction: 'up' | 'down'): void {
    if (!this.visibleLines.length) return;

    if (direction === 'up') {
      // Scrolling up - select to first visible line
      const firstVisible = this.visibleLines[0];
      this.selectionEnd = { line: firstVisible.index, column: 0 };
      this.cursorLine = firstVisible.index;
      this.cursorColumn = 0;
    } else {
      // Scrolling down - select to last visible line
      const lastVisible = this.visibleLines[this.visibleLines.length - 1];
      const lineLength = lastVisible.content?.length || 0;
      this.selectionEnd = { line: lastVisible.index, column: lineLength };
      this.cursorLine = lastVisible.index;
      this.cursorColumn = lineLength;
    }
  }

  // ========== Gutter Interactions ==========
  
  handleGutterClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target) return;

    // Visibility button in gutter
    const visBtn = target.closest('.visibility-button') as HTMLElement | null;
    if (visBtn && visBtn.dataset.featureIndex !== undefined) {
      this.toggleFeatureVisibility(parseInt(visBtn.dataset.featureIndex, 10));
      return;
    }

    // Collapse button in gutter
    if (target.classList.contains('collapse-button')) {
      const nodeId = target.dataset.nodeId;
      if (nodeId) this.toggleCollapse(nodeId);
      return;
    }
  }
  
  handleEditorClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target) return;

    // Unblock render now that click is being processed
    this._blockRender = false;

    // Line-level visibility button (pseudo-element ::before on .line.has-visibility)
    const lineEl = target.closest('.line.has-visibility') as HTMLElement | null;
    if (lineEl) {
      const rect = lineEl.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      if (clickX < 14) {
        e.preventDefault();
        e.stopPropagation();
        const featureIndexStr = lineEl.dataset.featureIndex;
        if (featureIndexStr !== undefined) {
          this.toggleFeatureVisibility(parseInt(featureIndexStr, 10));
        }
        return;
      }
    }

    // Inline color swatch (pseudo-element positioned with left: -8px)
    if (target.classList.contains('json-color')) {
      const rect = target.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      // Pseudo-element is at left: -8px, so clickX will be negative when clicking on it
      if (clickX < 0 && clickX >= -8) {
        e.preventDefault();
        e.stopPropagation();
        const color = target.dataset.color;
        const targetLineEl = target.closest('.line') as HTMLElement | null;
        if (targetLineEl) {
          const lineIndex = parseInt(targetLineEl.dataset.lineIndex || '0');
          const line = this.lines[lineIndex];
          // Match any string attribute (hex or named color)
          // RE_ATTR_VALUE_SINGLE captures: [1] attributeName, [2] stringValue
          const match = line.match(RE_ATTR_VALUE_SINGLE);
          if (match && match[1] && color) {
            this.showColorPicker(target, lineIndex, color, match[1]);
          }
        }
        return;
      }
    }

    // Inline boolean checkbox (pseudo-element positioned with left: -8px)
    if (target.classList.contains('json-boolean')) {
      const rect = target.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      // Pseudo-element is at left: -8px, so clickX will be negative when clicking on it
      if (clickX < 0 && clickX >= -8) {
        e.preventDefault();
        e.stopPropagation();
        const targetLineEl = target.closest('.line') as HTMLElement | null;
        if (targetLineEl) {
          const lineIndex = parseInt(targetLineEl.dataset.lineIndex || '0');
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

  toggleCollapse(nodeId: string): void {
    const nodeInfo = this._nodeIdToLines.get(nodeId);
    if (this.collapsedNodes.has(nodeId)) {
      this.collapsedNodes.delete(nodeId);
      // Track that user opened this node - don't re-collapse during edits
      if (nodeInfo?.uniqueKey) {
        this._openedNodeKeys.add(nodeInfo.uniqueKey);
      }
    } else {
      this.collapsedNodes.add(nodeId);
      // User closed it - allow re-collapse
      if (nodeInfo?.uniqueKey) {
        this._openedNodeKeys.delete(nodeInfo.uniqueKey);
      }
    }

    // Use updateView - don't rebuild nodeId mappings since content didn't change
    this.updateView();
    this._invalidateRenderCache(); // Force re-render
    this.scheduleRender();
  }

  autoCollapseCoordinates() {
    // Don't collapse if there are errors - they should remain visible
    if (this._hasErrors()) {
      return;
    }
    this._applyCollapsedOption(['coordinates']);
  }

  /**
   * Check if current content has any errors (JSON parse errors or syntax highlighting errors)
   */
  private _hasErrors(): boolean {
    // Check JSON parse errors
    try {
      const content = this.lines.join('\n');
      const wrapped = '[' + content + ']';
      JSON.parse(wrapped);
    } catch {
      return true;
    }

    // Check for syntax highlighting errors (json-error class)
    for (const line of this.lines) {
      const highlighted = highlightSyntax(line, '', undefined);
      if (highlighted.includes('json-error')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Helper to apply collapsed option from API methods
   * Does not collapse if there are errors (so they remain visible)
   */
  private _applyCollapsedFromOptions(options: SetOptions, features: Feature[]): void {
    // Don't collapse if there are errors - they should remain visible
    if (this._hasErrors()) {
      return;
    }

    const collapsed = options.collapsed !== undefined ? options.collapsed : ['coordinates'];
    if (collapsed && (Array.isArray(collapsed) ? collapsed.length > 0 : true)) {
      this._applyCollapsedOption(collapsed, features);
    }
  }

  /**
   * Apply collapsed option to nodes
   */
  private _applyCollapsedOption(collapsed: string[] | ((feature: Feature | null, index: number) => string[]), features: Feature[] | null = null): void {
    const ranges = this._findCollapsibleRanges();

    // Determine which attributes to collapse per feature
    for (const range of ranges) {
      let shouldCollapse = false;

      if (typeof collapsed === 'function') {
        // Find which feature this range belongs to using the correct featureRanges map
        const featureIndex = this._getFeatureIndexForLine(range.startLine);
        if (featureIndex === -1) continue;

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

  toggleFeatureVisibility(featureIndex: number | undefined): void {
    if (featureIndex === undefined) return;
    if (this.hiddenFeatures.has(featureIndex)) {
      this.hiddenFeatures.delete(featureIndex);
    } else {
      this.hiddenFeatures.add(featureIndex);
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

    colorInput.addEventListener('input', (e) => {
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

  updateBooleanValue(line: number, newValue: boolean, attributeName: string): void {
    const regex = new RegExp(`"${attributeName}"\\s*:\\s*(true|false)`);
    this.lines[line] = this.lines[line].replace(regex, `"${attributeName}": ${newValue}`);
    
    // Use updateView to preserve collapsed state (line count didn't change)
    this.updateView();
    this.scheduleRender();
    this.emitChange();
  }

  // ========== Format and Update ==========

  /**
   * Best-effort formatting for invalid JSON
   * Splits on structural characters and indents as much as possible
   * @param content The content to format
   * @param skipLineIndex Optional line index to skip (keep as-is)
   */
  private _bestEffortFormat(content: string, skipLineIndex?: number): string[] {
    const sourceLines = content.split('\n');

    // If we have a line to skip, handle it specially
    if (skipLineIndex !== undefined && skipLineIndex >= 0 && skipLineIndex < sourceLines.length) {
      const skippedLine = sourceLines[skipLineIndex];

      // Format content before the skipped line
      const beforeContent = sourceLines.slice(0, skipLineIndex).join('\n');
      const beforeLines = beforeContent.trim() ? this._formatChunk(beforeContent) : [];

      // Keep skipped line exactly as-is (don't re-indent, user is typing on it)
      const depthBefore = this._computeDepthAtEnd(beforeLines);

      // Compute depth after the skipped line (including its brackets)
      const depthAfterSkipped = depthBefore + this._computeBracketDelta(skippedLine);

      // Format content after the skipped line, starting at correct depth
      const afterContent = sourceLines.slice(skipLineIndex + 1).join('\n');
      const afterLines = afterContent.trim() ? this._formatChunk(afterContent, depthAfterSkipped) : [];

      return [...beforeLines, skippedLine, ...afterLines];
    }

    // No line to skip - format everything
    return this._formatChunk(content);
  }

  /**
   * Compute the net bracket delta for a line (opens - closes)
   */
  private _computeBracketDelta(line: string): number {
    let delta = 0;
    let inString = false;
    let escaped = false;
    for (const char of line) {
      if (escaped) { escaped = false; continue; }
      if (char === '\\' && inString) { escaped = true; continue; }
      if (char === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (char === '{' || char === '[') delta++;
      else if (char === '}' || char === ']') delta--;
    }
    return delta;
  }

  /**
   * Compute the bracket depth at the end of formatted lines
   * Starts at 1 to account for FeatureCollection wrapper
   */
  private _computeDepthAtEnd(lines: string[]): number {
    let depth = 1; // Start at 1 for FeatureCollection wrapper
    for (const line of lines) {
      for (const char of line) {
        if (char === '{' || char === '[') depth++;
        else if (char === '}' || char === ']') depth = Math.max(0, depth - 1);
      }
    }
    return depth;
  }

  /**
   * Format a chunk of JSON content
   * @param content The content to format
   * @param initialDepth Starting indentation depth (default 1 for FeatureCollection wrapper)
   */
  private _formatChunk(content: string, initialDepth: number = 1): string[] {
    const result: string[] = [];
    let currentLine = '';
    let depth = initialDepth;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];

      // Track escape sequences inside strings
      if (escaped) {
        currentLine += char;
        escaped = false;
        continue;
      }

      if (char === '\\' && inString) {
        currentLine += char;
        escaped = true;
        continue;
      }

      // Track if we're inside a string
      if (char === '"') {
        inString = !inString;
        currentLine += char;
        continue;
      }

      // Inside string - just append
      if (inString) {
        currentLine += char;
        continue;
      }

      // Outside string - handle structural characters
      if (char === '{' || char === '[') {
        currentLine += char;
        result.push('  '.repeat(depth) + currentLine.trim());
        depth++;
        currentLine = '';
      } else if (char === '}' || char === ']') {
        if (currentLine.trim()) {
          result.push('  '.repeat(depth) + currentLine.trim());
        }
        depth = Math.max(0, depth - 1);
        currentLine = char;
      } else if (char === ',') {
        currentLine += char;
        result.push('  '.repeat(depth) + currentLine.trim());
        currentLine = '';
      } else if (char === ':') {
        currentLine += ': '; // Add space after colon for readability
        i++; // Skip if next char is space
        if (content[i] === ' ') continue;
        i--; // Not a space, go back
      } else if (char === '\n' || char === '\r') {
        // Ignore existing newlines
        continue;
      } else {
        currentLine += char;
      }
    }

    // Don't forget last line
    if (currentLine.trim()) {
      result.push('  '.repeat(depth) + currentLine.trim());
    }

    return result;
  }

  formatAndUpdate() {
    // Save cursor position
    const oldCursorLine = this.cursorLine;
    const oldCursorColumn = this.cursorColumn;
    const oldContent = this.lines.join('\n');

    // Save feature count before modification (for index adjustment)
    const oldFeatureCount = this._countFeatures(oldContent);
    const cursorFeatureIndex = this._getFeatureIndexForLine(oldCursorLine);

    try {
      const wrapped = '[' + oldContent + ']';
      const parsed = JSON.parse(wrapped);

      const formatted = JSON.stringify(parsed, null, 2);
      const lines = formatted.split('\n');
      this.lines = lines.slice(1, -1); // Remove wrapper brackets
    } catch {
      // Invalid JSON - apply best-effort formatting
      if (oldContent.trim()) {
        // Skip the cursor line only for small content (typing, not paste)
        // This avoids text jumping while user is typing
        // For paste/large insertions, format everything for proper structure
        const cursorLineContent = this.lines[oldCursorLine] || '';
        // If cursor line is short, likely typing. Long lines = paste
        const isSmallEdit = cursorLineContent.length < 80;
        const skipLine = isSmallEdit ? oldCursorLine : undefined;

        // Format and track where the skipped line ends up
        const sourceLines = oldContent.split('\n');
        const beforeLinesCount = skipLine !== undefined
          ? this._formatChunk(sourceLines.slice(0, skipLine).join('\n')).length
          : 0;

        this.lines = this._bestEffortFormat(oldContent, skipLine);

        // Update cursor line to point to the skipped line's new position
        if (skipLine !== undefined && beforeLinesCount >= 0) {
          this.cursorLine = beforeLinesCount;
        }
      }
    }

    const newContent = this.lines.join('\n');

    // If content didn't change, keep cursor exactly where it was
    if (newContent === oldContent) {
      this.cursorLine = oldCursorLine;
      this.cursorColumn = oldCursorColumn;
    } else {
      // Content changed due to reformatting
      // The cursor position (this.cursorLine, this.cursorColumn) was set by the calling
      // operation (insertText, insertNewline, etc.) BEFORE formatAndUpdate was called.
      // We need to adjust for indentation changes while keeping the logical position.

      // Special case: cursor at column 0 means we're at start of a line (after newline)
      // Keep both line and column as set by the calling operation
      if (oldCursorColumn === 0) {
        // cursorLine was already set by the calling operation, keep column at 0
        this.cursorColumn = 0;
      } else {
        // Calculate character offset in old content (ignoring whitespace for comparison)
        const oldLines = oldContent.split('\n');
        let oldCharOffset = 0;
        for (let i = 0; i < oldCursorLine && i < oldLines.length; i++) {
          oldCharOffset += oldLines[i].replace(/\s/g, '').length;
        }
        const oldLineContent = oldLines[oldCursorLine] || '';
        const oldLineUpToCursor = oldLineContent.substring(0, oldCursorColumn);
        oldCharOffset += oldLineUpToCursor.replace(/\s/g, '').length;

        // Find corresponding position in new content
        let charCount = 0;
        let newLine = 0;
        let newCol = 0;
        for (let i = 0; i < this.lines.length; i++) {
          const lineContent = this.lines[i];
          for (let j = 0; j <= lineContent.length; j++) {
            if (charCount >= oldCharOffset) {
              newLine = i;
              newCol = j;
              break;
            }
            if (j < lineContent.length && !/\s/.test(lineContent[j])) {
              charCount++;
            }
          }
          if (charCount >= oldCharOffset) break;
        }

        this.cursorLine = newLine;
        this.cursorColumn = newCol;
      }
    }

    // Clamp cursor to valid range
    this.cursorLine = Math.min(this.cursorLine, Math.max(0, this.lines.length - 1));
    this.cursorColumn = Math.min(this.cursorColumn, this.lines[this.cursorLine]?.length || 0);

    // Adjust hidden feature indices if feature count changed
    const finalContent = this.lines.join('\n');
    const newFeatureCount = this._countFeatures(finalContent);
    if (oldFeatureCount >= 0 && newFeatureCount >= 0 && oldFeatureCount !== newFeatureCount) {
      const delta = newFeatureCount - oldFeatureCount;
      // Use cursor position to determine insertion point
      // If cursor was inside a feature, changes happened at/after that feature
      const insertionIndex = cursorFeatureIndex >= 0 ? cursorFeatureIndex : 0;
      this._adjustHiddenIndices(insertionIndex, delta);
    }

    this.updateModel();

    // Expand any nodes that contain errors (prevents closing edited nodes with typos)
    this._expandErrorNodes();

    this.scheduleRender();
    this.updatePlaceholderVisibility();
    this._updateErrorDisplay();
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
        parsed.features = parsed.features.filter((_feature: Feature, index: number) => {
          return !this.hiddenFeatures.has(index);
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
        detail: { error: e instanceof Error ? e.message : 'Unknown error', content },
        bubbles: true,
        composed: true
      }));
    }
  }

  /**
   * Emit current-features event when cursor/selection changes
   * Includes all features that overlap with the selection (or just cursor position if no selection)
   * If cursor is inside an expanded coordinates block, emits Point features for each coordinate line
   * Only emits when the set of features changes (not on every cursor move)
   * @param force - If true, emit even if features haven't changed (used on focus)
   */
  private _emitCurrentFeature(force: boolean = false): void {
    // Determine the line range to check
    let startLine: number;
    let endLine: number;

    if (this.selectionStart && this.selectionEnd) {
      startLine = Math.min(this.selectionStart.line, this.selectionEnd.line);
      endLine = Math.max(this.selectionStart.line, this.selectionEnd.line);
    } else {
      startLine = this.cursorLine;
      endLine = this.cursorLine;
    }

    // Check if we're inside an expanded coordinates block
    const coordinatePoints = this._getCoordinatePointsInRange(startLine, endLine);

    if (coordinatePoints.length > 0) {
      // We're inside coordinates - emit Points
      const pointsKey = 'coords:' + JSON.stringify(coordinatePoints);
      if (!force && pointsKey === this._lastCurrentFeatureIndices) return;
      this._lastCurrentFeatureIndices = pointsKey;

      const features = coordinatePoints.map(coord => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: coord
        },
        properties: {}
      }));

      this.dispatchEvent(new CustomEvent('current-features', {
        detail: { type: 'FeatureCollection', features },
        bubbles: true,
        composed: true
      }));
      return;
    }

    // Not in coordinates - use normal feature detection
    const featureIndices = this._getFeatureIndicesForCurrentSelection();
    const indicesKey = JSON.stringify(featureIndices);

    if (!force && indicesKey === this._lastCurrentFeatureIndices) return;
    this._lastCurrentFeatureIndices = indicesKey;

    if (featureIndices.length === 0) {
      // Cursor/selection is not in any feature - emit empty FeatureCollection
      this.dispatchEvent(new CustomEvent('current-features', {
        detail: { type: 'FeatureCollection', features: [] },
        bubbles: true,
        composed: true
      }));
    } else {
      // Get all features that overlap with cursor/selection
      const allFeatures = this._parseFeatures();
      const selectedFeatures = featureIndices
        .map(idx => allFeatures[idx])
        .filter(f => f != null);

      this.dispatchEvent(new CustomEvent('current-features', {
        detail: { type: 'FeatureCollection', features: selectedFeatures },
        bubbles: true,
        composed: true
      }));
    }
  }

  /**
   * Get coordinate points from lines in the given range if inside an expanded coordinates block
   * Returns array of [lng, lat] or [lng, lat, alt] coordinates
   * Handles both compact format ([lng, lat] on one line) and expanded format (multiline)
   */
  private _getCoordinatePointsInRange(startLine: number, endLine: number): number[][] {
    const points: number[][] = [];
    const ranges = this._findCollapsibleRanges();

    // Find coordinates blocks that contain our line range
    const coordsRanges = ranges.filter(r =>
      r.nodeKey === 'coordinates' &&
      !this.collapsedNodes.has(r.nodeId) && // Only if expanded
      startLine >= r.startLine &&
      startLine <= r.endLine
    );

    if (coordsRanges.length === 0) return points;

    // Get the coordinates block content and parse it
    const coordsRange = coordsRanges[0];
    const coordsContent = this.lines.slice(coordsRange.startLine, coordsRange.endLine + 1).join('\n');

    // Extract the array part after "coordinates":
    const arrayMatch = coordsContent.match(/"coordinates"\s*:\s*(\[[\s\S]*)/);
    if (!arrayMatch) return points;

    // Try to parse the coordinates array
    try {
      // Find the matching closing bracket for the coordinates array
      let depth = 0;
      let arrayStr = '';
      let started = false;
      for (const char of arrayMatch[1]) {
        if (char === '[') { depth++; started = true; }
        if (started) arrayStr += char;
        if (char === ']') { depth--; if (depth === 0) break; }
      }

      const coordsArray = JSON.parse(arrayStr);

      // Flatten to get all coordinate pairs (handles Point, LineString, Polygon, MultiPolygon)
      const flatCoords = this._flattenCoordinates(coordsArray);

      // Map each coordinate to its approximate line range and check if cursor is in it
      // We'll compute which coordinates the cursor/selection overlaps with
      const selectedCoords = this._findCoordinatesAtLines(
        coordsRange.startLine,
        coordsRange.endLine,
        startLine,
        endLine,
        flatCoords
      );

      for (const coord of selectedCoords) {
        // Validate it looks like a real coordinate (lng: -180 to 180, lat: -90 to 90)
        if (coord.length >= 2 && Math.abs(coord[0]) <= 180 && Math.abs(coord[1]) <= 90) {
          points.push(coord);
        }
      }
    } catch {
      // If parsing fails, fall back to simple line matching
      for (let i = startLine; i <= endLine; i++) {
        const line = this.lines[i];
        if (!line) continue;

        // Match compact coordinate patterns: [lng, lat] or [lng, lat, alt]
        const coordMatch = line.match(/\[\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)(?:\s*,\s*(-?\d+\.?\d*))?\s*\]/);
        if (coordMatch) {
          const coord = [parseFloat(coordMatch[1]), parseFloat(coordMatch[2])];
          if (coordMatch[3] !== undefined) {
            coord.push(parseFloat(coordMatch[3]));
          }
          if (Math.abs(coord[0]) <= 180 && Math.abs(coord[1]) <= 90) {
            points.push(coord);
          }
        }
      }
    }

    return points;
  }

  /**
   * Flatten nested coordinate arrays to get all [lng, lat] pairs
   */
  private _flattenCoordinates(coords: unknown): number[][] {
    const result: number[][] = [];

    const flatten = (arr: unknown): void => {
      if (!Array.isArray(arr)) return;
      // Check if this is a coordinate pair (array of 2-3 numbers)
      if (arr.length >= 2 && arr.length <= 3 && arr.every(n => typeof n === 'number')) {
        result.push(arr as number[]);
      } else {
        // Recurse into nested arrays
        for (const item of arr) {
          flatten(item);
        }
      }
    };

    flatten(coords);
    return result;
  }

  /**
   * Find which coordinates from flatCoords are at the given cursor/selection lines
   * Uses a simple heuristic based on line distribution
   */
  private _findCoordinatesAtLines(
    blockStart: number,
    blockEnd: number,
    cursorStart: number,
    cursorEnd: number,
    flatCoords: number[][]
  ): number[][] {
    if (flatCoords.length === 0) return [];

    // Calculate total lines in the coordinates block (excluding the "coordinates": line itself)
    const totalLines = blockEnd - blockStart;
    if (totalLines <= 0) return flatCoords.length === 1 ? flatCoords : [];

    // Estimate lines per coordinate (approximate)
    const linesPerCoord = totalLines / flatCoords.length;

    // Find which coordinates the cursor/selection overlaps with
    const result: number[][] = [];
    const relativeStart = cursorStart - blockStart;
    const relativeEnd = cursorEnd - blockStart;

    for (let i = 0; i < flatCoords.length; i++) {
      const coordLineStart = Math.floor(i * linesPerCoord);
      const coordLineEnd = Math.floor((i + 1) * linesPerCoord);

      // Check if this coordinate's line range overlaps with cursor/selection
      if (coordLineStart <= relativeEnd && coordLineEnd >= relativeStart) {
        result.push(flatCoords[i]);
      }
    }

    // If no match found but we're in the block, return the closest coordinate
    if (result.length === 0 && flatCoords.length > 0) {
      const relativePos = (cursorStart - blockStart) / totalLines;
      const coordIndex = Math.min(Math.floor(relativePos * flatCoords.length), flatCoords.length - 1);
      result.push(flatCoords[Math.max(0, coordIndex)]);
    }

    return result;
  }

  /**
   * Get all feature indices that overlap with the current cursor position or selection
   * Returns sorted unique indices
   */
  private _getFeatureIndicesForCurrentSelection(): number[] {
    const indices = new Set<number>();

    // Determine the line range to check
    let startLine: number;
    let endLine: number;

    if (this.selectionStart && this.selectionEnd) {
      // Selection exists - get all features overlapping the selection
      startLine = Math.min(this.selectionStart.line, this.selectionEnd.line);
      endLine = Math.max(this.selectionStart.line, this.selectionEnd.line);
    } else {
      // No selection - just use cursor position
      startLine = this.cursorLine;
      endLine = this.cursorLine;
    }

    // Find all features that overlap with the line range
    for (const [, range] of this.featureRanges) {
      // Check if feature range overlaps with selection range
      if (range.startLine <= endLine && range.endLine >= startLine) {
        indices.add(range.featureIndex);
      }
    }

    // Return sorted array for consistent comparison
    return Array.from(indices).sort((a, b) => a - b);
  }

  /**
   * Emit current-features with empty FeatureCollection (used on blur)
   * Always emits to ensure map is cleared when editor loses focus
   */
  private _emitCurrentFeatureNull(): void {
    this._lastCurrentFeatureIndices = null;
    this.dispatchEvent(new CustomEvent('current-features', {
      detail: { type: 'FeatureCollection', features: [] },
      bubbles: true,
      composed: true
    }));
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

  /**
   * Update error display (counter and navigation visibility)
   */
  private _updateErrorDisplay() {
    const errorLines = this._getErrorLines();
    const count = errorLines.length;

    if (this._errorNav) {
      this._errorNav.classList.toggle('visible', count > 0);
    }
    if (this._errorCount) {
      this._errorCount.textContent = count > 0 ? String(count) : '';
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

      const openBracket = kvMatch ? kvMatch[2] : (rootMatch ? rootMatch[1] : '{');
      
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

  private _findClosingLine(startLine: number, openBracket: string): number {
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

    const contextMap = new Map<number, string>();
    const contextStack: { context: string; isArray: boolean }[] = [];
    let pendingContext: string | null = null;

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
    const existingCount = this._parseFeatures().length;
    const allFeatures = [...this._parseFeatures(), ...newFeatures];
    // Preserve collapsed state for existing features, apply options only to new ones
    this._setFeaturesInternalPreserving(allFeatures, options, existingCount);
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
    const insertIdx = Math.max(0, Math.min(idx, features.length));

    // Adjust hidden feature indices before insertion
    // Features at or after insertIdx need to shift by newFeatures.length
    this._adjustHiddenIndices(insertIdx, newFeatures.length);

    features.splice(insertIdx, 0, ...newFeatures);
    // Preserve collapsed state, apply options only to inserted features
    this._setFeaturesInternalPreserving(features, options, insertIdx, newFeatures.length);
  }

  /**
   * Internal method to set features with formatting and collapse options
   */
  private _setFeaturesInternal(features: Feature[], options: SetOptions): void {
    const formatted = features.map(f => JSON.stringify(f, null, 2)).join(',\n');
    this.setValue(formatted, false);
    this._applyCollapsedFromOptions(options, features);
  }

  /**
   * Internal method to set features while preserving collapsed state of existing features
   * @param features All features (existing + new)
   * @param options Collapse options for new features
   * @param newStartIndex Index where new features start (for add) or were inserted (for insertAt)
   * @param newCount Number of new features (optional, defaults to features from newStartIndex to end)
   */
  private _setFeaturesInternalPreserving(
    features: Feature[],
    options: SetOptions,
    newStartIndex: number,
    newCount?: number
  ): void {
    // Save collapsed state by nodeKey before modification
    const collapsedKeys = new Set<string>();
    for (const nodeId of this.collapsedNodes) {
      const nodeInfo = this._nodeIdToLines.get(nodeId);
      if (nodeInfo?.nodeKey) {
        // Include feature index in key to handle multiple features with same structure
        const featureIndex = this._getFeatureIndexForLine(nodeInfo.startLine);
        collapsedKeys.add(`${featureIndex}:${nodeInfo.nodeKey}`);
      }
    }

    // Save hidden features (already adjusted by caller for insert/remove)
    const savedHiddenFeatures = new Set(this.hiddenFeatures);

    // Format and set content
    const formatted = features.map(f => JSON.stringify(f, null, 2)).join(',\n');
    this.setValue(formatted, false);

    // Restore hidden features
    this.hiddenFeatures = savedHiddenFeatures;

    // Restore collapsed state for existing features
    const ranges = this._findCollapsibleRanges();
    const actualNewCount = newCount !== undefined ? newCount : features.length - newStartIndex;

    for (const range of ranges) {
      // Find which feature this range belongs to using the correct featureRanges map
      const featureIndex = this._getFeatureIndexForLine(range.startLine);
      if (featureIndex === -1) continue;

      // Determine if this is an existing feature (adjust index for insertAt case)
      let originalFeatureIndex = featureIndex;
      if (featureIndex >= newStartIndex && featureIndex < newStartIndex + actualNewCount) {
        // This is a new feature - apply options later
        continue;
      } else if (featureIndex >= newStartIndex + actualNewCount) {
        // Feature was shifted by insertion - adjust index
        originalFeatureIndex = featureIndex - actualNewCount;
      }

      // Check if this node was collapsed before
      const key = `${originalFeatureIndex}:${range.nodeKey}`;
      if (collapsedKeys.has(key)) {
        this.collapsedNodes.add(range.nodeId);
      }
    }

    // Apply collapse options to new features only
    this._applyCollapsedToNewFeatures(options, features, newStartIndex, actualNewCount);

    // Use updateView instead of updateModel since setValue already rebuilt mappings
    // and we just need to recompute visible lines with new collapsed state
    this.updateView();
    this.scheduleRender();
  }

  /**
   * Apply collapsed options only to specific new features
   */
  private _applyCollapsedToNewFeatures(
    options: SetOptions,
    features: Feature[],
    startIndex: number,
    count: number
  ): void {
    const collapsed = options.collapsed !== undefined ? options.collapsed : ['coordinates'];
    if (!collapsed || (Array.isArray(collapsed) && collapsed.length === 0)) return;

    const ranges = this._findCollapsibleRanges();

    for (const range of ranges) {
      // Find which feature this range belongs to using the correct featureRanges map
      const featureIndex = this._getFeatureIndexForLine(range.startLine);
      if (featureIndex === -1) continue;

      // Only process new features
      if (featureIndex < startIndex || featureIndex >= startIndex + count) continue;

      let shouldCollapse = false;
      if (typeof collapsed === 'function') {
        const feature = features[featureIndex];
        const collapsedAttrs = collapsed(feature, featureIndex);
        shouldCollapse = range.isRootFeature
          ? collapsedAttrs.includes('$root')
          : collapsedAttrs.includes(range.nodeKey);
      } else if (Array.isArray(collapsed)) {
        shouldCollapse = range.isRootFeature
          ? collapsed.includes('$root')
          : collapsed.includes(range.nodeKey);
      }

      if (shouldCollapse) {
        this.collapsedNodes.add(range.nodeId);
      }
    }
  }

  /**
   * Get feature index for a given line
   */
  /**
   * Count features in content (returns -1 if JSON invalid)
   */
  private _countFeatures(content: string): number {
    try {
      const wrapped = '[' + content + ']';
      const parsed = JSON.parse(wrapped);
      return Array.isArray(parsed) ? parsed.length : -1;
    } catch {
      return -1;
    }
  }

  /**
   * Adjust hiddenFeatures indices when features are inserted or removed
   * @param insertionIndex - Index where features were inserted (or removed from)
   * @param delta - Number of features added (positive) or removed (negative)
   */
  private _adjustHiddenIndices(insertionIndex: number, delta: number): void {
    if (delta === 0 || this.hiddenFeatures.size === 0) return;

    const newHiddenFeatures = new Set<number>();
    for (const idx of this.hiddenFeatures) {
      if (idx < insertionIndex) {
        // Before insertion point - keep same index
        newHiddenFeatures.add(idx);
      } else {
        // At or after insertion point - shift by delta
        const newIdx = idx + delta;
        if (newIdx >= 0) {
          newHiddenFeatures.add(newIdx);
        }
        // If newIdx < 0, the feature was removed, so we don't add it
      }
    }
    this.hiddenFeatures = newHiddenFeatures;
  }

  /**
   * Remove a hidden index and shift all indices after it by -1
   * Used when removing a feature via API
   */
  private _removeAndShiftHiddenIndex(removedIndex: number): void {
    if (this.hiddenFeatures.size === 0) return;

    const newHiddenFeatures = new Set<number>();
    for (const idx of this.hiddenFeatures) {
      if (idx < removedIndex) {
        // Before removed index - keep same
        newHiddenFeatures.add(idx);
      } else if (idx > removedIndex) {
        // After removed index - shift by -1
        newHiddenFeatures.add(idx - 1);
      }
      // idx === removedIndex is dropped (feature was removed)
    }
    this.hiddenFeatures = newHiddenFeatures;
  }

  private _getFeatureIndexForLine(line: number): number {
    for (const [, range] of this.featureRanges) {
      if (line >= range.startLine && line <= range.endLine) {
        return range.featureIndex;
      }
    }
    return -1;
  }

  removeAt(index: number): Feature | undefined {
    const features = this._parseFeatures();
    const idx = index < 0 ? features.length + index : index;
    if (idx >= 0 && idx < features.length) {
      // Save collapsed state by nodeKey before modification
      const collapsedKeys = new Set<string>();
      for (const nodeId of this.collapsedNodes) {
        const nodeInfo = this._nodeIdToLines.get(nodeId);
        if (nodeInfo?.nodeKey) {
          const featureIndex = this._getFeatureIndexForLine(nodeInfo.startLine);
          // Skip the feature being removed, adjust indices for features after it
          if (featureIndex === idx) continue;
          const adjustedIndex = featureIndex > idx ? featureIndex - 1 : featureIndex;
          collapsedKeys.add(`${adjustedIndex}:${nodeInfo.nodeKey}`);
        }
      }

      // Adjust hidden feature indices: remove idx, shift indices after idx by -1
      this._removeAndShiftHiddenIndex(idx);

      // Save hidden features before setValue (which clears them)
      const savedHiddenFeatures = new Set(this.hiddenFeatures);

      const removed = features.splice(idx, 1)[0];

      // Format and set content
      const formatted = features.map((f: Feature) => JSON.stringify(f, null, 2)).join(',\n');
      this.setValue(formatted, false);

      // Restore hidden features
      this.hiddenFeatures = savedHiddenFeatures;

      // Restore collapsed state for remaining features
      const ranges = this._findCollapsibleRanges();

      for (const range of ranges) {
        // Find which feature this range belongs to using the correct featureRanges map
        const featureIndex = this._getFeatureIndexForLine(range.startLine);
        if (featureIndex === -1) continue;

        const key = `${featureIndex}:${range.nodeKey}`;
        if (collapsedKeys.has(key)) {
          this.collapsedNodes.add(range.nodeId);
        }
      }

      // Use updateView instead of updateModel since setValue already rebuilt mappings
      this.updateView();
      this.scheduleRender();
      this.emitChange();
      // Invalidate current-features cache and emit if focused (feature removal changes context)
      this._lastCurrentFeatureIndices = null;
      if (this._editorWrapper?.classList.contains('focused')) {
        this._emitCurrentFeature(true);
      }
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
    this.cursorLine = 0;
    this.cursorColumn = 0;
    this.selectionStart = null;
    this.selectionEnd = null;
    this.updateModel();
    this.scheduleRender();
    this.updatePlaceholderVisibility();
    this.emitChange();
    // Invalidate current-features cache and emit empty if focused (all features removed)
    this._lastCurrentFeatureIndices = null;
    if (this._editorWrapper?.classList.contains('focused')) {
      this._emitCurrentFeature(true);
    }
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

      input.addEventListener('change', (e) => {
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

  /**
   * Handle Ctrl+I shortcut - prompt user to add Feature/Features/FeatureCollection
   */
  private _handleAddFeaturePrompt(): void {
    const input = prompt('Enter GeoJSON (Feature, Feature[], or FeatureCollection):');
    if (!input || !input.trim()) return;

    try {
      const parsed = JSON.parse(input);
      const features = normalizeToFeatures(parsed);
      if (features.length > 0) {
        this.add(features);
      }
    } catch {
      // Invalid JSON - ignore silently
    }
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
