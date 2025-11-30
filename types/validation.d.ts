import type { Feature, FeatureCollection } from 'geojson';
/**
 * Validation error for GeoJSON features
 */
export interface ValidationError {
    message: string;
    featureIndex?: number;
}
/**
 * Validate a parsed FeatureCollection and return any errors
 */
export declare function validateGeoJSON(parsed: FeatureCollection): string[];
/**
 * Validate a single feature object
 * @throws Error if the feature is invalid
 */
export declare function validateFeature(feature: Feature): void;
/**
 * Normalize input to an array of features
 * Accepts: FeatureCollection, Feature[], or single Feature
 * @throws Error if input is invalid
 */
export declare function normalizeToFeatures(input: Feature | Feature[] | FeatureCollection): Feature[];
