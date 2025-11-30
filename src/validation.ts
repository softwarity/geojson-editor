import type { Feature, FeatureCollection } from 'geojson';
import { GEOMETRY_TYPES, type GeometryType } from './constants.js';

/**
 * Validate a parsed FeatureCollection and return any errors
 */
export function validateGeoJSON(parsed: FeatureCollection): string[] {
  const errors: string[] = [];

  if (!parsed.features) return errors;

  parsed.features.forEach((feature, i) => {
    if (feature.type !== 'Feature') {
      errors.push(`features[${i}]: type must be "Feature"`);
    }
    if (feature.geometry && feature.geometry.type) {
      if (!GEOMETRY_TYPES.includes(feature.geometry.type as GeometryType)) {
        errors.push(`features[${i}].geometry: invalid type "${feature.geometry.type}"`);
      }
    }
  });

  return errors;
}

/**
 * Validate a single feature object
 * @throws Error if the feature is invalid
 */
export function validateFeature(feature: Feature): void {
  if (!feature || typeof feature !== 'object') {
    throw new Error('Feature must be an object');
  }
  if (feature.type !== 'Feature') {
    throw new Error('Feature type must be "Feature"');
  }
  if (!('geometry' in feature)) {
    throw new Error('Feature must have a geometry property');
  }
  if (!('properties' in feature)) {
    throw new Error('Feature must have a properties property');
  }
  if (feature.geometry !== null) {
    if (typeof feature.geometry !== 'object') {
      throw new Error('Feature geometry must be an object or null');
    }
    if (!feature.geometry.type) {
      throw new Error('Feature geometry must have a type');
    }
    if (!GEOMETRY_TYPES.includes(feature.geometry.type as GeometryType)) {
      throw new Error(`Invalid geometry type: "${feature.geometry.type}"`);
    }
    if (!('coordinates' in feature.geometry)) {
      throw new Error('Feature geometry must have coordinates');
    }
  }
  if (feature.properties !== null && typeof feature.properties !== 'object') {
    throw new Error('Feature properties must be an object or null');
  }
}

/**
 * Normalize input to an array of features
 * Accepts: FeatureCollection, Feature[], or single Feature
 * @throws Error if input is invalid
 */
export function normalizeToFeatures(input: Feature | Feature[] | FeatureCollection): Feature[] {
  let features: Feature[] = [];

  if (Array.isArray(input)) {
    features = input;
  } else if (input && typeof input === 'object') {
    if (input.type === 'FeatureCollection' && 'features' in input && Array.isArray(input.features)) {
      features = input.features;
    } else if (input.type === 'Feature') {
      features = [input as Feature];
    } else {
      throw new Error('Input must be a Feature, array of Features, or FeatureCollection');
    }
  } else {
    throw new Error('Input must be a Feature, array of Features, or FeatureCollection');
  }

  // Validate each feature
  for (const feature of features) {
    validateFeature(feature);
  }

  return features;
}
