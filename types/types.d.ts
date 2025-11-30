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
/** Theme configuration */
export interface ThemeConfig {
    bgColor?: string;
    textColor?: string;
    caretColor?: string;
    gutterBg?: string;
    gutterBorder?: string;
    gutterText?: string;
    jsonKey?: string;
    jsonString?: string;
    jsonNumber?: string;
    jsonBoolean?: string;
    jsonNull?: string;
    jsonPunct?: string;
    jsonError?: string;
    controlColor?: string;
    controlBg?: string;
    controlBorder?: string;
    geojsonKey?: string;
    geojsonType?: string;
    geojsonTypeInvalid?: string;
    jsonKeyInvalid?: string;
}
/** Theme settings for dark and light modes */
export interface ThemeSettings {
    dark?: ThemeConfig;
    light?: ThemeConfig;
}
