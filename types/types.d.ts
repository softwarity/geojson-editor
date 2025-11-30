import type { Feature, FeatureCollection } from 'geojson';
/** Geometry type names */
export type GeometryType = 'Point' | 'MultiPoint' | 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon';
/** Position in the editor (line and column) */
export interface CursorPosition {
    line: number;
    column: number;
}
/** Options for set/add/insertAt/open methods */
export interface SetOptions {
    /**
     * Attributes to collapse after loading.
     * - string[]: List of attribute names (e.g., ['coordinates', 'geometry'])
     * - function: Dynamic function (feature, index) => string[]
     * - '$root': Special keyword to collapse entire features
     * - Empty array: No auto-collapse
     * @default ['coordinates']
     */
    collapsed?: string[] | ((feature: Feature, index: number) => string[]);
}
/** Theme configuration */
export interface ThemeConfig {
    bgColor?: string;
    textColor?: string;
    caretColor?: string;
    gutterBg?: string;
    gutterBorder?: string;
    gutterText?: string;
    jsonKey?: string;
    jsonString?: string;
    jsonNumber?: string;
    jsonBoolean?: string;
    jsonNull?: string;
    jsonPunct?: string;
    jsonError?: string;
    controlColor?: string;
    controlBg?: string;
    controlBorder?: string;
    geojsonKey?: string;
    geojsonType?: string;
    geojsonTypeInvalid?: string;
    jsonKeyInvalid?: string;
}
/** Theme settings for dark and light modes */
export interface ThemeSettings {
    dark?: ThemeConfig;
    light?: ThemeConfig;
}
/** Input types accepted by API methods */
export type FeatureInput = Feature | Feature[] | FeatureCollection;
/** Color metadata for a line */
export interface ColorMeta {
    attributeName: string;
    color: string;
}
/** Boolean metadata for a line */
export interface BooleanMeta {
    attributeName: string;
    value: boolean;
}
/** Collapse button metadata */
export interface CollapseButtonMeta {
    nodeKey: string;
    nodeId: string;
    isCollapsed: boolean;
}
/** Visibility button metadata */
export interface VisibilityButtonMeta {
    featureKey: string;
    isHidden: boolean;
}
/** Line metadata */
export interface LineMeta {
    colors: ColorMeta[];
    booleans: BooleanMeta[];
    collapseButton: CollapseButtonMeta | null;
    visibilityButton: VisibilityButtonMeta | null;
    isHidden: boolean;
    isCollapsed: boolean;
    featureKey: string | null;
}
/** Visible line data */
export interface VisibleLine {
    index: number;
    content: string;
    meta: LineMeta | undefined;
}
/** Feature range in the editor */
export interface FeatureRange {
    startLine: number;
    endLine: number;
    featureIndex: number;
}
/** Node range info */
export interface NodeRangeInfo {
    startLine: number;
    endLine: number;
    nodeKey?: string;
    isRootFeature?: boolean;
}
/** Collapsible range info */
export interface CollapsibleRange extends NodeRangeInfo {
    nodeId: string;
    openBracket: string;
}
/** Editor state snapshot for undo/redo */
export interface EditorSnapshot {
    lines: string[];
    cursorLine: number;
    cursorColumn: number;
    timestamp: number;
}
/** Bracket count result */
export interface BracketCount {
    open: number;
    close: number;
}
/** Context stack item */
export interface ContextStackItem {
    context: string;
    isArray: boolean;
}
/** Collapsed zone context for keydown handlers */
export interface CollapsedZoneContext {
    inCollapsedZone: CollapsedNodeInfo | null;
    onCollapsedNode: CollapsedNodeInfo | null;
    onClosingLine: CollapsedNodeInfo | null;
}
/** Collapsed node info with nodeId */
export interface CollapsedNodeInfo extends NodeRangeInfo {
    nodeId: string;
    isCollapsed?: boolean;
}
