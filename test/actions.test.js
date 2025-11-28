import { expect, fixture, html } from '@open-wc/testing';
import GeoJsonEditor from '../src/geojson-editor.js';
import {
  validPointStr,
  validPolygonStr,
  validPoint,
  validPolygon
} from './fixtures/geojson-samples.js';

// Helper to wait for component to stabilize
const waitFor = (ms = 100) => new Promise(r => setTimeout(r, ms));

// Create a fixture with explicit size for viewport rendering tests
const createSizedFixture = async (attributes = '') => {
  return await fixture(html`<geojson-editor style="height: 400px; width: 600px;" ${attributes}></geojson-editor>`);
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

  it('should throw error when set() receives non-array', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    expect(() => el.set('not an array')).to.throw();
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
