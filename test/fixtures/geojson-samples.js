// Valid GeoJSON samples for testing

export const validPoint = {
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: [102.0, 0.5]
  },
  properties: {
    name: 'Test Point'
  }
};

export const validLineString = {
  type: 'Feature',
  geometry: {
    type: 'LineString',
    coordinates: [
      [102.0, 0.0],
      [103.0, 1.0],
      [104.0, 0.0],
      [105.0, 1.0]
    ]
  },
  properties: {
    name: 'Test Line'
  }
};

export const validPolygon = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [100.0, 0.0],
      [101.0, 0.0],
      [101.0, 1.0],
      [100.0, 1.0],
      [100.0, 0.0]
    ]]
  },
  properties: {
    name: 'Test Polygon',
    color: '#ff5733'
  }
};

export const validFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    validPoint,
    validLineString
  ]
};

export const featureWithAllProperties = {
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: [0, 0]
  },
  properties: {
    string: 'hello',
    number: 42,
    float: 3.14,
    boolean: true,
    nullValue: null,
    color: '#00ff00'
  }
};

// Invalid GeoJSON samples for testing error handling

export const invalidType = {
  type: 'InvalidType',
  geometry: null,
  properties: {}
};

export const invalidGeometryType = {
  type: 'Feature',
  geometry: {
    type: 'LinearRing', // Invalid - LinearRing is not a valid GeoJSON type
    coordinates: [[0, 0], [1, 1], [0, 0]]
  },
  properties: {}
};

export const missingType = {
  geometry: {
    type: 'Point',
    coordinates: [0, 0]
  },
  properties: {}
};

// JSON strings for direct input
export const validPointStr = JSON.stringify(validPoint, null, 2);
export const validPolygonStr = JSON.stringify(validPolygon, null, 2);
export const validFeatureCollectionStr = JSON.stringify(validFeatureCollection, null, 2);
export const invalidTypeStr = JSON.stringify(invalidType, null, 2);
export const invalidJson = '{invalid json syntax}';
export const emptyObject = '{}';

// Feature for FeatureCollection mode (without wrapper)
export const featureForArrayMode = JSON.stringify(validPoint, null, 2);

// Complex nested structure for collapse testing
export const complexFeature = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [100.0, 0.0],
      [101.0, 0.0],
      [101.0, 1.0],
      [100.0, 1.0],
      [100.0, 0.0]
    ]]
  },
  properties: {
    nested: {
      deep: {
        value: 'test'
      }
    },
    array: [1, 2, 3]
  }
};

export const complexFeatureStr = JSON.stringify(complexFeature, null, 2);
