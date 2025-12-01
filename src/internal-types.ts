import type { Feature, FeatureCollection } from 'geojson';

/**
 * Internal types - not exported publicly
 */

/** Position in the editor (line and column) */
export interface CursorPosition {
  line: number;
  column: number;
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
  hasError: boolean;
}

/** Error info for navigation */
export interface ErrorInfo {
  line: number;
  type: 'syntax' | 'structural';
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
