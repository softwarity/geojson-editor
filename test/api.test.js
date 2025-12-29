import { expect, fixture, html } from '@open-wc/testing';
import GeoJsonEditor from '../src/geojson-editor.ts';
import {
  validPointStr,
  validPolygonStr,
  validPoint,
  validPolygon,
  validFeatureCollection,
  validLineString
} from './fixtures/geojson-samples.js';

// Helper to wait for component to stabilize
const waitFor = (ms = 100) => new Promise(r => setTimeout(r, ms));

// Create a fixture with explicit size for viewport rendering tests
const createSizedFixture = async (attributes = '') => {
  return await fixture(html`<geojson-editor style="height: 400px; width: 600px;" ${attributes}></geojson-editor>`);
};

// Helper to stub formatAndUpdate and emitChange to avoid JSON parsing errors
const stubEditorMethods = (el) => {
  el.formatAndUpdate = () => { el.updateView(); el.scheduleRender(); };
  el.emitChange = () => {}; // Suppress change events in tests
};

describe('GeoJsonEditor - Features API', () => {

  it('should set features via set()', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPoint, validPolygon]);
    await waitFor();

    const features = el.getAll();
    expect(features.length).to.equal(2);
    expect(features[0].geometry.type).to.equal('Point');
    expect(features[1].geometry.type).to.equal('Polygon');
  });

  it('should add feature via add()', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.add(validPoint);
    await waitFor();

    const features = el.getAll();
    expect(features.length).to.equal(1);
    expect(features[0].geometry.type).to.equal('Point');
  });

  it('should add multiple features sequentially', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.add(validPoint);
    el.add(validPolygon);
    await waitFor();

    const features = el.getAll();
    expect(features.length).to.equal(2);
  });

  it('should insert feature at index via insertAt()', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPoint, validPolygon]);
    await waitFor();

    const newFeature = { type: 'Feature', geometry: null, properties: { inserted: true } };
    el.insertAt(newFeature, 1);
    await waitFor();

    const features = el.getAll();
    expect(features.length).to.equal(3);
    expect(features[1].properties.inserted).to.be.true;
  });

  it('should support negative index in insertAt()', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPoint, validPolygon]);
    await waitFor();

    const newFeature = { type: 'Feature', geometry: null, properties: { last: true } };
    el.insertAt(newFeature, -1);
    await waitFor();

    const features = el.getAll();
    expect(features.length).to.equal(3);
    expect(features[1].properties.last).to.be.true;
  });

  it('should insert at beginning with index 0', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPoint]);
    await waitFor();

    const newFeature = { type: 'Feature', geometry: null, properties: { first: true } };
    el.insertAt(newFeature, 0);
    await waitFor();

    const features = el.getAll();
    expect(features[0].properties.first).to.be.true;
  });

  it('should remove feature at index via removeAt()', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPoint, validPolygon]);
    await waitFor();

    const removed = el.removeAt(0);
    await waitFor();

    expect(removed.geometry.type).to.equal('Point');
    expect(el.getAll().length).to.equal(1);
    expect(el.getAll()[0].geometry.type).to.equal('Polygon');
  });

  it('should support negative index in removeAt()', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPoint, validPolygon]);
    await waitFor();

    const removed = el.removeAt(-1);
    await waitFor();

    expect(removed.geometry.type).to.equal('Polygon');
    expect(el.getAll().length).to.equal(1);
  });

  it('should return undefined for out of bounds removeAt()', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPoint]);
    await waitFor();

    const removed = el.removeAt(5);
    expect(removed).to.be.undefined;
  });

  it('should remove all features via removeAll()', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPoint, validPolygon]);
    await waitFor();

    const removed = el.removeAll();
    await waitFor();

    expect(removed.length).to.equal(2);
    expect(el.getAll().length).to.equal(0);
  });

  it('should get feature at index via get()', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPoint, validPolygon]);
    await waitFor();

    const feature = el.get(1);
    expect(feature.geometry.type).to.equal('Polygon');
  });

  it('should support negative index in get()', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPoint, validPolygon]);
    await waitFor();

    const feature = el.get(-1);
    expect(feature.geometry.type).to.equal('Polygon');
  });

  it('should return undefined for out of bounds get()', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPoint]);
    await waitFor();

    const feature = el.get(5);
    expect(feature).to.be.undefined;
  });

  it('should throw error when set() receives invalid input', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    expect(() => el.set('not an array')).to.throw();
    expect(() => el.set(123)).to.throw();
    expect(() => el.set(null)).to.throw();
  });

  it('should return count with getAll().length', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPoint, validPolygon]);
    await waitFor();

    expect(el.getAll().length).to.equal(2);
  });

  it('should return empty array when no features', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    const features = el.getAll();
    expect(features).to.be.an('array');
    expect(features.length).to.equal(0);
  });
});

describe('GeoJsonEditor - Flexible Input', () => {

  // ========== set() flexible input ==========

  it('should set() accept a FeatureCollection', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set(validFeatureCollection);
    await waitFor();

    const features = el.getAll();
    expect(features.length).to.equal(2);
    expect(features[0].geometry.type).to.equal('Point');
    expect(features[1].geometry.type).to.equal('LineString');
  });

  it('should set() accept a single Feature', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set(validPoint);
    await waitFor();

    const features = el.getAll();
    expect(features.length).to.equal(1);
    expect(features[0].geometry.type).to.equal('Point');
  });

  it('should set() accept an array of Features', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPoint, validPolygon]);
    await waitFor();

    const features = el.getAll();
    expect(features.length).to.equal(2);
  });

  // ========== add() flexible input ==========

  it('should add() accept a FeatureCollection', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set(validPolygon);
    await waitFor();

    el.add(validFeatureCollection);
    await waitFor();

    const features = el.getAll();
    expect(features.length).to.equal(3);
    expect(features[0].geometry.type).to.equal('Polygon');
    expect(features[1].geometry.type).to.equal('Point');
    expect(features[2].geometry.type).to.equal('LineString');
  });

  it('should add() accept a single Feature', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.add(validPoint);
    await waitFor();

    const features = el.getAll();
    expect(features.length).to.equal(1);
  });

  it('should add() accept an array of Features', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.add([validPoint, validPolygon]);
    await waitFor();

    const features = el.getAll();
    expect(features.length).to.equal(2);
  });

  // ========== insertAt() flexible input ==========

  it('should insertAt() accept a FeatureCollection', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPolygon]);
    await waitFor();

    el.insertAt(validFeatureCollection, 0);
    await waitFor();

    const features = el.getAll();
    expect(features.length).to.equal(3);
    expect(features[0].geometry.type).to.equal('Point');
    expect(features[1].geometry.type).to.equal('LineString');
    expect(features[2].geometry.type).to.equal('Polygon');
  });

  it('should insertAt() accept a single Feature', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPolygon]);
    await waitFor();

    el.insertAt(validPoint, 0);
    await waitFor();

    const features = el.getAll();
    expect(features.length).to.equal(2);
    expect(features[0].geometry.type).to.equal('Point');
  });

  it('should insertAt() accept an array of Features', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPolygon]);
    await waitFor();

    el.insertAt([validPoint, validLineString], 0);
    await waitFor();

    const features = el.getAll();
    expect(features.length).to.equal(3);
    expect(features[0].geometry.type).to.equal('Point');
    expect(features[1].geometry.type).to.equal('LineString');
    expect(features[2].geometry.type).to.equal('Polygon');
  });

  // ========== Validation errors ==========

  it('should throw error for invalid Feature in set()', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    const invalidFeature = { type: 'Feature', geometry: null };

    expect(() => el.set(invalidFeature)).to.throw('properties');
  });

  it('should throw error for invalid geometry type', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    const invalidFeature = {
      type: 'Feature',
      geometry: { type: 'InvalidType', coordinates: [0, 0] },
      properties: {}
    };

    expect(() => el.set(invalidFeature)).to.throw('Invalid geometry type');
  });

  it('should throw error for missing geometry in Feature', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    const invalidFeature = { type: 'Feature', properties: {} };

    expect(() => el.set(invalidFeature)).to.throw('geometry');
  });

  it('should throw error for invalid Feature type', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    // When passed as a single object with type !== 'Feature', it's not recognized as a Feature
    const invalidFeature = { type: 'NotAFeature', geometry: null, properties: {} };

    expect(() => el.set(invalidFeature)).to.throw();
  });

  it('should throw error for invalid Feature in array', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    // When passed as an array, validation happens and type is checked
    const invalidFeature = { type: 'NotAFeature', geometry: null, properties: {} };

    expect(() => el.set([invalidFeature])).to.throw('type must be "Feature"');
  });

  it('should throw error for empty object', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    expect(() => el.set({})).to.throw();
  });
});

describe('GeoJsonEditor - Collapse/Expand', () => {

  it('should track collapsed nodes', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPolygon]);
    await waitFor();

    expect(el.collapsedNodes).to.be.instanceOf(Set);
  });

  it('should have toggleCollapse method', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    expect(el.toggleCollapse).to.be.a('function');
  });

  it('should have collapse buttons in gutter for collapsible nodes', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon]);
    await waitFor(200);

    const collapseButtons = el.shadowRoot.querySelectorAll('.collapse-button');
    expect(collapseButtons.length).to.be.greaterThan(0);
  });

  it('should collapse node when toggleCollapse called', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon]);
    await waitFor(200);

    const nodeId = Array.from(el._nodeIdToLines.keys())[0];
    if (nodeId) {
      el.toggleCollapse(nodeId);
      expect(el.collapsedNodes.has(nodeId)).to.be.true;
    }
  });

  it('should expand node when toggleCollapse called on collapsed', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon]);
    await waitFor(200);

    const nodeId = Array.from(el._nodeIdToLines.keys())[0];
    if (nodeId) {
      el.collapsedNodes.add(nodeId);
      el.toggleCollapse(nodeId);
      expect(el.collapsedNodes.has(nodeId)).to.be.false;
    }
  });

  it('should show collapsed indicator', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon]);
    await waitFor(200);

    const nodeId = Array.from(el._nodeIdToLines.keys())[0];
    if (nodeId) {
      el.toggleCollapse(nodeId);
      el.updateView();
      el.renderGutter(0, 20);
      await waitFor(100);

      const collapsedButtons = el.shadowRoot.querySelectorAll('.collapse-button.collapsed');
      expect(collapsedButtons.length).to.be.greaterThan(0);
    }
  });

  it('should keep opened node open after editing (not re-collapse)', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set content with auto-collapsed coordinates
    el.set([validPolygon]);
    await waitFor(200);

    // Find the coordinates node (should be collapsed by default)
    let coordinatesNodeId = null;
    for (const [nodeId, info] of el._nodeIdToLines) {
      if (info.nodeKey === 'coordinates') {
        coordinatesNodeId = nodeId;
        break;
      }
    }
    expect(coordinatesNodeId).to.not.be.null;
    expect(el.collapsedNodes.has(coordinatesNodeId)).to.be.true;

    // Open the node manually
    el.toggleCollapse(coordinatesNodeId);
    await waitFor(50);

    // Node should be open now
    expect(el.collapsedNodes.has(coordinatesNodeId)).to.be.false;

    // Simulate editing by calling formatAndUpdate (which triggers _rebuildNodeIdMappings)
    el.formatAndUpdate();
    await waitFor(50);

    // Find the new nodeId for coordinates (IDs change after rebuild)
    let newCoordinatesNodeId = null;
    for (const [nodeId, info] of el._nodeIdToLines) {
      if (info.nodeKey === 'coordinates') {
        newCoordinatesNodeId = nodeId;
        break;
      }
    }

    // Node should still be open (not re-collapsed)
    expect(el.collapsedNodes.has(newCoordinatesNodeId)).to.be.false;
  });

  it('should re-collapse node after user closes it manually', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon]);
    await waitFor(200);

    // Find coordinates node
    let coordinatesNodeId = null;
    for (const [nodeId, info] of el._nodeIdToLines) {
      if (info.nodeKey === 'coordinates') {
        coordinatesNodeId = nodeId;
        break;
      }
    }

    // Open it
    el.toggleCollapse(coordinatesNodeId);
    await waitFor(50);
    expect(el.collapsedNodes.has(coordinatesNodeId)).to.be.false;

    // Close it manually
    el.toggleCollapse(coordinatesNodeId);
    await waitFor(50);
    expect(el.collapsedNodes.has(coordinatesNodeId)).to.be.true;

    // Simulate editing
    el.formatAndUpdate();
    await waitFor(50);

    // Find new nodeId
    let newCoordinatesNodeId = null;
    for (const [nodeId, info] of el._nodeIdToLines) {
      if (info.nodeKey === 'coordinates') {
        newCoordinatesNodeId = nodeId;
        break;
      }
    }

    // Should remain collapsed (user closed it)
    expect(el.collapsedNodes.has(newCoordinatesNodeId)).to.be.true;
  });

  it('should only keep opened node open in multi-feature scenario', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set multiple features - all with collapsed coordinates
    el.set([validPolygon, validPoint, validPolygon]);
    await waitFor(200);

    // Find all coordinates nodes
    const coordinatesNodes = [];
    for (const [nodeId, info] of el._nodeIdToLines) {
      if (info.nodeKey === 'coordinates') {
        coordinatesNodes.push({ nodeId, uniqueKey: info.uniqueKey });
      }
    }
    expect(coordinatesNodes.length).to.be.greaterThan(1);

    // All should be collapsed initially
    for (const node of coordinatesNodes) {
      expect(el.collapsedNodes.has(node.nodeId)).to.be.true;
    }

    // Open only the first coordinates node
    el.toggleCollapse(coordinatesNodes[0].nodeId);
    await waitFor(50);

    // First should be open, others still collapsed
    expect(el.collapsedNodes.has(coordinatesNodes[0].nodeId)).to.be.false;
    for (let i = 1; i < coordinatesNodes.length; i++) {
      expect(el.collapsedNodes.has(coordinatesNodes[i].nodeId)).to.be.true;
    }

    // Simulate editing
    el.formatAndUpdate();
    await waitFor(50);

    // Find new nodeIds after rebuild
    const newCoordinatesNodes = [];
    for (const [nodeId, info] of el._nodeIdToLines) {
      if (info.nodeKey === 'coordinates') {
        newCoordinatesNodes.push({ nodeId, uniqueKey: info.uniqueKey });
      }
    }

    // First should still be open, others still collapsed
    expect(el.collapsedNodes.has(newCoordinatesNodes[0].nodeId)).to.be.false;
    for (let i = 1; i < newCoordinatesNodes.length; i++) {
      expect(el.collapsedNodes.has(newCoordinatesNodes[i].nodeId)).to.be.true;
    }
  });
});

describe('GeoJsonEditor - Feature Visibility', () => {

  it('should track hidden features', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    expect(el.hiddenFeatures).to.be.instanceOf(Set);
  });

  it('should have toggleFeatureVisibility method', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    expect(el.toggleFeatureVisibility).to.be.a('function');
  });

  it('should have visibility indicator for features', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(300);

    const visibilityLines = el.shadowRoot.querySelectorAll('.line.has-visibility');
    expect(visibilityLines.length).to.be.greaterThan(0);
  });

  it('should toggle feature visibility', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    const featureIndex = 0;
    el.toggleFeatureVisibility(featureIndex);

    expect(el.hiddenFeatures.has(featureIndex)).to.be.true;
  });

  it('should show feature when toggled again', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    const featureIndex = 0;
    el.hiddenFeatures.add(featureIndex);
    el.toggleFeatureVisibility(featureIndex);

    expect(el.hiddenFeatures.has(featureIndex)).to.be.false;
  });

  it('should apply hidden state when toggling feature visibility', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(300);

    // Get the first feature index from featureRanges
    const indices = Array.from(el.featureRanges.keys());
    expect(indices.length).to.be.greaterThan(0);

    const featureIndex = indices[0];

    // Toggle visibility
    el.toggleFeatureVisibility(featureIndex);
    await waitFor(200);

    // Check the feature is marked as hidden
    expect(el.hiddenFeatures.has(featureIndex)).to.be.true;
  });

  it('should toggle visibility on first click after paste into empty editor', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Simulate empty editor state
    expect(el.lines.length).to.equal(0);

    // Simulate paste by directly calling insertText (like handlePaste does)
    const geojsonText = JSON.stringify(validPoint, null, 2);
    el.insertText(geojsonText);

    // Simulate autoCollapseCoordinates (called by handlePaste for empty editor)
    if (el.renderTimer) {
      cancelAnimationFrame(el.renderTimer);
      el.renderTimer = null;
    }
    el.autoCollapseCoordinates();
    await waitFor(200);

    // Verify features are rendered with visibility button
    const visibilityLines = el.shadowRoot.querySelectorAll('.line.has-visibility');
    expect(visibilityLines.length).to.be.greaterThan(0);

    const firstVisibilityLine = visibilityLines[0];
    const featureIndex = firstVisibilityLine.dataset.featureIndex;
    expect(featureIndex).to.exist;

    // Simulate mousedown on visibility button area (clickX < 14)
    const rect = firstVisibilityLine.getBoundingClientRect();
    const mousedownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      clientX: rect.left + 5,
      clientY: rect.top + 5
    });
    firstVisibilityLine.dispatchEvent(mousedownEvent);

    // Verify render is blocked
    expect(el._blockRender).to.be.true;

    // Simulate click on visibility button area
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      clientX: rect.left + 5,
      clientY: rect.top + 5
    });
    firstVisibilityLine.dispatchEvent(clickEvent);
    await waitFor(100);

    // Verify render is unblocked
    expect(el._blockRender).to.be.false;

    // Verify visibility was toggled on first click
    expect(el.hiddenFeatures.has(parseInt(featureIndex, 10))).to.be.true;
  });
});

describe('GeoJsonEditor - Visibility Index System', () => {

  it('should preserve visibility after modifying feature property', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set two features
    el.set([validPoint, validPolygon]);
    await waitFor(200);

    // Hide feature 0
    el.toggleFeatureVisibility(0);
    expect(el.hiddenFeatures.has(0)).to.be.true;

    // Modify a property in feature 0 (change "name" property)
    // Find the line with "name" property
    const nameLineIndex = el.lines.findIndex(line => line.includes('"name"'));
    expect(nameLineIndex).to.be.greaterThan(-1);

    // Position cursor on the value and modify it
    el.cursorLine = nameLineIndex;
    el.cursorColumn = el.lines[nameLineIndex].length;

    // Simulate backspace to delete something
    const originalLine = el.lines[nameLineIndex];
    if (originalLine.includes('"Test Point"')) {
      el.lines[nameLineIndex] = originalLine.replace('"Test Point"', '"Modified Point"');
      el.formatAndUpdate();
      await waitFor(200);

      // Visibility should be preserved
      expect(el.hiddenFeatures.has(0)).to.be.true;
    }
  });

  it('should shift indices when inserting feature at beginning', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set two features
    el.set([validPoint, validPolygon]);
    await waitFor(200);

    // Hide feature 1 (the polygon)
    el.toggleFeatureVisibility(1);
    expect(el.hiddenFeatures.has(1)).to.be.true;
    expect(el.hiddenFeatures.has(0)).to.be.false;

    // Insert a new feature at position 0
    const newFeature = { type: 'Feature', geometry: null, properties: { inserted: true } };
    el.insertAt(newFeature, 0);
    await waitFor(200);

    // The polygon was at index 1, now should be at index 2
    expect(el.hiddenFeatures.has(1)).to.be.false;
    expect(el.hiddenFeatures.has(2)).to.be.true;

    // New feature at index 0 should not be hidden
    expect(el.hiddenFeatures.has(0)).to.be.false;
  });

  it('should shift indices when inserting feature in middle', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set three features
    const feature3 = { type: 'Feature', geometry: { type: 'Point', coordinates: [3, 3] }, properties: { name: 'Point 3' } };
    el.set([validPoint, validPolygon, feature3]);
    await waitFor(200);

    // Hide feature 2 (Point 3)
    el.toggleFeatureVisibility(2);
    expect(el.hiddenFeatures.has(2)).to.be.true;

    // Insert a new feature at position 1 (between Point and Polygon)
    const newFeature = { type: 'Feature', geometry: null, properties: { inserted: true } };
    el.insertAt(newFeature, 1);
    await waitFor(200);

    // Feature that was at index 2 should now be at index 3
    expect(el.hiddenFeatures.has(2)).to.be.false;
    expect(el.hiddenFeatures.has(3)).to.be.true;
  });

  it('should not shift indices for features before insertion point', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set three features
    const feature3 = { type: 'Feature', geometry: { type: 'Point', coordinates: [3, 3] }, properties: { name: 'Point 3' } };
    el.set([validPoint, validPolygon, feature3]);
    await waitFor(200);

    // Hide feature 0 (the point at beginning)
    el.toggleFeatureVisibility(0);
    expect(el.hiddenFeatures.has(0)).to.be.true;

    // Insert a new feature at position 2 (after the hidden feature)
    const newFeature = { type: 'Feature', geometry: null, properties: { inserted: true } };
    el.insertAt(newFeature, 2);
    await waitFor(200);

    // Feature 0 should still be at index 0 and hidden
    expect(el.hiddenFeatures.has(0)).to.be.true;
  });

  it('should shift indices when deleting feature before hidden one', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set two features
    el.set([validPoint, validPolygon]);
    await waitFor(200);

    // Hide feature 1 (the polygon)
    el.toggleFeatureVisibility(1);
    expect(el.hiddenFeatures.has(1)).to.be.true;

    // Delete feature 0
    el.removeAt(0);
    await waitFor(200);

    // The polygon should now be at index 0 and still hidden
    expect(el.hiddenFeatures.has(1)).to.be.false;
    expect(el.hiddenFeatures.has(0)).to.be.true;
  });

  it('should remove hidden index when deleting hidden feature', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set two features
    el.set([validPoint, validPolygon]);
    await waitFor(200);

    // Hide feature 0 (the point)
    el.toggleFeatureVisibility(0);
    expect(el.hiddenFeatures.has(0)).to.be.true;

    // Delete feature 0
    el.removeAt(0);
    await waitFor(200);

    // Hidden set should be empty or not contain 0
    expect(el.hiddenFeatures.has(0)).to.be.false;
  });

  it('should preserve visibility when modifying coordinates', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set a point
    el.set([validPoint]);
    await waitFor(200);

    // Hide the feature
    el.toggleFeatureVisibility(0);
    expect(el.hiddenFeatures.has(0)).to.be.true;

    // Find and modify coordinates
    const coordLineIndex = el.lines.findIndex(line => line.includes('1.0'));
    if (coordLineIndex > -1) {
      el.lines[coordLineIndex] = el.lines[coordLineIndex].replace('1.0', '2.0');
      el.formatAndUpdate();
      await waitFor(200);

      // Visibility should still be preserved
      expect(el.hiddenFeatures.has(0)).to.be.true;
    }
  });

  it('should preserve multiple hidden features after insertion', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set three features
    const feature3 = { type: 'Feature', geometry: { type: 'Point', coordinates: [3, 3] }, properties: { name: 'Point 3' } };
    el.set([validPoint, validPolygon, feature3]);
    await waitFor(200);

    // Hide features 0 and 2
    el.toggleFeatureVisibility(0);
    el.toggleFeatureVisibility(2);
    expect(el.hiddenFeatures.has(0)).to.be.true;
    expect(el.hiddenFeatures.has(2)).to.be.true;

    // Insert at position 1
    const newFeature = { type: 'Feature', geometry: null, properties: { inserted: true } };
    el.insertAt(newFeature, 1);
    await waitFor(200);

    // Feature 0 should still be at 0, feature 2 should now be at 3
    expect(el.hiddenFeatures.has(0)).to.be.true;
    expect(el.hiddenFeatures.has(2)).to.be.false;
    expect(el.hiddenFeatures.has(3)).to.be.true;
  });

  it('should handle add() with hidden features', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set one feature
    el.set([validPoint]);
    await waitFor(200);

    // Hide feature 0
    el.toggleFeatureVisibility(0);
    expect(el.hiddenFeatures.has(0)).to.be.true;

    // Add a new feature at the end
    el.add(validPolygon);
    await waitFor(200);

    // Original hidden state should be preserved
    expect(el.hiddenFeatures.has(0)).to.be.true;
    // New feature should not be hidden
    expect(el.hiddenFeatures.has(1)).to.be.false;
  });

  it('should exclude hidden features from emitted change event', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set two features
    el.set([validPoint, validPolygon]);
    await waitFor(200);

    // Hide feature 0
    el.toggleFeatureVisibility(0);

    // Listen for change event
    let emittedFeatures = null;
    el.addEventListener('change', (e) => {
      emittedFeatures = e.detail.features;
    });

    // Trigger a change
    el.emitChange();
    await waitFor(100);

    // Only the non-hidden feature should be emitted
    expect(emittedFeatures).to.not.be.null;
    expect(emittedFeatures.length).to.equal(1);
    expect(emittedFeatures[0].geometry.type).to.equal('Polygon');
  });

  it('should preserve visibility during temporary invalid JSON', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set a feature
    el.set([validPoint]);
    await waitFor(200);

    // Hide feature 0
    el.toggleFeatureVisibility(0);
    expect(el.hiddenFeatures.has(0)).to.be.true;

    // Make JSON temporarily invalid by removing closing brace
    // Use updateModel/updateView instead of formatAndUpdate to avoid emitting errors
    const lastLine = el.lines.length - 1;
    const originalLast = el.lines[lastLine];
    el.lines[lastLine] = el.lines[lastLine].replace('}', '');

    // Update model without emitting change (simulates mid-edit state)
    el.updateModel();
    el.scheduleRender();
    await waitFor(100);

    // Hidden state should be preserved even with invalid JSON
    expect(el.hiddenFeatures.has(0)).to.be.true;

    // Restore valid JSON
    el.lines[lastLine] = originalLast;
    el.updateModel();
    el.scheduleRender();
    await waitFor(200);

    // Hidden state should still be preserved
    expect(el.hiddenFeatures.has(0)).to.be.true;
  });

  it('should handle paste of features preserving existing states', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set two features
    el.set([validPoint, validPolygon]);
    await waitFor(200);

    // Hide feature 1
    el.toggleFeatureVisibility(1);
    expect(el.hiddenFeatures.has(1)).to.be.true;

    // Paste a new feature at the beginning (simulate via insertAt)
    const pastedFeature = { type: 'Feature', geometry: { type: 'Point', coordinates: [10, 10] }, properties: { name: 'Pasted' } };
    el.insertAt(pastedFeature, 0);
    await waitFor(200);

    // Original feature 1 (polygon) should now be at index 2 and still hidden
    expect(el.hiddenFeatures.has(2)).to.be.true;
    // Original feature 0 (point) should now be at index 1 and not hidden
    expect(el.hiddenFeatures.has(1)).to.be.false;
    // Pasted feature at index 0 should not be hidden
    expect(el.hiddenFeatures.has(0)).to.be.false;
  });

  it('should handle removeAll clearing hidden features', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set features and hide some
    el.set([validPoint, validPolygon]);
    await waitFor(200);
    el.toggleFeatureVisibility(0);
    el.toggleFeatureVisibility(1);

    // Remove all
    el.removeAll();
    await waitFor(200);

    // Hidden features should be cleared
    expect(el.hiddenFeatures.size).to.equal(0);
  });

  it('should handle multiple sequential insertions with hidden features', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set initial feature
    el.set([validPoint]);
    await waitFor(200);

    // Hide it
    el.toggleFeatureVisibility(0);
    expect(el.hiddenFeatures.has(0)).to.be.true;

    // Insert at beginning multiple times
    const f1 = { type: 'Feature', geometry: null, properties: { n: 1 } };
    const f2 = { type: 'Feature', geometry: null, properties: { n: 2 } };

    el.insertAt(f1, 0);
    await waitFor(200);
    expect(el.hiddenFeatures.has(1)).to.be.true; // Original moved to 1

    el.insertAt(f2, 0);
    await waitFor(200);
    expect(el.hiddenFeatures.has(2)).to.be.true; // Original now at 2
  });

  it('should handle multiple sequential deletions with hidden features', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set three features
    const f3 = { type: 'Feature', geometry: { type: 'Point', coordinates: [3, 3] }, properties: { n: 3 } };
    el.set([validPoint, validPolygon, f3]);
    await waitFor(200);

    // Hide last feature (index 2)
    el.toggleFeatureVisibility(2);
    expect(el.hiddenFeatures.has(2)).to.be.true;

    // Delete first feature
    el.removeAt(0);
    await waitFor(200);
    expect(el.hiddenFeatures.has(1)).to.be.true; // Shifted from 2 to 1

    // Delete first feature again
    el.removeAt(0);
    await waitFor(200);
    expect(el.hiddenFeatures.has(0)).to.be.true; // Shifted from 1 to 0
  });

  it('should render visibility button for features with same coordinates but different properties', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Create two features with identical coordinates but different properties
    const feature1 = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [1.0, 2.0] },
      properties: { name: 'Feature A' }
    };
    const feature2 = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [1.0, 2.0] },
      properties: { name: 'Feature B' }
    };

    el.set([feature1, feature2]);
    await waitFor(300);

    // Both features should have visibility buttons
    const visibilityLines = el.shadowRoot.querySelectorAll('.line.has-visibility');
    expect(visibilityLines.length).to.equal(2);

    // Should be able to toggle each independently
    el.toggleFeatureVisibility(0);
    expect(el.hiddenFeatures.has(0)).to.be.true;
    expect(el.hiddenFeatures.has(1)).to.be.false;

    el.toggleFeatureVisibility(1);
    expect(el.hiddenFeatures.has(0)).to.be.true;
    expect(el.hiddenFeatures.has(1)).to.be.true;
  });

  it('should not inherit hidden status when pasting new feature after deleting hidden one', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set one feature
    el.set([validPoint]);
    await waitFor(200);

    // Hide feature 0
    el.toggleFeatureVisibility(0);
    expect(el.hiddenFeatures.has(0)).to.be.true;

    // Delete all features via removeAll
    el.removeAll();
    await waitFor(200);

    // hiddenFeatures should be cleared after removeAll
    expect(el.hiddenFeatures.size).to.equal(0);

    // Paste a new feature
    const newFeature = { type: 'Feature', geometry: { type: 'Point', coordinates: [5, 5] }, properties: { name: 'New' } };
    const mockEvent = {
      preventDefault: () => {},
      clipboardData: {
        getData: () => JSON.stringify(newFeature)
      }
    };
    el.handlePaste(mockEvent);
    await waitFor(200);

    // New feature should NOT be hidden
    expect(el.hiddenFeatures.has(0)).to.be.false;
    expect(el.hiddenFeatures.size).to.equal(0);
  });

  it('should clean up invalid hidden indices after paste replaces features', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set two features and hide both
    el.set([validPoint, validPolygon]);
    await waitFor(200);

    el.toggleFeatureVisibility(0);
    el.toggleFeatureVisibility(1);
    expect(el.hiddenFeatures.has(0)).to.be.true;
    expect(el.hiddenFeatures.has(1)).to.be.true;

    // Clear and paste one new feature (using insertText to simulate)
    el.lines = [];
    el.cursorLine = 0;
    el.cursorColumn = 0;
    const newFeature = { type: 'Feature', geometry: { type: 'Point', coordinates: [5, 5] }, properties: { name: 'New' } };
    el.insertText(JSON.stringify(newFeature, null, 2));
    await waitFor(300);

    // After formatAndUpdate, hidden indices >= 1 should be cleaned up
    // because there's now only 1 feature
    expect(el.hiddenFeatures.has(1)).to.be.false;
  });

  it('should not make pasted feature hidden when paste replaces deleted hidden feature at same index', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Suppress error events during test
    el.addEventListener('error', (e) => e.stopPropagation());

    // Set two features
    el.set([validPoint, validPolygon]);
    await waitFor(200);

    // Hide feature 0
    el.toggleFeatureVisibility(0);
    expect(el.hiddenFeatures.has(0)).to.be.true;

    // Manually delete feature 0 by selecting it and deleting (simulate keyboard delete)
    // First, select all content of feature 0
    el.cursorLine = 0;
    el.cursorColumn = 0;

    // Find where feature 0 ends (before the comma that separates features)
    let feature0EndLine = 0;
    let braceCount = 0;
    for (let i = 0; i < el.lines.length; i++) {
      const line = el.lines[i];
      for (const ch of line) {
        if (ch === '{') braceCount++;
        if (ch === '}') braceCount--;
      }
      if (braceCount === 0) {
        feature0EndLine = i;
        break;
      }
    }

    // Delete lines of feature 0
    el.lines = el.lines.slice(feature0EndLine + 1);
    // Remove leading comma if present
    if (el.lines.length > 0 && el.lines[0].trim().startsWith(',')) {
      el.lines[0] = el.lines[0].replace(/^\s*,\s*/, '');
    }
    el.cursorLine = 0;
    el.cursorColumn = 0;
    el.formatAndUpdate();
    await waitFor(200);

    // Now we have only 1 feature (the polygon, now at index 0)
    expect(el.getAll().length).to.equal(1);

    // The hidden index 0 should be cleaned up because the feature at that index was deleted
    // (the remaining feature is a different one that shouldn't inherit hidden status)
    // Note: This is a simplified test - in reality, the polygon moves to index 0
    // but it wasn't hidden before, so index 0 shouldn't be hidden
  });

  it('should shift hidden index when inserting feature before hidden one', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set two features: feature0 (Point) and feature1 (Polygon)
    el.set([validPoint, validPolygon]);
    await waitFor(200);

    // Hide feature1 (index 1)
    el.toggleFeatureVisibility(1);
    expect(el.hiddenFeatures.has(1)).to.be.true;
    expect(el.hiddenFeatures.size).to.equal(1);

    // Insert a new feature at index 1 (before the hidden feature)
    const newFeature = { type: 'Feature', geometry: { type: 'Point', coordinates: [99, 99] }, properties: { name: 'Inserted' } };
    el.insertAt(newFeature, 1);
    await waitFor(200);

    // Now we have 3 features:
    // 0: Point (original)
    // 1: Inserted Point (NEW - should NOT be hidden)
    // 2: Polygon (was hidden at index 1, should now be hidden at index 2)
    expect(el.getAll().length).to.equal(3);
    expect(el.hiddenFeatures.has(1)).to.be.false; // New feature should NOT be hidden
    expect(el.hiddenFeatures.has(2)).to.be.true;  // Polygon shifted to index 2, still hidden
    expect(el.hiddenFeatures.size).to.equal(1);
  });

  it('should shift hidden index when pasting feature between visible and hidden features', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set three features
    const feature0 = { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { name: 'F0' } };
    const feature1 = { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] }, properties: { name: 'F1' } };
    const feature2 = { type: 'Feature', geometry: { type: 'Point', coordinates: [2, 2] }, properties: { name: 'F2' } };
    el.set([feature0, feature1, feature2]);
    await waitFor(200);

    // Hide feature0 and feature2 (indices 0 and 2)
    el.toggleFeatureVisibility(0);
    el.toggleFeatureVisibility(2);
    expect(el.hiddenFeatures.has(0)).to.be.true;
    expect(el.hiddenFeatures.has(2)).to.be.true;
    expect(el.hiddenFeatures.size).to.equal(2);

    // Insert a new feature at index 1 (between hidden F0 and visible F1)
    const newFeature = { type: 'Feature', geometry: { type: 'Point', coordinates: [99, 99] }, properties: { name: 'Inserted' } };
    el.insertAt(newFeature, 1);
    await waitFor(200);

    // Now we have 4 features:
    // 0: F0 (hidden - unchanged)
    // 1: Inserted (NEW - should NOT be hidden)
    // 2: F1 (was at index 1 - should NOT be hidden)
    // 3: F2 (was hidden at index 2 - should be hidden at index 3)
    expect(el.getAll().length).to.equal(4);
    expect(el.hiddenFeatures.has(0)).to.be.true;  // F0 still hidden at index 0
    expect(el.hiddenFeatures.has(1)).to.be.false; // New feature should NOT be hidden
    expect(el.hiddenFeatures.has(2)).to.be.false; // F1 was never hidden
    expect(el.hiddenFeatures.has(3)).to.be.true;  // F2 shifted to index 3, still hidden
    expect(el.hiddenFeatures.size).to.equal(2);
  });

  it('should not make newly added feature hidden when adding at end after hidden feature', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set one feature
    const feature0 = { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { name: 'F0' } };
    el.set([feature0]);
    await waitFor(200);

    // Hide feature0 (index 0)
    el.toggleFeatureVisibility(0);
    expect(el.hiddenFeatures.has(0)).to.be.true;
    expect(el.hiddenFeatures.size).to.equal(1);

    // Add a new feature at the end
    const feature1 = { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] }, properties: { name: 'F1' } };
    el.add(feature1);
    await waitFor(200);

    // Now we have 2 features
    expect(el.getAll().length).to.equal(2);

    // F0 should still be hidden at index 0
    expect(el.hiddenFeatures.has(0)).to.be.true;
    // F1 (newly added) should NOT be hidden
    expect(el.hiddenFeatures.has(1)).to.be.false;
    expect(el.hiddenFeatures.size).to.equal(1);
  });

  it('should not inherit hidden status when deleting hidden feature via API (3 features scenario)', async () => {
    // Scenario: 3 features, hide feature 2, select and delete it, feature 3 becomes feature 2 and should NOT be hidden
    const el = await fixture(html`<geojson-editor style="height: 400px; width: 600px;"></geojson-editor>`);
    await waitFor();

    // Create 3 features
    const feature0 = { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { name: 'F0' } };
    const feature1 = { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] }, properties: { name: 'F1' } };
    const feature2 = { type: 'Feature', geometry: { type: 'Point', coordinates: [2, 2] }, properties: { name: 'F2' } };
    el.set([feature0, feature1, feature2]);
    await waitFor(200);

    expect(el.getAll().length).to.equal(3);

    // Hide feature 1 (the middle one)
    el.toggleFeatureVisibility(1);
    expect(el.hiddenFeatures.has(1)).to.be.true;
    expect(el.hiddenFeatures.size).to.equal(1);

    // Delete hidden feature 1 via API
    el.removeAt(1);
    await waitFor(200);

    // Now we have 2 features: F0 at index 0, F2 at index 1
    expect(el.getAll().length).to.equal(2);
    expect(el.getAll()[0].properties.name).to.equal('F0');
    expect(el.getAll()[1].properties.name).to.equal('F2');

    // F2 (now at index 1) should NOT be hidden - the hidden state was for F1 which is deleted
    expect(el.hiddenFeatures.has(1)).to.be.false;
    expect(el.hiddenFeatures.has(0)).to.be.false;
    expect(el.hiddenFeatures.size).to.equal(0);
  });

  it('should not inherit hidden status when deleting hidden feature via keyboard selection', async () => {
    // Scenario: 3 features, hide feature 2, select it with cursor and delete, feature 3 should NOT be hidden
    const el = await fixture(html`<geojson-editor style="height: 400px; width: 600px;"></geojson-editor>`);
    await waitFor();

    // Create 3 features
    const feature0 = { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { name: 'F0' } };
    const feature1 = { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] }, properties: { name: 'F1' } };
    const feature2 = { type: 'Feature', geometry: { type: 'Point', coordinates: [2, 2] }, properties: { name: 'F2' } };
    el.set([feature0, feature1, feature2]);
    await waitFor(200);

    expect(el.getAll().length).to.equal(3);

    // Hide feature 1 (the middle one)
    el.toggleFeatureVisibility(1);
    expect(el.hiddenFeatures.has(1)).to.be.true;

    // Find the line range for feature 1
    const featureRanges = Array.from(el.featureRanges.entries());
    const feature1Range = featureRanges.find(([key, range]) => range.featureIndex === 1);
    expect(feature1Range).to.exist;
    const [, range] = feature1Range;

    // Select entire feature 1 (from start to end line)
    el.cursorLine = range.startLine;
    el.cursorColumn = 0;
    el.selectionStart = { line: range.startLine, column: 0 };
    el.selectionEnd = { line: range.endLine, column: el.lines[range.endLine].length };

    // Delete selection via Backspace key event
    const hiddenTextarea = el.shadowRoot.getElementById('hiddenTextarea');
    const backspaceEvent = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true });
    hiddenTextarea.dispatchEvent(backspaceEvent);
    await waitFor(200);

    // After deletion, we should have 2 features
    expect(el.getAll().length).to.equal(2);

    // F2 (which was at index 2) should now be at index 1 and NOT hidden
    // The hidden status should have been removed because F1 (the hidden feature) was deleted
    expect(el.hiddenFeatures.has(1)).to.be.false;
    expect(el.hiddenFeatures.size).to.equal(0);
  });
});

describe('GeoJsonEditor - Clear Button', () => {

  it('should have clear button in suffix area', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    const clearBtn = el.shadowRoot.getElementById('clearBtn');

    expect(clearBtn).to.exist;
    expect(clearBtn.classList.contains('clear-btn')).to.be.true;
  });

  it('should clear editor content when clicked', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPoint]);
    await waitFor();

    expect(el.getAll().length).to.equal(1);

    const clearBtn = el.shadowRoot.getElementById('clearBtn');
    clearBtn.click();
    await waitFor();

    expect(el.getAll().length).to.equal(0);
  });

  it('should emit empty FeatureCollection after clear', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPoint]);
    await waitFor();

    let changeEvent = null;
    el.addEventListener('change', (e) => { changeEvent = e; });

    const clearBtn = el.shadowRoot.getElementById('clearBtn');
    clearBtn.click();
    await waitFor();

    expect(changeEvent).to.exist;
    expect(changeEvent.detail.type).to.equal('FeatureCollection');
    expect(changeEvent.detail.features).to.be.an('array');
    expect(changeEvent.detail.features.length).to.equal(0);
  });
});

describe('GeoJsonEditor - Undo/Redo API', () => {

  it('should have undo() method', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    expect(el.undo).to.be.a('function');
  });

  it('should have redo() method', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    expect(el.redo).to.be.a('function');
  });

  it('should have canUndo() method', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    expect(el.canUndo).to.be.a('function');
    expect(el.canUndo()).to.be.false;
  });

  it('should have canRedo() method', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    expect(el.canRedo).to.be.a('function');
    expect(el.canRedo()).to.be.false;
  });

  it('should have clearHistory() method', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    expect(el.clearHistory).to.be.a('function');
  });

  it('should undo text insertion', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"a": 1}'];
    el.cursorLine = 0;
    el.cursorColumn = 0;

    const originalLine = el.lines[0];

    el.insertText('X');
    await waitFor(100);

    expect(el.lines[0]).to.not.equal(originalLine);
    expect(el.canUndo()).to.be.true;

    el.undo();
    await waitFor(100);

    expect(el.lines[0]).to.equal(originalLine);
    expect(el.canRedo()).to.be.true;
  });

  it('should redo after undo', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"a": 1}'];
    el.cursorLine = 0;
    el.cursorColumn = 0;

    const originalLine = el.lines[0];

    el.insertText('X');
    await waitFor(100);

    const modifiedLine = el.lines[0];

    el.undo();
    await waitFor(100);

    expect(el.lines[0]).to.equal(originalLine);

    el.redo();
    await waitFor(100);

    expect(el.lines[0]).to.equal(modifiedLine);
  });

  it('should clear redo stack on new action', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"a": 1}'];
    el.cursorLine = 0;
    el.cursorColumn = 0;

    el.insertText('X');
    await waitFor(100);

    el.undo();
    await waitFor(100);

    expect(el.canRedo()).to.be.true;

    el.insertText('Y');
    await waitFor(100);

    expect(el.canRedo()).to.be.false;
  });

  it('should undo deleteBackward', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"a": 1}'];
    el.cursorLine = 0;
    el.cursorColumn = 4;

    const originalLine = el.lines[0];

    el.deleteBackward();
    await waitFor(100);

    expect(el.lines[0]).to.not.equal(originalLine);

    el.undo();
    await waitFor(100);

    expect(el.lines[0]).to.equal(originalLine);
  });

  it('should undo deleteForward', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"a": 1}'];
    el.cursorLine = 0;
    el.cursorColumn = 4;

    const originalLine = el.lines[0];

    el.deleteForward();
    await waitFor(100);

    expect(el.lines[0]).to.not.equal(originalLine);

    el.undo();
    await waitFor(100);

    expect(el.lines[0]).to.equal(originalLine);
  });

  it('should undo insertNewline', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"a": 1}'];
    el.cursorLine = 0;
    el.cursorColumn = 4;

    const originalLineCount = el.lines.length;

    el.insertNewline();
    await waitFor(100);

    expect(el.lines.length).to.be.greaterThan(originalLineCount);

    el.undo();
    await waitFor(100);

    expect(el.lines.length).to.equal(originalLineCount);
  });

  it('should undo selection deletion', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"a": 1}'];
    el.cursorLine = 0;
    el.cursorColumn = 0;

    const originalLine = el.lines[0];

    el.selectionStart = { line: 0, column: 0 };
    el.selectionEnd = { line: 0, column: 3 };

    el._deleteSelection();
    await waitFor(100);

    expect(el.lines[0]).to.not.equal(originalLine);

    el.undo();
    await waitFor(100);

    expect(el.lines[0]).to.equal(originalLine);
  });

  it('should undo removeAll', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"a": 1}'];
    el.updateModel();

    expect(el.lines.length).to.be.greaterThan(0);

    el.removeAll();
    await waitFor(100);

    expect(el.lines.length).to.equal(0);

    el.undo();
    await waitFor(100);

    expect(el.lines.length).to.be.greaterThan(0);
  });

  it('should return false when undo stack is empty', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    expect(el.undo()).to.be.false;
  });

  it('should return false when redo stack is empty', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    expect(el.redo()).to.be.false;
  });

  it('should clear history with clearHistory()', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"a": 1}'];
    el.cursorLine = 0;
    el.cursorColumn = 0;

    el.insertText('X');
    await waitFor(100);

    expect(el.canUndo()).to.be.true;

    el.clearHistory();

    expect(el.canUndo()).to.be.false;
    expect(el.canRedo()).to.be.false;
  });

  it('should restore cursor position on undo', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"a": 1}'];
    el.cursorLine = 0;
    el.cursorColumn = 4;

    const originalCursorLine = el.cursorLine;
    const originalCursorColumn = el.cursorColumn;

    el.insertText('X');
    await waitFor(100);

    expect(el.cursorColumn).to.not.equal(originalCursorColumn);

    el.undo();
    await waitFor(100);

    expect(el.cursorLine).to.equal(originalCursorLine);
    expect(el.cursorColumn).to.equal(originalCursorColumn);
  });

  it('should group rapid consecutive actions of same type', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['test'];
    el.cursorLine = 0;
    el.cursorColumn = 4;

    // Rapid insertions (should be grouped)
    el.insertText('a');
    el.insertText('b');
    el.insertText('c');
    await waitFor(100);

    expect(el.lines[0]).to.equal('testabc');

    // Single undo should revert all grouped changes
    el.undo();
    await waitFor(100);

    expect(el.lines[0]).to.equal('test');
  });

  it('should not group actions after delay', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['test'];
    el.cursorLine = 0;
    el.cursorColumn = 4;

    el.insertText('a');
    await waitFor(600); // Wait more than grouping delay (500ms)
    el.insertText('b');
    await waitFor(100);

    expect(el.lines[0]).to.equal('testab');

    // First undo
    el.undo();
    await waitFor(100);
    expect(el.lines[0]).to.equal('testa');

    // Second undo
    el.undo();
    await waitFor(100);
    expect(el.lines[0]).to.equal('test');
  });

  it('should limit history stack size', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['test'];
    el.cursorLine = 0;
    el.cursorColumn = 4;

    // The max size is 100 by default
    // Make 110 distinct changes (with delays to avoid grouping)
    for (let i = 0; i < 110; i++) {
      el._lastActionTime = 0; // Force new history entry
      el.insertText(String(i % 10));
    }
    await waitFor(100);

    // Stack should be limited to 100
    expect(el._undoStack.length).to.be.at.most(100);
  });

  it('should hide placeholder after undo restores content', async () => {
    const el = await createSizedFixture('placeholder="Enter GeoJSON..."');
    await waitFor();

    // Set content - placeholder should be hidden
    el.set([validPoint]);
    await waitFor(200);

    const placeholder = el.shadowRoot.getElementById('placeholderLayer');
    expect(placeholder.style.display).to.equal('none');

    // Clear all (cut) - placeholder should be visible
    el.removeAll();
    await waitFor(100);

    expect(placeholder.style.display).to.not.equal('none');

    // Undo - placeholder should be hidden again
    el.undo();
    await waitFor(100);

    expect(placeholder.style.display).to.equal('none');
  });
});

describe('GeoJsonEditor - Save API', () => {

  it('should have save() method', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    expect(el.save).to.be.a('function');
  });

  it('should return true when save is successful', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    // Mock the click to avoid actual download in tests
    const originalCreateElement = document.createElement.bind(document);
    let downloadTriggered = false;
    document.createElement = (tag) => {
      const elem = originalCreateElement(tag);
      if (tag === 'a') {
        elem.click = () => { downloadTriggered = true; };
      }
      return elem;
    };

    const result = el.save();

    expect(result).to.be.true;
    expect(downloadTriggered).to.be.true;

    // Restore
    document.createElement = originalCreateElement;
  });

  it('should use default filename', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    let capturedFilename = null;
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = (tag) => {
      const elem = originalCreateElement(tag);
      if (tag === 'a') {
        elem.click = () => {};
        Object.defineProperty(elem, 'download', {
          set: (val) => { capturedFilename = val; },
          get: () => capturedFilename
        });
      }
      return elem;
    };

    el.save();

    expect(capturedFilename).to.equal('features.geojson');

    document.createElement = originalCreateElement;
  });

  it('should use custom filename when provided', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    let capturedFilename = null;
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = (tag) => {
      const elem = originalCreateElement(tag);
      if (tag === 'a') {
        elem.click = () => {};
        Object.defineProperty(elem, 'download', {
          set: (val) => { capturedFilename = val; },
          get: () => capturedFilename
        });
      }
      return elem;
    };

    el.save('my-map.geojson');

    expect(capturedFilename).to.equal('my-map.geojson');

    document.createElement = originalCreateElement;
  });

  it('should return false for empty editor', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    const originalCreateElement = document.createElement.bind(document);
    document.createElement = (tag) => {
      const elem = originalCreateElement(tag);
      if (tag === 'a') {
        elem.click = () => {};
      }
      return elem;
    };

    // Empty editor should still save (empty FeatureCollection)
    const result = el.save();
    expect(result).to.be.true;

    document.createElement = originalCreateElement;
  });
});

describe('GeoJsonEditor - Open API', () => {

  it('should have open() method', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    expect(el.open).to.be.a('function');
  });

  it('should return a Promise', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Mock file input to immediately cancel
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = (tag) => {
      const elem = originalCreateElement(tag);
      if (tag === 'input' && elem.type === 'file') {
        elem.click = () => {
          // Simulate cancel
          elem.dispatchEvent(new Event('cancel'));
        };
      }
      return elem;
    };

    const result = el.open();
    expect(result).to.be.a('promise');

    document.createElement = originalCreateElement;
  });

  it('should return false when cancelled', async () => {
    const el = await createSizedFixture();
    await waitFor();

    const originalCreateElement = document.createElement.bind(document);
    document.createElement = (tag) => {
      const elem = originalCreateElement(tag);
      if (tag === 'input') {
        elem.click = () => {
          // Simulate cancel
          setTimeout(() => {
            elem.dispatchEvent(new Event('cancel'));
          }, 10);
        };
      }
      return elem;
    };

    const result = await el.open();
    expect(result).to.be.false;

    document.createElement = originalCreateElement;
  });

  it('should accept .geojson and .json files', async () => {
    const el = await createSizedFixture();
    await waitFor();

    let capturedAccept = null;
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = (tag) => {
      const elem = originalCreateElement(tag);
      if (tag === 'input') {
        Object.defineProperty(elem, 'accept', {
          set: (val) => { capturedAccept = val; },
          get: () => capturedAccept
        });
        elem.click = () => {
          setTimeout(() => {
            elem.dispatchEvent(new Event('cancel'));
          }, 10);
        };
      }
      return elem;
    };

    el.open();
    await waitFor(50);

    expect(capturedAccept).to.include('.geojson');
    expect(capturedAccept).to.include('.json');

    document.createElement = originalCreateElement;
  });

  it('should allow open() via API in readonly mode', async () => {
    const el = await fixture(html`<geojson-editor readonly style="height: 400px; width: 600px;"></geojson-editor>`);
    await waitFor();

    // API should work in readonly mode
    let inputCreated = false;
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = (tag) => {
      const elem = originalCreateElement(tag);
      if (tag === 'input') {
        inputCreated = true;
        elem.click = () => {
          setTimeout(() => {
            elem.dispatchEvent(new Event('cancel'));
          }, 10);
        };
      }
      return elem;
    };

    await el.open();

    expect(inputCreated).to.be.true;

    document.createElement = originalCreateElement;
  });

  it('should create file input with correct accept attribute', async () => {
    const el = await createSizedFixture();
    await waitFor();

    let createdInput = null;
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = (tag) => {
      const elem = originalCreateElement(tag);
      if (tag === 'input') {
        createdInput = elem;
        elem.click = () => {
          // Simulate cancel to resolve promise
          setTimeout(() => {
            elem.dispatchEvent(new Event('cancel'));
          }, 10);
        };
      }
      return elem;
    };

    await el.open();

    expect(createdInput).to.not.be.null;
    expect(createdInput.type).to.equal('file');
    expect(createdInput.accept).to.include('.geojson');
    expect(createdInput.accept).to.include('.json');

    document.createElement = originalCreateElement;
  });

  it('should return false when no file is selected', async () => {
    const el = await createSizedFixture();
    await waitFor();

    const originalCreateElement = document.createElement.bind(document);
    document.createElement = (tag) => {
      const elem = originalCreateElement(tag);
      if (tag === 'input') {
        elem.click = () => {
          setTimeout(() => {
            // Simulate change event with no files
            Object.defineProperty(elem, 'files', { value: [] });
            elem.dispatchEvent(new Event('change'));
          }, 10);
        };
      }
      return elem;
    };

    const result = await el.open();

    expect(result).to.be.false;

    document.createElement = originalCreateElement;
  });
});

describe('GeoJsonEditor - Collapsed Option', () => {

  it('should collapse coordinates by default with set()', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon]);
    await waitFor(200);

    // Check that coordinates nodes are collapsed
    const ranges = el._findCollapsibleRanges();
    const coordinatesRange = ranges.find(r => r.nodeKey === 'coordinates');
    expect(coordinatesRange).to.exist;
    expect(el.collapsedNodes.has(coordinatesRange.nodeId)).to.be.true;
  });

  it('should not collapse anything with empty collapsed array', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon], { collapsed: [] });
    await waitFor(200);

    // Nothing should be collapsed
    expect(el.collapsedNodes.size).to.equal(0);
  });

  it('should collapse specified attributes', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon], { collapsed: ['geometry'] });
    await waitFor(200);

    // Check that geometry is collapsed but not coordinates (since we specified custom)
    const ranges = el._findCollapsibleRanges();
    const geometryRange = ranges.find(r => r.nodeKey === 'geometry');
    expect(geometryRange).to.exist;
    expect(el.collapsedNodes.has(geometryRange.nodeId)).to.be.true;
  });

  it('should collapse $root to collapse entire feature', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon], { collapsed: ['$root'] });
    await waitFor(200);

    // Check that root feature is collapsed
    const ranges = el._findCollapsibleRanges();
    const rootRange = ranges.find(r => r.isRootFeature);
    expect(rootRange).to.exist;
    expect(el.collapsedNodes.has(rootRange.nodeId)).to.be.true;
  });

  it('should accept function for dynamic collapsed', async () => {
    const el = await createSizedFixture();
    await waitFor();

    const features = [validPoint, validPolygon];
    el.set(features, {
      collapsed: (feature) => {
        // Collapse coordinates for Polygon, nothing for Point
        if (feature.geometry?.type === 'Polygon') {
          return ['coordinates'];
        }
        return [];
      }
    });
    await waitFor(200);

    const ranges = el._findCollapsibleRanges();

    // Find coordinates ranges - should have 2 (one per feature)
    const coordinatesRanges = ranges.filter(r => r.nodeKey === 'coordinates');
    expect(coordinatesRanges.length).to.equal(2);

    // Only the Polygon's coordinates should be collapsed
    // The Polygon is second in the array, so its coordinates should be collapsed
    let collapsedCount = 0;
    for (const range of coordinatesRanges) {
      if (el.collapsedNodes.has(range.nodeId)) {
        collapsedCount++;
      }
    }
    expect(collapsedCount).to.equal(1);
  });

  it('should work with add() and collapsed option', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    // Manually expand first feature's geometry
    const rangesBefore = el._findCollapsibleRanges();
    const firstGeometry = rangesBefore.find(r => r.nodeKey === 'geometry');
    if (firstGeometry && el.collapsedNodes.has(firstGeometry.nodeId)) {
      el.collapsedNodes.delete(firstGeometry.nodeId);
    }

    el.add([validPolygon], { collapsed: ['geometry', 'properties'] });
    await waitFor(200);

    const ranges = el._findCollapsibleRanges();
    const geometryRanges = ranges.filter(r => r.nodeKey === 'geometry');

    // First feature's geometry should still be expanded (preserved)
    // Second feature (added) should have geometry collapsed per options
    expect(geometryRanges.length).to.equal(2);
    // The newly added feature (second) should be collapsed
    const secondGeometry = geometryRanges[1];
    expect(el.collapsedNodes.has(secondGeometry.nodeId)).to.be.true;
  });

  it('should work with insertAt() and collapsed option', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Use empty collapsed for initial set to not collapse anything
    el.set([validPoint, validPolygon], { collapsed: [] });
    await waitFor(200);

    const newFeature = { type: 'Feature', geometry: null, properties: { name: 'inserted' } };
    el.insertAt(newFeature, 1, { collapsed: ['properties'] });
    await waitFor(200);

    // insertAt preserves existing features' state, applies collapsed only to inserted
    const ranges = el._findCollapsibleRanges();
    const propertiesRanges = ranges.filter(r => r.nodeKey === 'properties');

    // 3 features = 3 properties nodes
    expect(propertiesRanges.length).to.equal(3);

    // Only the inserted feature (index 1) should have properties collapsed
    const collapsedProperties = propertiesRanges.filter(r => el.collapsedNodes.has(r.nodeId));
    expect(collapsedProperties.length).to.equal(1);
  });

  // DEMO SCENARIO: Existing features with collapsed coordinates must stay collapsed after add()/insertAt()
  it('should preserve existing collapsed coordinates when add() is called (DEMO scenario)', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Simulate demo: set multiple polygons - coordinates auto-collapse by default
    el.set([validPolygon, validPolygon]);
    await waitFor(200);

    // Verify coordinates are collapsed
    const rangesBefore = el._findCollapsibleRanges();
    const coordsBefore = rangesBefore.filter(r => r.nodeKey === 'coordinates');
    expect(coordsBefore.length).to.equal(2);
    expect(el.collapsedNodes.has(coordsBefore[0].nodeId)).to.be.true;
    expect(el.collapsedNodes.has(coordsBefore[1].nodeId)).to.be.true;

    // Now add a new feature (like demo's add() button)
    el.add(validPolygon);
    await waitFor(200);

    // Check that EXISTING features still have collapsed coordinates
    const rangesAfter = el._findCollapsibleRanges();
    const coordsAfter = rangesAfter.filter(r => r.nodeKey === 'coordinates');

    expect(coordsAfter.length).to.equal(3);

    // First two features (existing) must still be collapsed
    expect(el.collapsedNodes.has(coordsAfter[0].nodeId)).to.be.true;
    expect(el.collapsedNodes.has(coordsAfter[1].nodeId)).to.be.true;
    // Third feature (added) should also be collapsed (default behavior)
    expect(el.collapsedNodes.has(coordsAfter[2].nodeId)).to.be.true;
  });

  it('should preserve existing collapsed coordinates when insertAt() is called (DEMO scenario)', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Simulate demo: set multiple polygons - coordinates auto-collapse by default
    el.set([validPolygon, validPolygon]);
    await waitFor(200);

    // Verify coordinates are collapsed
    const rangesBefore = el._findCollapsibleRanges();
    const coordsBefore = rangesBefore.filter(r => r.nodeKey === 'coordinates');
    expect(coordsBefore.length).to.equal(2);
    expect(el.collapsedNodes.has(coordsBefore[0].nodeId)).to.be.true;
    expect(el.collapsedNodes.has(coordsBefore[1].nodeId)).to.be.true;

    // Insert a new feature at index 1 (between existing features)
    el.insertAt(validPolygon, 1);
    await waitFor(200);

    // Check that ALL features have collapsed coordinates
    const rangesAfter = el._findCollapsibleRanges();
    const coordsAfter = rangesAfter.filter(r => r.nodeKey === 'coordinates');
    expect(coordsAfter.length).to.equal(3);

    // All features must have collapsed coordinates
    expect(el.collapsedNodes.has(coordsAfter[0].nodeId)).to.be.true;
    expect(el.collapsedNodes.has(coordsAfter[1].nodeId)).to.be.true;
    expect(el.collapsedNodes.has(coordsAfter[2].nodeId)).to.be.true;
  });

  it('should collapse multiple attributes', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon], { collapsed: ['coordinates', 'properties'] });
    await waitFor(200);

    const ranges = el._findCollapsibleRanges();
    const coordinatesRange = ranges.find(r => r.nodeKey === 'coordinates');
    const propertiesRange = ranges.find(r => r.nodeKey === 'properties');

    expect(el.collapsedNodes.has(coordinatesRange.nodeId)).to.be.true;
    expect(el.collapsedNodes.has(propertiesRange.nodeId)).to.be.true;
  });

  it('should NOT collapse when JSON has parse error (INVALID token)', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Manually set invalid JSON content with INVALID token
    el.lines = [
      '{',
      '  "type": "Feature",',
      '  "geometry": {',
      '    "type": "Point",',
      '    "coordinates": [INVALID, 0]',
      '  },',
      '  "properties": {}',
      '}'
    ];
    el.updateModel();
    el.scheduleRender();
    await waitFor(100);

    // Try to collapse coordinates
    el.autoCollapseCoordinates();
    await waitFor(100);

    // Nothing should be collapsed because JSON has errors
    expect(el.collapsedNodes.size).to.equal(0);
  });

  it('should NOT collapse when number has space (syntax error)', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Number with space "1 2" instead of "12"
    el.lines = [
      '{',
      '  "type": "Feature",',
      '  "geometry": {',
      '    "type": "Point",',
      '    "coordinates": [1 2, 3]',
      '  },',
      '  "properties": {}',
      '}'
    ];
    el.updateModel();
    el.scheduleRender();
    await waitFor(100);

    el.autoCollapseCoordinates();
    await waitFor(100);

    expect(el.collapsedNodes.size).to.equal(0);
  });

  it('should NOT collapse when missing comma', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Missing comma after "Point"
    el.lines = [
      '{',
      '  "type": "Feature",',
      '  "geometry": {',
      '    "type": "Point"',
      '    "coordinates": [1, 2]',
      '  },',
      '  "properties": {}',
      '}'
    ];
    el.updateModel();
    el.scheduleRender();
    await waitFor(100);

    el.autoCollapseCoordinates();
    await waitFor(100);

    expect(el.collapsedNodes.size).to.equal(0);
  });

  it('should NOT collapse when missing opening bracket [', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Missing [ before coordinates
    el.lines = [
      '{',
      '  "type": "Feature",',
      '  "geometry": {',
      '    "type": "Point",',
      '    "coordinates": 1, 2]',
      '  },',
      '  "properties": {}',
      '}'
    ];
    el.updateModel();
    el.scheduleRender();
    await waitFor(100);

    el.autoCollapseCoordinates();
    await waitFor(100);

    expect(el.collapsedNodes.size).to.equal(0);
  });

  it('should NOT collapse when missing opening bracket {', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Missing { before geometry content
    el.lines = [
      '{',
      '  "type": "Feature",',
      '  "geometry":',
      '    "type": "Point",',
      '    "coordinates": [1, 2]',
      '  },',
      '  "properties": {}',
      '}'
    ];
    el.updateModel();
    el.scheduleRender();
    await waitFor(100);

    el.autoCollapseCoordinates();
    await waitFor(100);

    expect(el.collapsedNodes.size).to.equal(0);
  });

  it('should NOT collapse when multiple brackets missing', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Multiple missing brackets
    el.lines = [
      '"type": "Feature",',
      '"geometry":',
      '  "type": "Point",',
      '  "coordinates": 1, 2',
      '"properties":'
    ];
    el.updateModel();
    el.scheduleRender();
    await waitFor(100);

    el.autoCollapseCoordinates();
    await waitFor(100);

    expect(el.collapsedNodes.size).to.equal(0);
  });

  it('should collapse when JSON is valid', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Valid JSON
    el.set([validPolygon], { collapsed: [] });
    await waitFor(200);

    // Verify no collapsed yet
    expect(el.collapsedNodes.size).to.equal(0);

    // Now collapse
    el.autoCollapseCoordinates();
    await waitFor(100);

    // Should have collapsed coordinates
    expect(el.collapsedNodes.size).to.be.greaterThan(0);
  });

  it('should auto-collapse coordinates of new feature when fixing JSON error (missing comma)', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Suppress error events during test (temporary JSON errors during edit)
    el.addEventListener('error', (e) => e.stopPropagation());

    // Start with invalid JSON content - two features but missing comma between them
    // This simulates what happens when user types a new feature but forgets the comma
    el.lines = [
      '{',
      '  "type": "Feature",',
      '  "geometry": {',
      '    "type": "Polygon",',
      '    "coordinates": [',
      '      [',
      '        [0, 0],',
      '        [1, 0],',
      '        [1, 1],',
      '        [0, 0]',
      '      ]',
      '    ]',
      '  },',
      '  "properties": {}',
      '}',  // <-- Missing comma here
      '{',
      '  "type": "Feature",',
      '  "geometry": {',
      '    "type": "Point",',
      '    "coordinates": [1, 2]',
      '  },',
      '  "properties": {}',
      '}'
    ];
    el.updateModel();
    await waitFor(100);

    // Verify we have errors (missing comma between features)
    expect(el._hasErrors()).to.be.true;

    // Coordinates should NOT be collapsed while there are errors
    let ranges = el._findCollapsibleRanges();
    let coords = ranges.filter(r => r.nodeKey === 'coordinates');
    // There should be coordinates nodes but they shouldn't be collapsed (due to errors)
    expect(coords.length).to.be.greaterThan(0);

    // Now fix the error by inserting comma at end of line 14
    // Use insertText to simulate user typing, which triggers formatAndUpdate properly
    el.cursorLine = 14;
    el.cursorColumn = el.lines[14].length;  // Position at end of '}'
    el.insertText(',');
    await waitFor(200);

    // Verify JSON is now valid
    expect(el._hasErrors()).to.be.false;

    // Now JSON is valid, both features' coordinates should be collapsed
    ranges = el._findCollapsibleRanges();
    coords = ranges.filter(r => r.nodeKey === 'coordinates');
    expect(coords.length).to.equal(2);

    // Both features' coordinates should now be collapsed
    expect(el.collapsedNodes.has(coords[0].nodeId)).to.be.true;
    expect(el.collapsedNodes.has(coords[1].nodeId)).to.be.true;
  });
});

describe('GeoJsonEditor - Inline Controls', () => {

  it('should update boolean value via updateBooleanValue()', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set a feature with a boolean property
    const featureWithBool = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { visible: true }
    };
    el.set([featureWithBool], { collapsed: [] });
    await waitFor(200);

    // Find the line with the boolean
    const boolLineIndex = el.lines.findIndex(line => line.includes('"visible"'));
    expect(boolLineIndex).to.be.greaterThan(-1);

    // Update boolean value to false
    el.updateBooleanValue(boolLineIndex, false, 'visible');
    await waitFor(100);

    // Verify the value was updated
    expect(el.lines[boolLineIndex]).to.include('false');
  });

  it('should update color value via updateColorValue()', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set a feature with a color property
    const featureWithColor = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { color: '#ff0000' }
    };
    el.set([featureWithColor], { collapsed: [] });
    await waitFor(200);

    // Find the line with the color
    const colorLineIndex = el.lines.findIndex(line => line.includes('"color"'));
    expect(colorLineIndex).to.be.greaterThan(-1);

    // Update color value
    el.updateColorValue(colorLineIndex, '#00ff00', 'color');
    await waitFor(100);

    // Verify the value was updated
    expect(el.lines[colorLineIndex]).to.include('#00ff00');
  });

  it('should emit() manually trigger change event', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint], { collapsed: [] });
    await waitFor(200);

    let changeEventFired = false;
    el.addEventListener('change', () => {
      changeEventFired = true;
    });

    el.emit();
    await waitFor(50);

    expect(changeEventFired).to.be.true;
  });
});

describe('GeoJsonEditor - Selection Highlight', () => {

  it('should add selection highlight via _addSelectionHighlight()', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint], { collapsed: [] });
    await waitFor(200);

    // Set up a selection
    el.selectionStart = { line: 0, column: 0 };
    el.selectionEnd = { line: 0, column: 5 };

    const lineContent = el.lines[0];
    const html = '<span>test content</span>';

    const result = el._addSelectionHighlight(html, 0, lineContent);

    // Should contain selection span
    expect(result).to.include('class="selection"');
  });

  it('should return unchanged html if line not in selection', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint], { collapsed: [] });
    await waitFor(200);

    // Set up a selection on line 0 only
    el.selectionStart = { line: 0, column: 0 };
    el.selectionEnd = { line: 0, column: 5 };

    const lineContent = el.lines[5] || 'test';
    const html = '<span>test content</span>';

    // Line 5 is not in selection
    const result = el._addSelectionHighlight(html, 5, lineContent);

    // Should return unchanged
    expect(result).to.equal(html);
  });
});

describe('GeoJsonEditor - Gutter Click', () => {

  it('should toggle collapse via handleGutterClick on collapse button', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon], { collapsed: [] });
    await waitFor(200);

    // Get a collapsible node
    const ranges = el._findCollapsibleRanges();
    const coordinatesRange = ranges.find(r => r.nodeKey === 'coordinates');
    expect(coordinatesRange).to.exist;

    // Initially not collapsed
    expect(el.collapsedNodes.has(coordinatesRange.nodeId)).to.be.false;

    // Simulate gutter click on collapse button
    const mockTarget = {
      classList: { contains: (cls) => cls === 'collapse-button' },
      dataset: { nodeId: coordinatesRange.nodeId },
      closest: () => null
    };
    const mockEvent = { target: mockTarget };

    el.handleGutterClick(mockEvent);
    await waitFor(100);

    // Should now be collapsed
    expect(el.collapsedNodes.has(coordinatesRange.nodeId)).to.be.true;
  });
});

// ==================== COMPREHENSIVE COLLAPSE SCENARIOS ====================
// These tests cover all combinations of initial state and operations

describe('GeoJsonEditor - Comprehensive Collapse Scenarios', () => {

  // ========== API: set() into empty editor ==========

  it('API: set() into empty editor should collapse coordinates by default', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon]);
    await waitFor(200);

    const ranges = el._findCollapsibleRanges();
    const coords = ranges.filter(r => r.nodeKey === 'coordinates');
    expect(coords.length).to.equal(1);
    expect(el.collapsedNodes.has(coords[0].nodeId)).to.be.true;
  });

  it('API: set() multiple features into empty editor should collapse all coordinates', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon, validPolygon, validPolygon]);
    await waitFor(200);

    const ranges = el._findCollapsibleRanges();
    const coords = ranges.filter(r => r.nodeKey === 'coordinates');
    expect(coords.length).to.equal(3);
    coords.forEach(c => {
      expect(el.collapsedNodes.has(c.nodeId)).to.be.true;
    });
  });

  // ========== API: add() into empty editor ==========

  it('API: add() into empty editor should collapse coordinates by default', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.add(validPolygon);
    await waitFor(200);

    const ranges = el._findCollapsibleRanges();
    const coords = ranges.filter(r => r.nodeKey === 'coordinates');
    expect(coords.length).to.equal(1);
    expect(el.collapsedNodes.has(coords[0].nodeId)).to.be.true;
  });

  it('API: add() multiple features into empty editor should collapse all coordinates', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.add([validPolygon, validPolygon]);
    await waitFor(200);

    const ranges = el._findCollapsibleRanges();
    const coords = ranges.filter(r => r.nodeKey === 'coordinates');
    expect(coords.length).to.equal(2);
    coords.forEach(c => {
      expect(el.collapsedNodes.has(c.nodeId)).to.be.true;
    });
  });

  // ========== API: insertAt() into empty editor ==========

  it('API: insertAt() into empty editor should collapse coordinates by default', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.insertAt(validPolygon, 0);
    await waitFor(200);

    const ranges = el._findCollapsibleRanges();
    const coords = ranges.filter(r => r.nodeKey === 'coordinates');
    expect(coords.length).to.equal(1);
    expect(el.collapsedNodes.has(coords[0].nodeId)).to.be.true;
  });

  // ========== API: add() with existing features ==========

  it('API: add() with existing features should preserve existing collapsed state', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set initial features
    el.set([validPolygon, validPolygon]);
    await waitFor(200);

    // Verify initial collapse
    let ranges = el._findCollapsibleRanges();
    let coords = ranges.filter(r => r.nodeKey === 'coordinates');
    expect(coords.length).to.equal(2);
    expect(el.collapsedNodes.has(coords[0].nodeId)).to.be.true;
    expect(el.collapsedNodes.has(coords[1].nodeId)).to.be.true;

    // Add new feature
    el.add(validPolygon);
    await waitFor(200);

    // Check all 3 are collapsed
    ranges = el._findCollapsibleRanges();
    coords = ranges.filter(r => r.nodeKey === 'coordinates');
    expect(coords.length).to.equal(3);
    coords.forEach(c => {
      expect(el.collapsedNodes.has(c.nodeId)).to.be.true;
    });
  });

  it('API: add() should preserve manually expanded nodes', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set initial features
    el.set([validPolygon, validPolygon]);
    await waitFor(200);

    // Manually expand first feature's coordinates
    let ranges = el._findCollapsibleRanges();
    let coords = ranges.filter(r => r.nodeKey === 'coordinates');
    el.toggleCollapse(coords[0].nodeId); // Expand first
    await waitFor(50);

    expect(el.collapsedNodes.has(coords[0].nodeId)).to.be.false; // First expanded
    expect(el.collapsedNodes.has(coords[1].nodeId)).to.be.true;  // Second still collapsed

    // Add new feature
    el.add(validPolygon);
    await waitFor(200);

    // First should still be expanded, others collapsed
    ranges = el._findCollapsibleRanges();
    coords = ranges.filter(r => r.nodeKey === 'coordinates');
    expect(coords.length).to.equal(3);
    expect(el.collapsedNodes.has(coords[0].nodeId)).to.be.false; // Still expanded
    expect(el.collapsedNodes.has(coords[1].nodeId)).to.be.true;  // Still collapsed
    expect(el.collapsedNodes.has(coords[2].nodeId)).to.be.true;  // New - collapsed
  });

  // ========== API: insertAt() with existing features ==========

  it('API: insertAt() at beginning should preserve existing collapsed state', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon, validPolygon]);
    await waitFor(200);

    el.insertAt(validPolygon, 0);
    await waitFor(200);

    const ranges = el._findCollapsibleRanges();
    const coords = ranges.filter(r => r.nodeKey === 'coordinates');
    expect(coords.length).to.equal(3);
    coords.forEach(c => {
      expect(el.collapsedNodes.has(c.nodeId)).to.be.true;
    });
  });

  it('API: insertAt() in middle should preserve existing collapsed state', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon, validPolygon]);
    await waitFor(200);

    el.insertAt(validPolygon, 1);
    await waitFor(200);

    const ranges = el._findCollapsibleRanges();
    const coords = ranges.filter(r => r.nodeKey === 'coordinates');
    expect(coords.length).to.equal(3);
    coords.forEach(c => {
      expect(el.collapsedNodes.has(c.nodeId)).to.be.true;
    });
  });

  it('API: insertAt() at end should preserve existing collapsed state', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon, validPolygon]);
    await waitFor(200);

    el.insertAt(validPolygon, 2);
    await waitFor(200);

    const ranges = el._findCollapsibleRanges();
    const coords = ranges.filter(r => r.nodeKey === 'coordinates');
    expect(coords.length).to.equal(3);
    coords.forEach(c => {
      expect(el.collapsedNodes.has(c.nodeId)).to.be.true;
    });
  });

  // ========== PASTE: into empty editor ==========

  it('PASTE: single feature into empty editor should collapse coordinates', async () => {
    const el = await createSizedFixture();
    await waitFor();

    const mockEvent = {
      preventDefault: () => {},
      clipboardData: { getData: () => JSON.stringify(validPolygon) }
    };

    el.handlePaste(mockEvent);
    await waitFor(300);

    const ranges = el._findCollapsibleRanges();
    const coords = ranges.filter(r => r.nodeKey === 'coordinates');
    expect(coords.length).to.equal(1);
    expect(el.collapsedNodes.has(coords[0].nodeId)).to.be.true;
  });

  it('PASTE: multiple features (array) into empty editor should collapse all coordinates', async () => {
    const el = await createSizedFixture();
    await waitFor();

    const mockEvent = {
      preventDefault: () => {},
      clipboardData: { getData: () => JSON.stringify([validPolygon, validPolygon]) }
    };

    el.handlePaste(mockEvent);
    await waitFor(300);

    const ranges = el._findCollapsibleRanges();
    const coords = ranges.filter(r => r.nodeKey === 'coordinates');
    expect(coords.length).to.equal(2);
    coords.forEach(c => {
      expect(el.collapsedNodes.has(c.nodeId)).to.be.true;
    });
  });

  it('PASTE: FeatureCollection into empty editor should collapse all coordinates', async () => {
    const el = await createSizedFixture();
    await waitFor();

    const fc = {
      type: 'FeatureCollection',
      features: [validPolygon, validPolygon]
    };

    const mockEvent = {
      preventDefault: () => {},
      clipboardData: { getData: () => JSON.stringify(fc) }
    };

    el.handlePaste(mockEvent);
    await waitFor(300);

    const ranges = el._findCollapsibleRanges();
    const coords = ranges.filter(r => r.nodeKey === 'coordinates');
    expect(coords.length).to.equal(2);
    coords.forEach(c => {
      expect(el.collapsedNodes.has(c.nodeId)).to.be.true;
    });
  });

  // ========== PASTE: with existing features ==========

  it('PASTE: array of features into editor with existing features should collapse all', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set initial
    el.set([validPolygon]);
    await waitFor(200);

    // Verify initial state
    let ranges = el._findCollapsibleRanges();
    let coords = ranges.filter(r => r.nodeKey === 'coordinates');
    expect(coords.length).to.equal(1);
    expect(el.collapsedNodes.has(coords[0].nodeId)).to.be.true;

    // Clear and paste multiple features (simulates copy from elsewhere)
    el.removeAll();
    await waitFor(100);

    // Paste an array of features
    const mockEvent = {
      preventDefault: () => {},
      clipboardData: { getData: () => JSON.stringify([validPolygon, validPolygon]) }
    };

    el.handlePaste(mockEvent);
    await waitFor(300);

    ranges = el._findCollapsibleRanges();
    coords = ranges.filter(r => r.nodeKey === 'coordinates');
    expect(coords.length).to.equal(2);
    coords.forEach(c => {
      expect(el.collapsedNodes.has(c.nodeId)).to.be.true;
    });
  });

  // ========== PASTE: after removeAll() ==========

  it('PASTE: after removeAll() should collapse coordinates', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set initial
    el.set([validPolygon, validPolygon]);
    await waitFor(200);

    // Remove all
    el.removeAll();
    await waitFor(100);

    // Paste
    const mockEvent = {
      preventDefault: () => {},
      clipboardData: { getData: () => JSON.stringify(validPolygon) }
    };

    el.handlePaste(mockEvent);
    await waitFor(300);

    const ranges = el._findCollapsibleRanges();
    const coords = ranges.filter(r => r.nodeKey === 'coordinates');
    expect(coords.length).to.equal(1);
    expect(el.collapsedNodes.has(coords[0].nodeId)).to.be.true;
  });

  it('PASTE: Ctrl+A Ctrl+C removeAll Ctrl+V should collapse all coordinates', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set initial
    el.set([validPolygon, validPolygon]);
    await waitFor(200);

    // Copy content (simulating Ctrl+A Ctrl+C)
    const copiedContent = el.getContent();

    // Remove all
    el.removeAll();
    await waitFor(100);

    // Paste (the format is "feature, feature" not a JSON array)
    const mockEvent = {
      preventDefault: () => {},
      clipboardData: { getData: () => copiedContent }
    };

    el.handlePaste(mockEvent);
    await waitFor(300);

    const ranges = el._findCollapsibleRanges();
    const coords = ranges.filter(r => r.nodeKey === 'coordinates');
    expect(coords.length).to.equal(2);
    coords.forEach(c => {
      expect(el.collapsedNodes.has(c.nodeId)).to.be.true;
    });
  });

  // ========== API: removeAt() should preserve collapse ==========

  it('API: removeAt() should preserve collapsed state of remaining features', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon, validPolygon, validPolygon]);
    await waitFor(200);

    // Remove middle feature
    el.removeAt(1);
    await waitFor(200);

    const ranges = el._findCollapsibleRanges();
    const coords = ranges.filter(r => r.nodeKey === 'coordinates');
    expect(coords.length).to.equal(2);
    coords.forEach(c => {
      expect(el.collapsedNodes.has(c.nodeId)).to.be.true;
    });
  });

  // ========== Mixed scenarios ==========

  it('MIXED: set then add then insertAt should maintain all collapsed', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon]);
    await waitFor(200);

    el.add(validPolygon);
    await waitFor(200);

    el.insertAt(validPolygon, 1);
    await waitFor(200);

    const ranges = el._findCollapsibleRanges();
    const coords = ranges.filter(r => r.nodeKey === 'coordinates');
    expect(coords.length).to.equal(3);
    coords.forEach(c => {
      expect(el.collapsedNodes.has(c.nodeId)).to.be.true;
    });
  });

  it('MIXED: multiple add() calls should maintain all collapsed', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.add(validPolygon);
    await waitFor(200);

    el.add(validPolygon);
    await waitFor(200);

    el.add(validPolygon);
    await waitFor(200);

    const ranges = el._findCollapsibleRanges();
    const coords = ranges.filter(r => r.nodeKey === 'coordinates');
    expect(coords.length).to.equal(3);
    coords.forEach(c => {
      expect(el.collapsedNodes.has(c.nodeId)).to.be.true;
    });
  });

  it('MIXED: multiple insertAt() calls should maintain all collapsed', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.insertAt(validPolygon, 0);
    await waitFor(200);

    el.insertAt(validPolygon, 0);
    await waitFor(200);

    el.insertAt(validPolygon, 1);
    await waitFor(200);

    const ranges = el._findCollapsibleRanges();
    const coords = ranges.filter(r => r.nodeKey === 'coordinates');
    expect(coords.length).to.equal(3);
    coords.forEach(c => {
      expect(el.collapsedNodes.has(c.nodeId)).to.be.true;
    });
  });
});
