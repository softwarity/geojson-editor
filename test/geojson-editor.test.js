import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import GeoJsonEditor from '../src/geojson-editor.js';
import {
  validPointStr,
  validPolygonStr,
  invalidJson,
  complexFeatureStr,
  validPoint,
  validPolygon
} from './fixtures/geojson-samples.js';

// Helper to wait for component to stabilize
const waitFor = (ms = 100) => new Promise(r => setTimeout(r, ms));

describe('GeoJsonEditor - Basic Rendering', () => {

  it('should render with default state', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    expect(el.shadowRoot).to.exist;
    expect(el.shadowRoot.querySelector('.hidden-textarea')).to.exist;
    expect(el.shadowRoot.querySelector('.viewport')).to.exist;
    expect(el.shadowRoot.querySelector('.placeholder-layer')).to.exist;
    expect(el.shadowRoot.querySelector('.gutter')).to.exist;
  });

  it('should have empty content by default', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    
    expect(el.lines).to.be.an('array');
    expect(el.lines.length).to.equal(0);
  });

  it('should apply default dimensions', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    const styles = getComputedStyle(el);
    expect(styles.display).to.equal('flex');
  });
});

describe('GeoJsonEditor - Value Attribute', () => {

  it('should initialize with value attribute in HTML', async () => {
    const el = await fixture(html`
      <geojson-editor value='${validPointStr}'></geojson-editor>
    `);
    await waitFor();

    const content = el.lines.join('\n');
    expect(content).to.include('Feature');
    expect(content).to.include('Point');
  });

  it('should update content when value attribute changes', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    
    expect(el.lines.length).to.equal(0);

    el.setAttribute('value', validPointStr);
    await waitFor();

    const content = el.lines.join('\n');
    expect(content).to.include('Feature');
  });

  it('should handle empty value attribute', async () => {
    const el = await fixture(html`<geojson-editor value=""></geojson-editor>`);
    
    expect(el.lines.length).to.equal(0);
  });
});

describe('GeoJsonEditor - Readonly Attribute', () => {

  it('should set readOnly on textarea when readonly', async () => {
    const el = await fixture(html`<geojson-editor readonly></geojson-editor>`);
    const textarea = el.shadowRoot.querySelector('.hidden-textarea');

    expect(textarea.readOnly).to.be.true;
  });

  it('should remove readOnly from textarea when readonly is removed', async () => {
    const el = await fixture(html`<geojson-editor readonly></geojson-editor>`);
    const textarea = el.shadowRoot.querySelector('.hidden-textarea');

    expect(textarea.readOnly).to.be.true;

    el.removeAttribute('readonly');

    expect(textarea.readOnly).to.be.false;
  });

  it('should have readonly visual indicator', async () => {
    const el = await fixture(html`<geojson-editor readonly></geojson-editor>`);

    expect(el.hasAttribute('readonly')).to.be.true;
  });

  it('should hide clear button when readonly', async () => {
    const el = await fixture(html`<geojson-editor readonly></geojson-editor>`);
    const clearBtn = el.shadowRoot.getElementById('clearBtn');

    expect(clearBtn.hidden).to.be.true;
  });

  it('should show clear button when readonly is removed', async () => {
    const el = await fixture(html`<geojson-editor readonly></geojson-editor>`);
    const clearBtn = el.shadowRoot.getElementById('clearBtn');

    expect(clearBtn.hidden).to.be.true;

    el.removeAttribute('readonly');

    expect(clearBtn.hidden).to.be.false;
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

describe('GeoJsonEditor - Placeholder', () => {

  it('should display placeholder when empty', async () => {
    const el = await fixture(html`
      <geojson-editor placeholder="Enter GeoJSON..."></geojson-editor>
    `);
    const placeholder = el.shadowRoot.querySelector('.placeholder-layer');

    expect(placeholder.textContent).to.equal('Enter GeoJSON...');
    expect(placeholder.style.display).to.not.equal('none');
  });

  it('should support multi-line placeholder', async () => {
    const multiLine = 'Line 1\nLine 2\nLine 3';
    const el = await fixture(html`
      <geojson-editor placeholder="${multiLine}"></geojson-editor>
    `);
    const placeholder = el.shadowRoot.querySelector('.placeholder-layer');

    expect(placeholder.textContent).to.include('Line 1');
    expect(placeholder.textContent).to.include('Line 2');
  });

  it('should hide placeholder when content exists', async () => {
    const el = await fixture(html`
      <geojson-editor placeholder="Enter..."></geojson-editor>
    `);
    const placeholder = el.shadowRoot.querySelector('.placeholder-layer');

    el.set([validPoint]);
    await waitFor();

    expect(placeholder.style.display).to.equal('none');
  });

  it('should show placeholder after clearing content', async () => {
    const el = await fixture(html`
      <geojson-editor placeholder="Enter..."></geojson-editor>
    `);
    const placeholder = el.shadowRoot.querySelector('.placeholder-layer');

    el.set([validPoint]);
    await waitFor();
    expect(placeholder.style.display).to.equal('none');

    el.removeAll();
    await waitFor();
    expect(placeholder.style.display).to.not.equal('none');
  });

  it('should update placeholder when attribute changes', async () => {
    const el = await fixture(html`
      <geojson-editor placeholder="Old"></geojson-editor>
    `);
    const placeholder = el.shadowRoot.querySelector('.placeholder-layer');

    expect(placeholder.textContent).to.equal('Old');

    el.setAttribute('placeholder', 'New');

    expect(placeholder.textContent).to.equal('New');
  });
});

describe('GeoJsonEditor - Events', () => {

  it('should emit change event with valid GeoJSON wrapped in FeatureCollection', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    const changePromise = new Promise(resolve => {
      el.addEventListener('change', resolve, { once: true });
    });

    el.set([{ type: 'Feature', geometry: null, properties: {} }]);

    const event = await changePromise;

    expect(event.detail).to.exist;
    expect(event.detail.type).to.equal('FeatureCollection');
    expect(event.detail.features).to.be.an('array');
    expect(event.detail.features[0].type).to.equal('Feature');
  });

  it('should emit change event when value is set via setAttribute', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    const changePromise = new Promise(resolve => {
      el.addEventListener('change', resolve, { once: true });
    });

    el.setAttribute('value', '{"type": "Feature", "geometry": null, "properties": {}}');

    const event = await changePromise;

    expect(event.detail).to.exist;
    expect(event.detail.type).to.equal('FeatureCollection');
    expect(event.detail.features[0].type).to.equal('Feature');
  });

  it('should emit error event with invalid JSON', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    const errorPromise = new Promise(resolve => {
      el.addEventListener('error', (e) => {
        e.stopPropagation();
        resolve(e);
      }, { once: true });
    });

    // Set invalid content directly
    el.lines = ['{invalid'];
    el.emitChange();

    const event = await errorPromise;

    expect(event.detail).to.exist;
    expect(event.detail.error).to.exist;
  });

  it('should throw error for invalid geometry type in set()', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    const invalidFeature = {
      type: 'Feature',
      geometry: { type: 'InvalidType', coordinates: [0, 0] },
      properties: {}
    };

    expect(() => el.set([invalidFeature])).to.throw('Invalid geometry type');
  });
});

describe('GeoJsonEditor - Prefix/Suffix Display', () => {

  it('should show FeatureCollection prefix', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    const prefix = el.shadowRoot.getElementById('editorPrefix');

    expect(prefix.textContent).to.include('FeatureCollection');
    expect(prefix.textContent).to.include('features');
  });

  it('should show closing suffix', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    const suffix = el.shadowRoot.getElementById('editorSuffix');

    expect(suffix.textContent).to.include(']}');
  });
});

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
    // -1 should insert at position 1 (length + (-1) = 2 + (-1) = 1)
    expect(features[1].properties.last).to.be.true;
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
});

describe('GeoJsonEditor - Collapse/Expand', () => {

  it('should track collapsed nodes', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPolygon]);
    await waitFor();

    expect(el.collapsedNodes).to.be.instanceOf(Set);
  });

  it('should have collapse buttons in gutter for collapsible nodes', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPolygon]);
    await waitFor(200);

    const collapseButtons = el.shadowRoot.querySelectorAll('.collapse-button');
    expect(collapseButtons.length).to.be.greaterThan(0);
  });
});

describe('GeoJsonEditor - Syntax Highlighting', () => {

  it('should render lines in viewport', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    const linesContainer = el.shadowRoot.getElementById('linesContainer');
    const lines = linesContainer.querySelectorAll('.line');
    expect(lines.length).to.be.greaterThan(0);
  });

  it('should highlight JSON keys', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    const linesContainer = el.shadowRoot.getElementById('linesContainer');
    const keys = linesContainer.querySelectorAll('.json-key, .geojson-key');
    expect(keys.length).to.be.greaterThan(0);
  });

  it('should highlight JSON strings', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    const linesContainer = el.shadowRoot.getElementById('linesContainer');
    const strings = linesContainer.querySelectorAll('.json-string, .geojson-type');
    expect(strings.length).to.be.greaterThan(0);
  });

  it('should highlight JSON numbers', async () => {
    const el = await fixture(html`<geojson-editor style="height: 300px; width: 500px;"></geojson-editor>`);
    await waitFor();

    // Use a feature with a number property to ensure numbers are visible
    const featureWithNumber = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { count: 42 }
    };
    el.set([featureWithNumber]);
    await waitFor(300);
    
    // Force render to ensure lines are rendered
    el.renderViewport();
    await waitFor(100);

    const linesContainer = el.shadowRoot.getElementById('linesContainer');
    const numbers = linesContainer.querySelectorAll('.json-number');
    expect(numbers.length).to.be.greaterThan(0);
  });
});

describe('GeoJsonEditor - Theme Support', () => {

  it('should apply dark theme via dark-selector', async () => {
    const el = await fixture(html`<geojson-editor dark-selector=".dark-mode"></geojson-editor>`);
    
    const themeStyle = el.shadowRoot.getElementById('theme-styles');
    expect(themeStyle).to.exist;
    expect(themeStyle.textContent).to.include('.dark-mode');
  });

  it('should update theme via setTheme()', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    
    el.setTheme({
      dark: { bgColor: '#000000' }
    });

    const themeStyle = el.shadowRoot.getElementById('theme-styles');
    expect(themeStyle.textContent).to.include('#000000');
  });

  it('should reset theme via resetTheme()', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    
    el.setTheme({
      dark: { bgColor: '#000000' }
    });
    el.resetTheme();

    const themeStyle = el.shadowRoot.getElementById('theme-styles');
    expect(themeStyle.textContent).to.include('#2b2b2b'); // Default dark bg
  });
});

describe('GeoJsonEditor - Color Indicators', () => {

  it('should show color class for color properties', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPolygon]); // Has color: '#ff5733'
    await waitFor(200);

    const colorSpans = el.shadowRoot.querySelectorAll('.json-color');
    expect(colorSpans.length).to.be.greaterThan(0);
  });

  it('should have correct color in CSS variable', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPolygon]); // Has color: '#ff5733'
    await waitFor(200);

    const colorSpan = el.shadowRoot.querySelector('.json-color');
    expect(colorSpan.style.getPropertyValue('--swatch-color')).to.include('#ff5733');
  });
});

describe('GeoJsonEditor - Boolean Checkboxes', () => {

  it('should show boolean class for boolean properties', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    const featureWithBool = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { visible: true }
    };
    el.set([featureWithBool]);
    await waitFor(200);

    const booleanSpans = el.shadowRoot.querySelectorAll('.json-boolean');
    expect(booleanSpans.length).to.be.greaterThan(0);
  });
});

describe('GeoJsonEditor - Gutter Line Numbers', () => {

  it('should display line numbers in gutter', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    const lineNumbers = el.shadowRoot.querySelectorAll('.line-number');
    expect(lineNumbers.length).to.be.greaterThan(0);
  });
});

describe('GeoJsonEditor - Cursor and Selection', () => {

  it('should have cursor position properties', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    
    expect(el.cursorLine).to.be.a('number');
    expect(el.cursorColumn).to.be.a('number');
  });

  it('should have selection properties', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    
    expect(el.selectionStart).to.satisfy(v => v === null || typeof v === 'object');
    expect(el.selectionEnd).to.satisfy(v => v === null || typeof v === 'object');
  });
});

describe('GeoJsonEditor - Hidden Textarea', () => {

  it('should have hidden textarea for input capture', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    const textarea = el.shadowRoot.querySelector('.hidden-textarea');

    expect(textarea).to.exist;
    expect(textarea.id).to.equal('hiddenTextarea');
  });

  it('should have correct textarea attributes', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    const textarea = el.shadowRoot.querySelector('.hidden-textarea');

    expect(textarea.getAttribute('spellcheck')).to.equal('false');
    expect(textarea.getAttribute('autocomplete')).to.equal('off');
    expect(textarea.getAttribute('autocorrect')).to.equal('off');
  });
});

describe('GeoJsonEditor - Viewport', () => {

  it('should have viewport for content display', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    const viewport = el.shadowRoot.getElementById('viewport');

    expect(viewport).to.exist;
    expect(viewport.classList.contains('viewport')).to.be.true;
  });

  it('should have scroll content container', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    const scrollContent = el.shadowRoot.getElementById('scrollContent');

    expect(scrollContent).to.exist;
  });

  it('should have lines container', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    const linesContainer = el.shadowRoot.getElementById('linesContainer');

    expect(linesContainer).to.exist;
  });
});

describe('GeoJsonEditor - GeoJSON Validation', () => {

  it('should validate GeoJSON structure', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    // _validateGeoJSON should exist
    expect(el._validateGeoJSON).to.be.a('function');
  });

  it('should detect invalid geometry types', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    const parsed = {
      features: [{
        type: 'Feature',
        geometry: { type: 'InvalidType', coordinates: [0, 0] },
        properties: {}
      }]
    };

    const errors = el._validateGeoJSON(parsed);
    expect(errors.length).to.be.greaterThan(0);
  });
});

describe('GeoJsonEditor - Feature Visibility', () => {

  it('should track hidden features', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    
    expect(el.hiddenFeatures).to.be.instanceOf(Set);
  });

  it('should have visibility indicator for features', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    el.set([validPoint]);
    await waitFor(300);

    const visibilityLines = el.shadowRoot.querySelectorAll('.line.has-visibility');
    expect(visibilityLines.length).to.be.greaterThan(0);
  });
});
