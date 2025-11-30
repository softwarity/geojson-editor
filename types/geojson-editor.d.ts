import type { Feature } from 'geojson';
import type { CursorPosition, SetOptions, ThemeSettings, LineMeta, VisibleLine, FeatureRange, FeatureInput } from './types.js';
export type { GeometryType, CursorPosition, SetOptions, ThemeConfig, ThemeSettings, FeatureInput } from './types.js';
/**
 * GeoJSON Editor Web Component
 * Monaco-like architecture with virtualized line rendering
 */
declare class GeoJsonEditor extends HTMLElement {
    lines: string[];
    collapsedNodes: Set<string>;
    hiddenFeatures: Set<string>;
    private _nodeIdCounter;
    private _lineToNodeId;
    private _nodeIdToLines;
    visibleLines: VisibleLine[];
    lineMetadata: Map<number, LineMeta>;
    featureRanges: Map<string, FeatureRange>;
    viewportHeight: number;
    lineHeight: number;
    bufferLines: number;
    private _lastStartIndex;
    private _lastEndIndex;
    private _lastTotalLines;
    private _scrollRaf;
    cursorLine: number;
    cursorColumn: number;
    selectionStart: CursorPosition | null;
    selectionEnd: CursorPosition | null;
    private renderTimer;
    private inputTimer;
    themes: ThemeSettings;
    private _undoStack;
    private _redoStack;
    private _maxHistorySize;
    private _lastActionTime;
    private _lastActionType;
    private _groupingDelay;
    private _isSelecting;
    private _isComposing;
    private _blockRender;
    private _charWidth;
    private _contextMapCache;
    private _contextMapLinesLength;
    private _contextMapFirstLine;
    private _contextMapLastLine;
    private _viewport;
    private _linesContainer;
    private _scrollContent;
    private _hiddenTextarea;
    private _gutterContent;
    private _gutterScrollContent;
    private _gutterScroll;
    private _gutter;
    private _clearBtn;
    private _editorWrapper;
    private _placeholderLayer;
    private _editorPrefix;
    private _editorSuffix;
    constructor();
    _invalidateRenderCache(): void;
    /**
     * Create a snapshot of current editor state
     * @returns {Object} State snapshot
     */
    _createSnapshot(): {
        lines: string[];
        cursorLine: number;
        cursorColumn: number;
        timestamp: number;
    };
    /**
     * Restore editor state from snapshot
     * @param {Object} snapshot - State to restore
     */
    _restoreSnapshot(snapshot: any): void;
    /**
     * Save current state to undo stack before making changes
     * @param {string} actionType - Type of action (insert, delete, paste, etc.)
     */
    _saveToHistory(actionType?: string): void;
    /**
     * Undo last action
     * @returns {boolean} True if undo was performed
     */
    undo(): boolean;
    /**
     * Redo previously undone action
     * @returns {boolean} True if redo was performed
     */
    redo(): boolean;
    /**
     * Clear undo/redo history
     */
    clearHistory(): void;
    /**
     * Check if undo is available
     * @returns {boolean}
     */
    canUndo(): boolean;
    /**
     * Check if redo is available
     * @returns {boolean}
     */
    canRedo(): boolean;
    _generateNodeId(): string;
    /**
     * Check if a line is inside a collapsed node (hidden lines between opening and closing)
     * @param {number} lineIndex - The line index to check
     * @returns {Object|null} - The collapsed range info or null
     */
    _getCollapsedRangeForLine(lineIndex: any): {
        startLine: number;
        endLine: number;
        nodeKey?: string;
        isRootFeature?: boolean;
        nodeId: string;
    };
    /**
     * Check if cursor is on the closing line of a collapsed node
     * @param {number} lineIndex - The line index to check
     * @returns {Object|null} - The collapsed range info or null
     */
    _getCollapsedClosingLine(lineIndex: any): {
        startLine: number;
        endLine: number;
        nodeKey?: string;
        isRootFeature?: boolean;
        nodeId: string;
    };
    /**
     * Get the position of the closing bracket on a line
     * @param {string} line - The line content
     * @returns {number} - Position of bracket or -1
     */
    _getClosingBracketPos(line: any): number;
    /**
     * Check if cursor is on the opening line of a collapsed node
     * @param {number} lineIndex - The line index to check
     * @returns {Object|null} - The collapsed range info or null
     */
    _getCollapsedNodeAtLine(lineIndex: any): {
        startLine: number;
        endLine: number;
        nodeKey?: string;
        isRootFeature?: boolean;
        nodeId: string;
    };
    /**
     * Check if cursor is on a line that has a collapsible node (expanded or collapsed)
     * @param {number} lineIndex - The line index to check
     * @returns {Object|null} - The node info with isCollapsed flag or null
     */
    _getCollapsibleNodeAtLine(lineIndex: any): {
        startLine: number;
        endLine: number;
        nodeKey?: string;
        isRootFeature?: boolean;
        nodeId: string;
        isCollapsed: boolean;
    };
    /**
     * Find the innermost expanded node that contains the given line
     * Used for Shift+Tab to collapse the parent node from anywhere inside it
     * @param {number} lineIndex - The line index to check
     * @returns {Object|null} - The containing node info or null
     */
    _getContainingExpandedNode(lineIndex: any): any;
    /**
     * Delete an entire collapsed node (opening line to closing line)
     * @param {Object} range - The range info {startLine, endLine}
     */
    _deleteCollapsedNode(range: any): void;
    /**
     * Rebuild nodeId mappings after content changes
     * Preserves collapsed state by matching nodeKey + sequential occurrence
     */
    _rebuildNodeIdMappings(): void;
    static get observedAttributes(): string[];
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(name: any, oldValue: any, newValue: any): void;
    get readonly(): boolean;
    get value(): string;
    get placeholder(): string;
    get prefix(): string;
    get suffix(): string;
    render(): void;
    _cacheElements(): void;
    setupEventListeners(): void;
    /**
     * Set the editor content from a string value
     */
    setValue(value: any, autoCollapse?: boolean): void;
    /**
     * Get full content as string (expanded, no hidden markers)
     */
    getContent(): string;
    /**
     * Update derived state from model
     * Rebuilds line-to-nodeId mapping while preserving collapsed state
     */
    updateModel(): void;
    /**
     * Update view state without rebuilding nodeId mappings
     * Used for collapse/expand operations where content doesn't change
     */
    updateView(): void;
    /**
     * Compute feature ranges (which lines belong to which feature)
     */
    computeFeatureRanges(): void;
    /**
     * Compute metadata for each line (colors, booleans, collapse buttons, etc.)
     */
    computeLineMetadata(): void;
    /**
     * Compute which lines are visible (not inside collapsed nodes)
     */
    computeVisibleLines(): void;
    scheduleRender(): void;
    renderViewport(): void;
    /**
     * Insert cursor element at the specified column position
     * Uses absolute positioning to avoid affecting text layout
     */
    _insertCursor(column: any): string;
    /**
     * Add selection highlight to a line
     */
    _addSelectionHighlight(html: any, lineIndex: any, content: any): any;
    /**
     * Get character width for monospace font
     */
    _getCharWidth(): number;
    renderGutter(startIndex: any, endIndex: any): void;
    syncGutterScroll(): void;
    handleInput(): void;
    handleKeydown(e: any): void;
    _handleEnter(ctx: any): void;
    _handleBackspace(ctx: any): void;
    _handleDelete(ctx: any): void;
    _handleTab(isShiftKey: any, ctx: any): void;
    insertNewline(): void;
    deleteBackward(): void;
    deleteForward(): void;
    /**
     * Move cursor vertically, skipping hidden collapsed lines only
     */
    moveCursorSkipCollapsed(deltaLine: any): void;
    /**
     * Move cursor horizontally with smart navigation around collapsed nodes
     */
    moveCursorHorizontal(delta: any): void;
    _moveCursorRight(): void;
    _moveCursorLeft(): void;
    /**
     * Scroll viewport to ensure cursor is visible
     */
    _scrollToCursor(): void;
    /**
     * Handle arrow key with optional selection and word jump
     */
    _handleArrowKey(deltaLine: any, deltaCol: any, isShift: any, isCtrl?: boolean): void;
    /**
     * Move cursor by word (Ctrl+Arrow)
     * Behavior matches VSCode/Monaco:
     * - Ctrl+Right: move to end of current word, or start of next word
     * - Ctrl+Left: move to start of current word, or start of previous word
     */
    _moveCursorByWord(direction: any): void;
    /**
     * Handle Home/End with optional selection
     */
    _handleHomeEnd(key: any, isShift: any, onClosingLine: any): void;
    /**
     * Select all content
     */
    _selectAll(): void;
    /**
     * Get selected text
     */
    _getSelectedText(): string;
    /**
     * Normalize selection so start is before end
     */
    _normalizeSelection(): {
        start: CursorPosition;
        end: CursorPosition;
    };
    /**
     * Check if there is an active selection
     */
    _hasSelection(): boolean;
    /**
     * Clear the current selection
     */
    _clearSelection(): void;
    /**
     * Delete selected text
     */
    _deleteSelection(): boolean;
    insertText(text: any): void;
    handlePaste(e: any): void;
    handleCopy(e: any): void;
    handleCut(e: any): void;
    /**
     * Get line/column position from mouse event
     */
    _getPositionFromClick(e: any): {
        line: number;
        column: number;
    };
    handleGutterClick(e: any): void;
    handleEditorClick(e: any): void;
    toggleCollapse(nodeId: any): void;
    autoCollapseCoordinates(): void;
    /**
     * Helper to apply collapsed option from API methods
     * @param {object} options - Options object with optional collapsed property
     * @param {array} features - Features array for function mode
     */
    _applyCollapsedFromOptions(options: any, features: any): void;
    /**
     * Apply collapsed option to nodes
     * @param {string[]|function} collapsed - Attributes to collapse or function returning them
     * @param {array} features - Features array for function mode (optional)
     */
    _applyCollapsedOption(collapsed: any, features?: any): void;
    toggleFeatureVisibility(featureKey: any): void;
    showColorPicker(indicator: HTMLElement, line: number, currentColor: string, attributeName: string): void;
    updateColorValue(line: any, newColor: any, attributeName: any): void;
    updateBooleanValue(line: any, newValue: any, attributeName: any): void;
    formatAndUpdate(): void;
    emitChange(): void;
    updateReadonly(): void;
    updatePlaceholderVisibility(): void;
    updatePlaceholderContent(): void;
    updatePrefixSuffix(): void;
    updateThemeCSS(): void;
    setTheme(theme: ThemeSettings): void;
    resetTheme(): void;
    /**
     * Find all collapsible ranges using the mappings built by _rebuildNodeIdMappings
     * This method only READS the existing mappings, it doesn't create new IDs
     */
    _findCollapsibleRanges(): any[];
    _findClosingLine(startLine: any, openBracket: any): any;
    _buildContextMap(): Map<any, any>;
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
    set(input: FeatureInput, options?: SetOptions): void;
    /**
     * Add features to the end of the editor
     * Accepts: FeatureCollection, Feature[], or single Feature
     * @param {object|array} input - Features to add
     * @param {object} options - Optional settings
     * @param {string[]|function} options.collapsed - Attributes to collapse (default: ['coordinates'])
     * @throws {Error} If input is invalid
     */
    add(input: FeatureInput, options?: SetOptions): void;
    /**
     * Insert features at a specific index
     * Accepts: FeatureCollection, Feature[], or single Feature
     * @param {object|array} input - Features to insert
     * @param {number} index - Index to insert at (negative = from end)
     * @param {object} options - Optional settings
     * @param {string[]|function} options.collapsed - Attributes to collapse (default: ['coordinates'])
     * @throws {Error} If input is invalid
     */
    insertAt(input: FeatureInput, index: number, options?: SetOptions): void;
    removeAt(index: number): Feature | undefined;
    removeAll(): Feature[];
    get(index: number): Feature | undefined;
    getAll(): Feature[];
    emit(): void;
    /**
     * Save GeoJSON to a file (triggers download)
     */
    save(filename?: string): boolean;
    /**
     * Open a GeoJSON file from the client filesystem
     * Note: Available even in readonly mode via API (only Ctrl+O shortcut is blocked)
     * @param {object} options - Optional settings
     * @param {string[]|function} options.collapsed - Attributes to collapse (default: ['coordinates'])
     * @returns {Promise<boolean>} Promise that resolves to true if file was loaded successfully
     */
    open(options?: SetOptions): Promise<boolean>;
    _parseFeatures(): any;
}
export default GeoJsonEditor;
