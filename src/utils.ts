import type { BracketCount } from './internal-types.js';

/**
 * Alias for document.createElement - optimized for minification
 */
export const createElement = (tag: string): HTMLElement => document.createElement(tag);

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
