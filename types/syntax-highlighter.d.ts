import type { LineMeta } from './types.js';
/**
 * Apply syntax highlighting to a line of JSON text
 * Returns HTML with syntax highlighting spans
 */
export declare function highlightSyntax(text: string, context: string, meta: LineMeta | undefined): string;
