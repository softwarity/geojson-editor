import type { GeometryType } from './types.js';

// Version injected by Vite build from package.json
declare const __VERSION__: string;
export const VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'dev';

// GeoJSON constants
export const GEOJSON_KEYS: string[] = ['type', 'geometry', 'properties', 'coordinates', 'id', 'features'];
export const GEOMETRY_TYPES: GeometryType[] = ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'];

// Compressed CSS color names with hex values (name + hex pairs, no separator)
export const RAW_COLORS = "alicebluef0f8ffantiquewhitefaebd7aqua0ffaquamarine7ffd4azuref0ffffbeigef5f5dbisqueffe4c4black000blanchedalmondffebcdblue00fblueviolet8a2b2browna52aburlywooddeb887cadetblue5f9ea0chartreuse7ffchocolated2691ecoralff7f50cornflowerblue6495edcornsilkfff8dccrimsondc143ccyand0ffdarkblue00008bdarkcyan008b8bdarkgoldenrodb8860bdarkgraya9a9a9darkgreen006400darkgreya9a9a9darkkhakibdb76bdarkmagenta8b008bdarkolivegreen556b2fdarkorangeff8c00darkorchid9932ccdarkredd8b0000darksalmone9967adarkseagreena8fbc8fdarkslateblue483d8bdarkslategray2f4f4fdarkslategrey2f4f4fdarkturquoise0ced1darkviolet9400d3deeppinkff1493deepskyblue0bfffdimgray696969dimgrey696969dodgerblue1e90fffirebrickb22222floralwhitefffaf0forestgreen228b22fuchsiaf0fgainsborodcdcdcgghostwhitef8f8ffgoldffd700goldenroddaa520gray808080green0800greenyellowadff2fgrey808080honeydewf0fff0hotpinkff69b4indianredcd5c5cindigo4b0082ivoryfffff0khakif0e68clavendere6e6falavenderblushfff0f5lawngreen7cfc00lemonchiffonfffacdlightblueadd8e6lightcoralf08080lightcyane0fffflightgoldenrodyellowfafad2lightgrayd3d3d3lightgreen90ee90lightgreyd3d3d3lightpinkffb6c1lightsalmonffa07alightseagreen20b2aalightskyblue87cefalightslategray778899lightslategrey778899lightsteelblueb0c4delightyellowffffe0lime0f0limegreen32cd32linenfaf0e6magentaf0fmaroon800000mediumaquamarine66cdaamediumblue0000cdmediumorchidba55d3mediumpurple9370dbmediumseagreen3cb371mediumslateblue7b68eemediumspringgreen00fa9amediumturquoise48d1ccmediumvioletredc71585midnightblue191970mintcreamf5fffamistyroseffe4e1moccasinffe4b5navajowhiteffdeadnavy000080oldlacefdf5e6olive808000olivedrab6b8e23orangeffa500orangeredff4500orchidda70d6palegoldenrodeee8aapalegreen98fb98paleturquoiseafeeeepalevioletreddb7093papayawhipffefd5peachpuffffdab9perucd853fpinkffc0cbplumdda0ddpowderblueb0e0e6purple800080rebeccapurple663399redff0000rosybrownbc8f8froyalblue4169esaddlebrown8b4513salmonfa8072sandybrownf4a460seagreen2e8b57seashellfff5eesiennaa0522dsilverc0c0c0skyblue87ceebslateblue6a5acdslategray708090slategrey708090snowsfffafaspringgreen0ff7fsteelblue4682b4tantan0d2b48ctealth008080thistled8bfd8tomatoff6347turquoise40e0d0violetee82eewheatf5deb3whiteffffffwhitesmokef5f5f5yellowffff0yellowgreen9acd32";

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

// Attribute extraction
export const RE_ATTR_BOOLEANS = /"([\w-]+)"\s*:\s*(true|false)/g;
export const RE_ATTR_COLORS = /"([\w-]+)"\s*:\s*"(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}))"/g;
export const RE_ATTR_AND_HEX_COLOR = /"([\w-]+)"\s*:\s*"#/;
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
