import type { GeoJsonGeometryTypes } from 'geojson';

// Version injected by Vite build from package.json
declare const __VERSION__: string;
export const VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'dev';

// GeoJSON constants - exclude GeometryCollection which is not supported
export type GeometryType = Exclude<GeoJsonGeometryTypes, 'GeometryCollection'>;
export const GEOJSON_KEYS: string[] = ['type', 'geometry', 'properties', 'coordinates', 'id', 'features'];
export const GEOMETRY_TYPES: GeometryType[] = ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'];

// ========== Pre-compiled regex patterns for performance ==========

// Context detection
export const RE_CONTEXT_GEOMETRY = /"geometry"\s*:/;
export const RE_CONTEXT_PROPERTIES = /"properties"\s*:/;
export const RE_CONTEXT_FEATURES = /"features"\s*:/;

// Collapsed node detection
export const RE_COLLAPSED_BRACKET = /^(\s*"[^"]+"\s*:\s*)([{\[])/;
export const RE_COLLAPSED_ROOT = /^(\s*)([{\[]),?\s*$/;

// HTML escaping
export const RE_ESCAPE_AMP = /&/g;
export const RE_ESCAPE_LT = /</g;
export const RE_ESCAPE_GT = />/g;

// Syntax highlighting
export const RE_PUNCTUATION = /([{}[\],:])/g;
export const RE_JSON_KEYS = /"([^"]+)"(<span class="json-punctuation">:<\/span>)/g;
export const RE_TYPE_VALUES = /<span class="geojson-key">"type"<\/span><span class="json-punctuation">:<\/span>(\s*)"([^"]*)"/g;
export const RE_STRING_VALUES = /(<span class="json-punctuation">:<\/span>)(\s*)"([^"]*)"/g;
export const RE_NUMBERS_COLON = /(<span class="json-punctuation">:<\/span>)(\s*)(-?\d+\.?\d*(?:e[+-]?\d+)?)/gi;
export const RE_NUMBERS_ARRAY = /(<span class="json-punctuation">[\[,]<\/span>)(\s*)(-?\d+\.?\d*(?:e[+-]?\d+)?)/gi;
export const RE_NUMBERS_START = /^(\s*)(-?\d+\.?\d*(?:e[+-]?\d+)?)/gim;
export const RE_BOOLEANS = /(<span class="json-punctuation">:<\/span>)(\s*)(true|false)/g;
export const RE_NULL = /(<span class="json-punctuation">:<\/span>)(\s*)(null)/g;
export const RE_UNRECOGNIZED = /(<\/span>|^)([^<]+)(<span|$)/g;

// Color validation and normalization
export const RE_COLOR_HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
export const RE_NORMALIZE_COLOR = /^#?([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/;

// Whitespace
export const RE_WHITESPACE_ONLY = /^\s*$/;
export const RE_WHITESPACE_SPLIT = /(\s+)/;

// Attribute extraction - unified regex for string values and booleans
// Captures: [1] attributeName, [2] stringValue (if string), [3] boolValue (if boolean)
export const RE_ATTR_VALUE = /"([\w-]+)"\s*:\s*(?:"([^"]*)"|(\btrue\b|\bfalse\b))/g;
// Non-global version for single match with capture groups
export const RE_ATTR_VALUE_SINGLE = /"([\w-]+)"\s*:\s*(?:"([^"]*)"|(\btrue\b|\bfalse\b))/;
// Boolean attribute matching (non-global for single match)
export const RE_ATTR_AND_BOOL_VALUE = /"([\w-]+)"\s*:\s*(true|false)/;

// Feature detection
export const RE_IS_FEATURE = /"type"\s*:\s*"Feature"/;

// Collapsible node matching
export const RE_KV_MATCH = /^\s*"([^"]+)"\s*:\s*([{\[])/;
export const RE_ROOT_MATCH = /^\s*([{\[]),?\s*$/;
export const RE_BRACKET_POS = /[{\[]/;

// Word navigation
export const RE_IS_WORD_CHAR = /[\w-]/;

// Theme CSS generation
export const RE_TO_KEBAB = /([A-Z])/g;

// Bracket counting
export const RE_OPEN_BRACES = /\{/g;
export const RE_CLOSE_BRACES = /\}/g;
export const RE_OPEN_BRACKETS = /\[/g;
export const RE_CLOSE_BRACKET = /\]/g;
