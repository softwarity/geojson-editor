import type { Feature } from 'geojson';

/**
 * Public types - exported from the package
 */

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
  collapsed?: string[] | ((feature: Feature | null, index: number) => string[]);
}
