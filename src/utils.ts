import type { Feature } from 'geojson';
import type { BracketCount } from './types.js';

/**
 * Alias for document.createElement - optimized for minification
 */
export const createElement = (tag: string): HTMLElement => document.createElement(tag);

/**
 * Generate a unique feature key from a feature object
 * Uses id, properties.id, or a hash of geometry coordinates
 */
export function getFeatureKey(feature: Feature | null): string | null {
  if (!feature) return null;
  if (feature.id !== undefined) return `id:${feature.id}`;
  if (feature.properties?.id !== undefined) return `prop:${feature.properties.id}`;

  const geomType = feature.geometry?.type || 'null';
  const geom = feature.geometry as { coordinates?: unknown } | null;
  const coords = JSON.stringify(geom?.coordinates || []);
  let hash = 0;
  for (let i = 0; i < coords.length; i++) {
    hash = ((hash << 5) - hash) + coords.charCodeAt(i);
    hash = hash & hash;
  }
  return `hash:${geomType}:${hash.toString(36)}`;
}

/**
 * Count open and close brackets in a line
 * Handles string escaping properly
 */
export function countBrackets(line: string, openBracket: string): BracketCount {
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
 * Parse a CSS selector to a :host rule for shadow DOM
 */
export function parseSelectorToHostRule(selector: string | null): string {
  if (!selector) return ':host([data-color-scheme="dark"])';
  if (selector.startsWith('.') && !selector.includes(' ')) {
    return `:host(${selector})`;
  }
  return `:host-context(${selector})`;
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Convert camelCase to kebab-case
 */
export function toKebabCase(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}
