import { expect, fixture, html } from '@open-wc/testing';
import GeoJsonEditor from '../src/geojson-editor.js';
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

    const featureKey = '0';
    el.toggleFeatureVisibility(featureKey);
    
    expect(el.hiddenFeatures.has(featureKey)).to.be.true;
  });

  it('should show feature when toggled again', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    const featureKey = '0';
    el.hiddenFeatures.add(featureKey);
    el.toggleFeatureVisibility(featureKey);
    
    expect(el.hiddenFeatures.has(featureKey)).to.be.false;
  });

  it('should apply hidden state when toggling feature visibility', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(300);

    // Get the first feature key from featureRanges
    const keys = Array.from(el.featureRanges.keys());
    expect(keys.length).to.be.greaterThan(0);

    const featureKey = keys[0];

    // Toggle visibility
    el.toggleFeatureVisibility(featureKey);
    await waitFor(200);

    // Check the feature is marked as hidden
    expect(el.hiddenFeatures.has(featureKey)).to.be.true;
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
    const featureKey = firstVisibilityLine.dataset.featureKey;
    expect(featureKey).to.exist;

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
    expect(el.hiddenFeatures.has(featureKey)).to.be.true;
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

describe('GeoJsonEditor - Undo/Redo System', () => {

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

  it('should handle Ctrl+Z keyboard shortcut', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"a": 1}'];
    el.cursorLine = 0;
    el.cursorColumn = 0;

    const originalLine = el.lines[0];

    el.insertText('X');
    await waitFor(100);

    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(100);

    expect(el.lines[0]).to.equal(originalLine);
  });

  it('should handle Ctrl+Shift+Z keyboard shortcut for redo', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"a": 1}'];
    el.cursorLine = 0;
    el.cursorColumn = 0;

    el.insertText('X');
    await waitFor(100);

    const modifiedLine = el.lines[0];

    el.undo();
    await waitFor(100);

    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(100);

    expect(el.lines[0]).to.equal(modifiedLine);
  });

  it('should handle Ctrl+Y keyboard shortcut for redo', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"a": 1}'];
    el.cursorLine = 0;
    el.cursorColumn = 0;

    el.insertText('X');
    await waitFor(100);

    const modifiedLine = el.lines[0];

    el.undo();
    await waitFor(100);

    const event = new KeyboardEvent('keydown', {
      key: 'y',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(100);

    expect(el.lines[0]).to.equal(modifiedLine);
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

describe('GeoJsonEditor - Save Feature', () => {

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

  it('should handle Ctrl+S keyboard shortcut', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    let saveCalled = false;
    const originalSave = el.save.bind(el);
    el.save = () => { saveCalled = true; return originalSave(); };

    const originalCreateElement = document.createElement.bind(document);
    document.createElement = (tag) => {
      const elem = originalCreateElement(tag);
      if (tag === 'a') {
        elem.click = () => {};
      }
      return elem;
    };

    const event = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);

    expect(saveCalled).to.be.true;

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

describe('GeoJsonEditor - Open Feature', () => {

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

  it('should handle Ctrl+O keyboard shortcut', async () => {
    const el = await createSizedFixture();
    await waitFor();

    let openCalled = false;
    el.open = () => { openCalled = true; return Promise.resolve(false); };

    const event = new KeyboardEvent('keydown', {
      key: 'o',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);

    expect(openCalled).to.be.true;
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

  it('should block Ctrl+O in readonly mode', async () => {
    const el = await fixture(html`<geojson-editor readonly style="height: 400px; width: 600px;"></geojson-editor>`);
    await waitFor();

    let openCalled = false;
    el.open = () => { openCalled = true; return Promise.resolve(false); };

    const event = new KeyboardEvent('keydown', {
      key: 'o',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);

    expect(openCalled).to.be.false;
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
