import type { Feature } from 'geojson';
import type { BracketCount } from './types.js';
/**
 * Alias for document.createElement - optimized for minification
 */
export declare const createElement: (tag: string) => HTMLElement;
/**
 * Generate a unique feature key from a feature object
 * Uses id, properties.id, or a hash of geometry coordinates
 */
export declare function getFeatureKey(feature: Feature | null): string | null;
/**
 * Count open and close brackets in a line
 * Handles string escaping properly
 */
export declare function countBrackets(line: string, openBracket: string): BracketCount;
/**
 * Parse a CSS selector to a :host rule for shadow DOM
 */
export declare function parseSelectorToHostRule(selector: string | null): string;
/**
 * Escape HTML special characters
 */
export declare function escapeHtml(text: string): string;
/**
 * Convert camelCase to kebab-case
 */
export declare function toKebabCase(str: string): string;
