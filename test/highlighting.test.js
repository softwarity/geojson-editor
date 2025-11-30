import { expect, fixture, html } from '@open-wc/testing';
import GeoJsonEditor from '../src/geojson-editor.ts';

// Helper to wait for component to stabilize
const waitFor = (ms = 100) => new Promise(r => setTimeout(r, ms));

// Create a fixture with explicit size for viewport rendering tests
const createSizedFixture = async (attributes = '') => {
  return await fixture(html`<geojson-editor style="height: 400px; width: 600px;" ${attributes}></geojson-editor>`);
};
import {
  validPoint,
  validPolygon
} from './fixtures/geojson-samples.js';

describe('GeoJsonEditor - Syntax Highlighting', () => {

  it('should render lines in viewport', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    const linesContainer = el.shadowRoot.getElementById('linesContainer');
    const lines = linesContainer.querySelectorAll('.line');
    expect(lines.length).to.be.greaterThan(0);
  });

  it('should highlight JSON keys', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    const linesContainer = el.shadowRoot.getElementById('linesContainer');
    const keys = linesContainer.querySelectorAll('.json-key, .geojson-key');
    expect(keys.length).to.be.greaterThan(0);
  });

  it('should highlight JSON strings', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    const linesContainer = el.shadowRoot.getElementById('linesContainer');
    const strings = linesContainer.querySelectorAll('.json-string, .geojson-type');
    expect(strings.length).to.be.greaterThan(0);
  });

  it('should highlight JSON numbers', async () => {
    const el = await createSizedFixture();
    await waitFor();

    const featureWithNumber = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { count: 42 }
    };
    el.set([featureWithNumber]);
    await waitFor(300);
    
    el.renderViewport();
    await waitFor(100);

    const linesContainer = el.shadowRoot.getElementById('linesContainer');
    const numbers = linesContainer.querySelectorAll('.json-number');
    expect(numbers.length).to.be.greaterThan(0);
  });

  it('should highlight JSON booleans', async () => {
    const el = await createSizedFixture();
    await waitFor();

    const featureWithBool = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { visible: true }
    };
    el.set([featureWithBool]);
    await waitFor(200);

    const linesContainer = el.shadowRoot.getElementById('linesContainer');
    const booleans = linesContainer.querySelectorAll('.json-boolean');
    expect(booleans.length).to.be.greaterThan(0);
  });

  it('should highlight JSON null', async () => {
    const el = await createSizedFixture();
    await waitFor();

    const featureWithNull = {
      type: 'Feature',
      geometry: null,
      properties: { value: null }
    };
    el.set([featureWithNull]);
    await waitFor(200);

    const linesContainer = el.shadowRoot.getElementById('linesContainer');
    const nulls = linesContainer.querySelectorAll('.json-null');
    expect(nulls.length).to.be.greaterThan(0);
  });

  it('should highlight JSON punctuation', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    const linesContainer = el.shadowRoot.getElementById('linesContainer');
    const punctuation = linesContainer.querySelectorAll('.json-punctuation');
    expect(punctuation.length).to.be.greaterThan(0);
  });

  it('should highlight GeoJSON type values', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    const linesContainer = el.shadowRoot.getElementById('linesContainer');
    const types = linesContainer.querySelectorAll('.geojson-type');
    expect(types.length).to.be.greaterThan(0);
  });

  it('should highlight GeoJSON keys', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    const linesContainer = el.shadowRoot.getElementById('linesContainer');
    const geoKeys = linesContainer.querySelectorAll('.geojson-key');
    expect(geoKeys.length).to.be.greaterThan(0);
  });

  it('should highlight line content via highlightSyntax function', async () => {
    // Import the extracted highlightSyntax function
    const { highlightSyntax } = await import('../src/syntax-highlighter.ts');

    const result = highlightSyntax('"type": "Feature",', 'Feature', undefined);

    expect(result).to.include('span');
    expect(result).to.include('class=');
  });
});

describe('GeoJsonEditor - Color Indicators', () => {

  it('should show color class for color properties', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon]); // Has color: '#ff5733'
    await waitFor(200);

    const colorSpans = el.shadowRoot.querySelectorAll('.json-color');
    expect(colorSpans.length).to.be.greaterThan(0);
  });

  it('should have correct color in CSS variable', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon]); // Has color: '#ff5733'
    await waitFor(200);

    const colorSpan = el.shadowRoot.querySelector('.json-color');
    expect(colorSpan.style.getPropertyValue('--swatch-color')).to.include('#ff5733');
  });

  it('should detect hex color pattern', async () => {
    const el = await createSizedFixture();
    await waitFor();

    const featureWithColors = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { 
        fill: '#123456',
        stroke: '#abcdef'
      }
    };
    el.set([featureWithColors]);
    await waitFor(200);

    const colorSpans = el.shadowRoot.querySelectorAll('.json-color');
    expect(colorSpans.length).to.be.greaterThanOrEqual(2);
  });

  it('should normalize 3-digit hex color to 6-digit for color picker', async () => {
    const el = await createSizedFixture();
    await waitFor();

    const featureWith3DigitColor = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { color: '#abc' }
    };
    el.set([featureWith3DigitColor]);
    await waitFor(200);

    // Find the color span
    const colorSpan = el.shadowRoot.querySelector('.json-color');
    expect(colorSpan).to.exist;

    // Mock the color input creation to capture the normalized value
    let capturedInputValue = null;
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = (tag) => {
      const elem = originalCreateElement(tag);
      if (tag === 'input') {
        const originalValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        Object.defineProperty(elem, 'value', {
          set: function(val) {
            capturedInputValue = val;
            originalValueSetter.call(this, val);
          },
          get: function() {
            return originalValueSetter ? this.getAttribute('value') || '' : '';
          }
        });
      }
      return elem;
    };

    // Simulate opening the color picker
    el.showColorPicker(colorSpan, 0, '#abc', 'color');
    await waitFor(100);

    // Verify the color was normalized from #abc to #aabbcc
    expect(capturedInputValue).to.equal('#aabbcc');

    document.createElement = originalCreateElement;
  });

  it('should keep 6-digit hex color unchanged for color picker', async () => {
    const el = await createSizedFixture();
    await waitFor();

    const featureWith6DigitColor = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { color: '#ff5733' }
    };
    el.set([featureWith6DigitColor]);
    await waitFor(200);

    // Find the color span
    const colorSpan = el.shadowRoot.querySelector('.json-color');
    expect(colorSpan).to.exist;

    // Mock the color input creation to capture the value
    let capturedInputValue = null;
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = (tag) => {
      const elem = originalCreateElement(tag);
      if (tag === 'input') {
        const originalValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        Object.defineProperty(elem, 'value', {
          set: function(val) {
            capturedInputValue = val;
            originalValueSetter.call(this, val);
          },
          get: function() {
            return originalValueSetter ? this.getAttribute('value') || '' : '';
          }
        });
      }
      return elem;
    };

    // Simulate opening the color picker
    el.showColorPicker(colorSpan, 0, '#ff5733', 'color');
    await waitFor(100);

    // Verify the color stays as #ff5733
    expect(capturedInputValue).to.equal('#ff5733');

    document.createElement = originalCreateElement;
  });
});

describe('GeoJsonEditor - Boolean Checkboxes', () => {

  it('should show boolean class for boolean properties', async () => {
    const el = await createSizedFixture();
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

  it('should add json-bool-true class for true values', async () => {
    const el = await createSizedFixture();
    await waitFor();

    const featureWithBool = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { visible: true }
    };
    el.set([featureWithBool]);
    await waitFor(200);

    const trueSpans = el.shadowRoot.querySelectorAll('.json-bool-true');
    expect(trueSpans.length).to.be.greaterThan(0);
  });

  it('should add json-bool-false class for false values', async () => {
    const el = await createSizedFixture();
    await waitFor();

    const featureWithBool = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { hidden: false }
    };
    el.set([featureWithBool]);
    await waitFor(200);

    const falseSpans = el.shadowRoot.querySelectorAll('.json-bool-false');
    expect(falseSpans.length).to.be.greaterThan(0);
  });

  it('should have updateBooleanValue method', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    
    expect(el.updateBooleanValue).to.be.a('function');
  });
});

describe('GeoJsonEditor - Error Highlighting', () => {

  it('should show error class for invalid JSON', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set invalid JSON manually
    el.lines = ['{ invalid json }'];
    el.updateView();
    el.renderViewport();
    await waitFor(100);

    const linesContainer = el.shadowRoot.getElementById('linesContainer');
    const errors = linesContainer.querySelectorAll('.json-error');
    expect(errors.length).to.be.greaterThan(0);
  });
});

describe('GeoJsonEditor - Gutter Line Numbers', () => {

  it('should display line numbers in gutter', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    const lineNumbers = el.shadowRoot.querySelectorAll('.line-number');
    expect(lineNumbers.length).to.be.greaterThan(0);
  });

  it('should have correct line numbers', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    const lineNumbers = el.shadowRoot.querySelectorAll('.line-number');
    expect(lineNumbers[0].textContent).to.equal('1');
  });

  it('should have collapse buttons in gutter', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon]);
    await waitFor(200);

    const collapseButtons = el.shadowRoot.querySelectorAll('.collapse-button');
    expect(collapseButtons.length).to.be.greaterThan(0);
  });
});
