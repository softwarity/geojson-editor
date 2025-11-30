import type { LineMeta } from './internal-types.js';
import {
  GEOJSON_KEYS,
  GEOMETRY_TYPES,
  RAW_COLORS,
  RE_COLLAPSED_BRACKET,
  RE_COLLAPSED_ROOT,
  RE_ESCAPE_AMP,
  RE_ESCAPE_LT,
  RE_ESCAPE_GT,
  RE_PUNCTUATION,
  RE_JSON_KEYS,
  RE_TYPE_VALUES,
  RE_STRING_VALUES,
  RE_COLOR_HEX,
  RE_NAMED_COLOR,
  RE_NUMBERS_COLON,
  RE_NUMBERS_ARRAY,
  RE_NUMBERS_START,
  RE_BOOLEANS,
  RE_NULL,
  RE_UNRECOGNIZED,
  RE_WHITESPACE_ONLY,
  RE_WHITESPACE_SPLIT
} from './constants.js';

/**
 * Convert a named CSS color to hex using RAW_COLORS lookup
 */
export function namedColorToHex(colorName: string): string | null {
  const lc = colorName.toLowerCase();
  const re = new RegExp('(?:^|[\\da-f]{6}|[\\da-f]{3})' + lc + '([\\da-f]{6}|[\\da-f]{3})', 'i');
  const match = RAW_COLORS.match(re);
  return match ? '#' + match[1] : null;
}

/**
 * Apply syntax highlighting to a line of JSON text
 * Returns HTML with syntax highlighting spans
 */
export function highlightSyntax(text: string, context: string, meta: LineMeta | undefined): string {
  if (!text) return '';

  // For collapsed nodes, truncate the text at the opening bracket
  let displayText = text;
  let collapsedBracket: string | null = null;

  if (meta?.collapseButton?.isCollapsed) {
    // Match "key": { or "key": [
    const bracketMatch = text.match(RE_COLLAPSED_BRACKET);
    // Also match standalone { or [ (root Feature objects)
    const rootMatch = !bracketMatch && text.match(RE_COLLAPSED_ROOT);

    if (bracketMatch) {
      displayText = bracketMatch[1] + bracketMatch[2];
      collapsedBracket = bracketMatch[2];
    } else if (rootMatch) {
      displayText = rootMatch[1] + rootMatch[2];
      collapsedBracket = rootMatch[2];
    }
  }

  // Escape HTML first
  let result = displayText
    .replace(RE_ESCAPE_AMP, '&amp;')
    .replace(RE_ESCAPE_LT, '&lt;')
    .replace(RE_ESCAPE_GT, '&gt;');

  // Punctuation FIRST (before other replacements can interfere)
  result = result.replace(RE_PUNCTUATION, '<span class="json-punctuation">$1</span>');

  // JSON keys - match "key" followed by :
  // In properties context, all keys are treated as regular JSON keys
  RE_JSON_KEYS.lastIndex = 0;
  result = result.replace(RE_JSON_KEYS, (match, key, colon) => {
    if (context !== 'properties' && GEOJSON_KEYS.includes(key)) {
      return `<span class="geojson-key">"${key}"</span>${colon}`;
    }
    return `<span class="json-key">"${key}"</span>${colon}`;
  });

  // Type values - "type": "Value" - but NOT inside properties context
  if (context !== 'properties') {
    RE_TYPE_VALUES.lastIndex = 0;
    result = result.replace(RE_TYPE_VALUES, (match, space, type) => {
      const isValid = type === 'Feature' || type === 'FeatureCollection' || GEOMETRY_TYPES.includes(type);
      const cls = isValid ? 'geojson-type' : 'geojson-type-invalid';
      return `<span class="geojson-key">"type"</span><span class="json-punctuation">:</span>${space}<span class="${cls}">"${type}"</span>`;
    });
  }

  // String values (not already wrapped in spans)
  RE_STRING_VALUES.lastIndex = 0;
  result = result.replace(RE_STRING_VALUES, (match, colon, space, val) => {
    if (match.includes('geojson-type') || match.includes('json-string')) return match;
    // Check for hex color (#fff or #ffffff)
    if (RE_COLOR_HEX.test(val)) {
      return `${colon}${space}<span class="json-string json-color" data-color="${val}" style="--swatch-color: ${val}">"${val}"</span>`;
    }
    // Check for named CSS color (red, blue, etc.)
    if (RE_NAMED_COLOR.test(val)) {
      const hex = namedColorToHex(val);
      if (hex) {
        return `${colon}${space}<span class="json-string json-color" data-color="${val}" style="--swatch-color: ${hex}">"${val}"</span>`;
      }
    }
    return `${colon}${space}<span class="json-string">"${val}"</span>`;
  });

  // Numbers after colon
  RE_NUMBERS_COLON.lastIndex = 0;
  result = result.replace(RE_NUMBERS_COLON, '$1$2<span class="json-number">$3</span>');

  // Numbers in arrays (after [ or ,)
  RE_NUMBERS_ARRAY.lastIndex = 0;
  result = result.replace(RE_NUMBERS_ARRAY, '$1$2<span class="json-number">$3</span>');

  // Standalone numbers at start of line (coordinates arrays)
  RE_NUMBERS_START.lastIndex = 0;
  result = result.replace(RE_NUMBERS_START, '$1<span class="json-number">$2</span>');

  // Booleans - use ::before for checkbox via CSS class
  RE_BOOLEANS.lastIndex = 0;
  result = result.replace(RE_BOOLEANS, (match, colon, space, val) => {
    const checkedClass = val === 'true' ? ' json-bool-true' : ' json-bool-false';
    return `${colon}${space}<span class="json-boolean${checkedClass}">${val}</span>`;
  });

  // Null
  RE_NULL.lastIndex = 0;
  result = result.replace(RE_NULL, '$1$2<span class="json-null">$3</span>');

  // Collapsed bracket indicator
  if (collapsedBracket) {
    const bracketClass = collapsedBracket === '[' ? 'collapsed-bracket-array' : 'collapsed-bracket-object';
    result = result.replace(
      new RegExp(`<span class="json-punctuation">\\${collapsedBracket}<\\/span>$`),
      `<span class="${bracketClass}">${collapsedBracket}</span>`
    );
  }

  // Mark unrecognized text as error
  RE_UNRECOGNIZED.lastIndex = 0;
  result = result.replace(RE_UNRECOGNIZED, (match, before, text, after) => {
    if (!text || RE_WHITESPACE_ONLY.test(text)) return match;
    // Check for unrecognized words/tokens (not whitespace, not just spaces/commas)
    // Keep whitespace as-is, wrap any non-whitespace unrecognized token
    const parts = text.split(RE_WHITESPACE_SPLIT);
    let hasError = false;
    const processed = parts.map(part => {
      // If it's whitespace, keep it
      if (RE_WHITESPACE_ONLY.test(part)) return part;
      // Mark as error
      hasError = true;
      return `<span class="json-error">${part}</span>`;
    }).join('');
    return hasError ? before + processed + after : match;
  });

  return result;
}
