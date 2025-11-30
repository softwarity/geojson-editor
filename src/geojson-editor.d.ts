import type { Feature, FeatureCollection } from 'geojson';
import type { SetOptions, ThemeSettings } from './types.js';

export type { SetOptions, ThemeConfig, ThemeSettings } from './types.js';

/** Input types accepted by API methods */
export type FeatureInput = Feature | Feature[] | FeatureCollection;

/**
 * GeoJSON Editor Web Component
 * A feature-rich GeoJSON editor with syntax highlighting, collapsible nodes, and inline controls.
 */
declare class GeoJsonEditor extends HTMLElement {
  /** Current editor content as string */
  get value(): string;

  /** Placeholder text when editor is empty */
  get placeholder(): string;

  /** Prefix text displayed before editor content */
  get prefix(): string;

  /** Suffix text displayed after editor content */
  get suffix(): string;

  /** Whether the editor is in readonly mode */
  get readonly(): boolean;

  /**
   * Set the editor content from a string value
   * @param value - JSON string content
   * @param autoCollapse - Whether to auto-collapse coordinates (default: true)
   */
  setValue(value: string | null, autoCollapse?: boolean): void;

  /**
   * Get full content as string (expanded, no hidden markers)
   */
  getContent(): string;

  /**
   * Replace all features in the editor
   * @param input - FeatureCollection, Feature[], or single Feature
   * @param options - Optional settings (collapsed attributes)
   * @throws Error if input is invalid
   */
  set(input: FeatureInput, options?: SetOptions): void;

  /**
   * Add features to the end of the editor
   * @param input - FeatureCollection, Feature[], or single Feature
   * @param options - Optional settings (collapsed attributes)
   * @throws Error if input is invalid
   */
  add(input: FeatureInput, options?: SetOptions): void;

  /**
   * Insert features at a specific index
   * @param input - FeatureCollection, Feature[], or single Feature
   * @param index - Index to insert at (negative = from end)
   * @param options - Optional settings (collapsed attributes)
   * @throws Error if input is invalid
   */
  insertAt(input: FeatureInput, index: number, options?: SetOptions): void;

  /**
   * Remove feature at index
   * @param index - Index to remove (negative = from end)
   * @returns The removed feature, or undefined if index is out of bounds
   */
  removeAt(index: number): Feature | undefined;

  /**
   * Remove all features
   * @returns Array of all removed features
   */
  removeAll(): Feature[];

  /**
   * Get feature at index
   * @param index - Index to get (negative = from end)
   * @returns The feature, or undefined if index is out of bounds
   */
  get(index: number): Feature | undefined;

  /**
   * Get all features as an array
   */
  getAll(): Feature[];

  /**
   * Emit the current document on the change event
   */
  emit(): void;

  /**
   * Save GeoJSON to a file (triggers download)
   * @param filename - Filename for download (default: 'features.geojson')
   * @returns true if save was successful
   */
  save(filename?: string): boolean;

  /**
   * Open a GeoJSON file from the client filesystem
   * @param options - Optional settings (collapsed attributes)
   * @returns Promise that resolves to true if file was loaded successfully
   */
  open(options?: SetOptions): Promise<boolean>;

  /**
   * Undo last action
   * @returns true if undo was performed
   */
  undo(): boolean;

  /**
   * Redo previously undone action
   * @returns true if redo was performed
   */
  redo(): boolean;

  /**
   * Check if undo is available
   */
  canUndo(): boolean;

  /**
   * Check if redo is available
   */
  canRedo(): boolean;

  /**
   * Clear undo/redo history
   */
  clearHistory(): void;

  /**
   * Set custom theme colors
   * @param theme - Theme settings for dark and light modes
   */
  setTheme(theme: ThemeSettings): void;

  /**
   * Reset theme to defaults
   */
  resetTheme(): void;
}

export default GeoJsonEditor;
