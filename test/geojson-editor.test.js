import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import '../src/geojson-editor.js';
import {
  validPointStr,
  validPolygonStr,
  invalidJson,
  complexFeatureStr
} from './fixtures/geojson-samples.js';

describe('GeoJsonEditor - Basic Rendering', () => {

  it('should render with default state', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    expect(el.shadowRoot).to.exist;
    expect(el.shadowRoot.querySelector('textarea')).to.exist;
    expect(el.shadowRoot.querySelector('.highlight-layer')).to.exist;
    expect(el.shadowRoot.querySelector('.placeholder-layer')).to.exist;
    expect(el.shadowRoot.querySelector('.gutter')).to.exist;
  });

  it('should have empty textarea by default', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    const textarea = el.shadowRoot.querySelector('textarea');

    expect(textarea.value).to.equal('');
  });

  it('should apply default dimensions', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    // Host should have default height
    const styles = getComputedStyle(el);
    expect(styles.display).to.equal('flex');
  });
});

describe('GeoJsonEditor - Value Attribute', () => {

  it('should initialize with value attribute in HTML', async () => {
    const el = await fixture(html`
      <geojson-editor value='${validPointStr}'></geojson-editor>
    `);
    const textarea = el.shadowRoot.querySelector('textarea');

    expect(textarea.value).to.include('Feature');
    expect(textarea.value).to.include('Point');
  });

  it('should update textarea when value attribute changes', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    const textarea = el.shadowRoot.querySelector('textarea');

    expect(textarea.value).to.equal('');

    el.setAttribute('value', validPointStr);

    expect(textarea.value).to.include('Feature');
  });

  it('should handle empty value attribute', async () => {
    const el = await fixture(html`<geojson-editor value=""></geojson-editor>`);
    const textarea = el.shadowRoot.querySelector('textarea');

    expect(textarea.value).to.equal('');
  });
});

describe('GeoJsonEditor - Readonly Attribute', () => {

  it('should disable textarea when readonly', async () => {
    const el = await fixture(html`<geojson-editor readonly></geojson-editor>`);
    const textarea = el.shadowRoot.querySelector('textarea');

    expect(textarea.disabled).to.be.true;
  });

  it('should enable textarea when readonly is removed', async () => {
    const el = await fixture(html`<geojson-editor readonly></geojson-editor>`);
    const textarea = el.shadowRoot.querySelector('textarea');

    expect(textarea.disabled).to.be.true;

    el.removeAttribute('readonly');

    expect(textarea.disabled).to.be.false;
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
    await new Promise(r => setTimeout(r, 100));

    // Add some content
    el.set([
      { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} }
    ]);

    await new Promise(r => setTimeout(r, 100));
    expect(el.getAll().length).to.equal(1);

    // Click clear button
    const clearBtn = el.shadowRoot.getElementById('clearBtn');
    clearBtn.click();

    await new Promise(r => setTimeout(r, 100));
    expect(el.getAll().length).to.equal(0);
  });

  it('should emit empty FeatureCollection after clear', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await new Promise(r => setTimeout(r, 100));

    // Add some content
    el.set([
      { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} }
    ]);
    await new Promise(r => setTimeout(r, 100));

    let changeEvent = null;
    el.addEventListener('change', (e) => { changeEvent = e; });

    // Click clear button
    const clearBtn = el.shadowRoot.getElementById('clearBtn');
    clearBtn.click();

    await new Promise(r => setTimeout(r, 100));
    expect(changeEvent).to.exist;
    // Verify complete FeatureCollection structure
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
    const textarea = el.shadowRoot.querySelector('textarea');
    const placeholder = el.shadowRoot.querySelector('.placeholder-layer');

    textarea.value = '{"type": "Point"}';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    expect(placeholder.style.display).to.equal('none');
  });

  it('should show placeholder after clearing content', async () => {
    const el = await fixture(html`
      <geojson-editor placeholder="Enter..."></geojson-editor>
    `);
    const textarea = el.shadowRoot.querySelector('textarea');
    const placeholder = el.shadowRoot.querySelector('.placeholder-layer');

    // Add content
    textarea.value = 'some content';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    expect(placeholder.style.display).to.equal('none');

    // Clear content
    textarea.value = '';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
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

describe('GeoJsonEditor - Formatting', () => {

  it('should always format JSON on input', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    const textarea = el.shadowRoot.querySelector('textarea');

    // Input minified JSON
    textarea.value = '{"type":"Feature","geometry":null,"properties":{}}';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    // Wait for debounce
    await new Promise(r => setTimeout(r, 200));

    // Should be formatted with indentation
    expect(textarea.value).to.include('\n');
  });
});

describe('GeoJsonEditor - Events', () => {

  it('should emit change event with valid GeoJSON wrapped in FeatureCollection', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    const textarea = el.shadowRoot.querySelector('textarea');

    setTimeout(() => {
      textarea.value = '{"type": "Feature", "geometry": null, "properties": {}}';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }, 0);

    const event = await oneEvent(el, 'change', false);

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
    const textarea = el.shadowRoot.querySelector('textarea');

    const errorPromise = new Promise(resolve => {
      el.addEventListener('error', (e) => {
        e.stopPropagation(); // Prevent test-runner from catching it
        resolve(e);
      }, { once: true });
    });

    textarea.value = invalidJson;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    const event = await errorPromise;

    expect(event.detail).to.exist;
    expect(event.detail.error).to.exist;
  });

  it('should emit error event with invalid GeoJSON type', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    const textarea = el.shadowRoot.querySelector('textarea');

    const errorPromise = new Promise(resolve => {
      el.addEventListener('error', (e) => {
        e.stopPropagation(); // Prevent test-runner from catching it
        resolve(e);
      }, { once: true });
    });

    textarea.value = '{"type": "InvalidType", "geometry": null, "properties": {}}';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    const event = await errorPromise;

    expect(event.detail.errors).to.exist;
    expect(event.detail.errors.length).to.be.greaterThan(0);
  });
});

describe('GeoJsonEditor - Theme API', () => {

  it('should have default theme variables as CSS fallbacks', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    // Default values are now CSS fallbacks with IntelliJ Light colors
    const allStyles = el.shadowRoot.querySelectorAll('style');
    const mainStyle = Array.from(allStyles).find(s => s.id !== 'theme-styles');
    expect(mainStyle).to.exist;
    // Check for CSS variable patterns (colors can be shorthand like #fff or full like #ffffff)
    expect(mainStyle.textContent).to.include('var(--bg-color,');
    expect(mainStyle.textContent).to.include('var(--text-color,');
    expect(mainStyle.textContent).to.include('var(--json-key, #660e7a)');
  });

  it('should allow theme customization via setTheme()', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    el.setTheme({
      dark: { controlColor: '#ff0000' }
    });

    // Theme override should be stored
    expect(el.themes.dark.controlColor).to.equal('#ff0000');

    // CSS should include the override
    const themeStyle = el.shadowRoot.querySelector('#theme-styles');
    expect(themeStyle.textContent).to.include('--control-color: #ff0000');
  });

  it('should reset theme via resetTheme()', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    el.setTheme({
      dark: { bgColor: '#000000' }
    });

    expect(el.themes.dark.bgColor).to.equal('#000000');

    el.resetTheme();

    // Themes should be empty after reset (uses CSS defaults)
    expect(el.themes.dark).to.deep.equal({});
    expect(el.themes.light).to.deep.equal({});
  });
});

describe('GeoJsonEditor - FeatureCollection Output', () => {

  it('should show prefix/suffix with FeatureCollection wrapper', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    const prefix = el.shadowRoot.querySelector('#editorPrefix');
    const suffix = el.shadowRoot.querySelector('#editorSuffix');

    expect(prefix.textContent).to.include('FeatureCollection');
    expect(suffix.textContent).to.include(']}');
  });

  it('should have prefix and suffix gutters', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    const prefixGutter = el.shadowRoot.querySelector('.prefix-gutter');
    const suffixGutter = el.shadowRoot.querySelector('.suffix-gutter');

    expect(prefixGutter).to.exist;
    expect(suffixGutter).to.exist;
  });

  it('should wrap content in FeatureCollection for change event', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    const textarea = el.shadowRoot.querySelector('textarea');

    setTimeout(() => {
      textarea.value = '{"type": "Feature", "geometry": null, "properties": {}}';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }, 0);

    const event = await oneEvent(el, 'change', false);

    expect(event.detail.type).to.equal('FeatureCollection');
    expect(event.detail.features).to.be.an('array');
    expect(event.detail.features).to.have.lengthOf(1);
  });
});

describe('GeoJsonEditor - Syntax Highlighting', () => {

  it('should highlight JSON in highlight layer', async () => {
    const el = await fixture(html`
      <geojson-editor value='${validPointStr}'></geojson-editor>
    `);

    const highlightLayer = el.shadowRoot.querySelector('.highlight-layer');

    // Should contain highlighted spans
    expect(highlightLayer.innerHTML).to.include('class="');
    expect(highlightLayer.innerHTML).to.include('geojson-key');
  });

  it('should highlight GeoJSON types distinctly', async () => {
    const el = await fixture(html`
      <geojson-editor value='${validPointStr}'></geojson-editor>
    `);

    const highlightLayer = el.shadowRoot.querySelector('.highlight-layer');

    expect(highlightLayer.innerHTML).to.include('geojson-type');
  });

  it('should mark invalid geometry types with error styling', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    const textarea = el.shadowRoot.querySelector('textarea');

    // Capture error event to prevent test-runner from catching it
    const errorPromise = new Promise(resolve => {
      el.addEventListener('error', (e) => {
        e.stopPropagation();
        resolve(e);
      }, { once: true });
    });

    // Use a Feature with invalid geometry type - formatted on multiple lines
    // LinearRing is not a valid GeoJSON type
    const invalidGeojson = JSON.stringify({
      type: 'Feature',
      geometry: {
        type: 'LinearRing',
        coordinates: []
      },
      properties: {}
    }, null, 2);

    textarea.value = invalidGeojson;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    // Wait for error event to be emitted
    await errorPromise;

    const highlightLayer = el.shadowRoot.querySelector('.highlight-layer');
    expect(highlightLayer.innerHTML).to.include('geojson-type-invalid');
  });
});

describe('GeoJsonEditor - Collapsible Nodes', () => {

  it('should auto-collapse coordinates on load', async () => {
    const el = await fixture(html`
      <geojson-editor value='${validPolygonStr}'></geojson-editor>
    `);

    // Wait for auto-collapse
    await new Promise(r => setTimeout(r, 100));

    const textarea = el.shadowRoot.querySelector('textarea');

    // Should have collapsed marker
    expect(textarea.value).to.include('[...]');
  });

  it('should show collapse buttons in gutter', async () => {
    const el = await fixture(html`
      <geojson-editor value='${complexFeatureStr}'></geojson-editor>
    `);

    await new Promise(r => setTimeout(r, 100));

    const gutter = el.shadowRoot.querySelector('.gutter-content');
    const buttons = gutter.querySelectorAll('.collapse-button');

    expect(buttons.length).to.be.greaterThan(0);
  });

  it('should expand collapsed node when clicking collapse button', async () => {
    const el = await fixture(html`
      <geojson-editor value='${validPolygonStr}'></geojson-editor>
    `);

    // Wait for auto-collapse
    await new Promise(r => setTimeout(r, 100));

    const textarea = el.shadowRoot.querySelector('textarea');

    // Verify it's collapsed
    expect(textarea.value).to.include('[...]');

    // Find the collapse button for coordinates (should show '+' when collapsed)
    const gutter = el.shadowRoot.querySelector('.gutter-content');
    const collapseButtons = gutter.querySelectorAll('.collapse-button');

    // Find the button that expands (has '+' sign - meaning it's collapsed)
    let expandButton = null;
    for (const btn of collapseButtons) {
      if (btn.textContent === '+') {
        expandButton = btn;
        break;
      }
    }

    expect(expandButton).to.exist;

    // Click to expand
    expandButton.click();

    // Wait for update
    await new Promise(r => setTimeout(r, 50));

    // Should no longer have the collapsed marker for that node
    // The coordinates should now be visible (100 or 100.0 depending on JSON formatting)
    expect(textarea.value).to.not.include('[...]');
    expect(textarea.value).to.match(/100/); // Coordinates visible
  });

  it('should collapse expanded node when clicking collapse button', async () => {
    // Use a feature without auto-collapse to test manual collapse
    const simpleFeature = JSON.stringify({
      type: 'Feature',
      geometry: null,
      properties: {
        nested: {
          value: 'test'
        }
      }
    }, null, 2);

    const el = await fixture(html`
      <geojson-editor value='${simpleFeature}'></geojson-editor>
    `);

    await new Promise(r => setTimeout(r, 100));

    const textarea = el.shadowRoot.querySelector('textarea');
    const gutter = el.shadowRoot.querySelector('.gutter-content');

    // Find a collapse button (should show '-' when expanded)
    const collapseButtons = gutter.querySelectorAll('.collapse-button');
    let collapseButton = null;
    for (const btn of collapseButtons) {
      if (btn.textContent === '-') {
        collapseButton = btn;
        break;
      }
    }

    expect(collapseButton).to.exist;

    // Verify content is expanded (nested object visible)
    expect(textarea.value).to.include('"value": "test"');

    // Click to collapse
    collapseButton.click();

    // Wait for update
    await new Promise(r => setTimeout(r, 50));

    // Should have collapsed marker
    expect(textarea.value).to.include('{...}');
  });

  it('should auto-collapse coordinates when pasting valid GeoJSON', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    const textarea = el.shadowRoot.querySelector('textarea');

    // GeoJSON with coordinates to paste
    const geojsonToPaste = JSON.stringify({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
      },
      properties: {}
    }, null, 2);

    // Set value and simulate paste event (paste handler triggers auto-collapse)
    textarea.value = geojsonToPaste;
    textarea.dispatchEvent(new Event('paste', { bubbles: true }));

    // Wait for paste handler (10ms delay) + auto-collapse
    await new Promise(r => setTimeout(r, 100));

    // Coordinates should be auto-collapsed
    expect(textarea.value).to.include('[...]');
  });
});

describe('GeoJsonEditor - Color Picker', () => {

  it('should show color indicator for color properties', async () => {
    const el = await fixture(html`
      <geojson-editor value='${validPolygonStr}'></geojson-editor>
    `);

    await new Promise(r => setTimeout(r, 100));

    const gutter = el.shadowRoot.querySelector('.gutter-content');
    const colorIndicators = gutter.querySelectorAll('.color-indicator');

    // validPolygon has color: '#ff5733' in properties
    expect(colorIndicators.length).to.be.greaterThan(0);
  });

  it('should display color indicator with correct background color', async () => {
    const el = await fixture(html`
      <geojson-editor value='${validPolygonStr}'></geojson-editor>
    `);

    await new Promise(r => setTimeout(r, 100));

    const gutter = el.shadowRoot.querySelector('.gutter-content');
    const colorIndicator = gutter.querySelector('.color-indicator');

    expect(colorIndicator).to.exist;
    // validPolygon has color: '#ff5733'
    expect(colorIndicator.style.backgroundColor).to.equal('rgb(255, 87, 51)');
    expect(colorIndicator.dataset.color).to.equal('#ff5733');
    expect(colorIndicator.dataset.attributeName).to.equal('color');
  });

  it('should update color value when color picker changes', async () => {
    const el = await fixture(html`
      <geojson-editor value='${validPolygonStr}'></geojson-editor>
    `);

    await new Promise(r => setTimeout(r, 100));

    const textarea = el.shadowRoot.querySelector('textarea');
    const gutter = el.shadowRoot.querySelector('.gutter-content');
    const colorIndicator = gutter.querySelector('.color-indicator');

    expect(colorIndicator).to.exist;

    // Get the line number from the indicator
    const line = parseInt(colorIndicator.dataset.line);

    // Directly call the updateColorValue method (simulating color picker change)
    el.updateColorValue(line, '#00ff00', 'color');

    // Wait for update
    await new Promise(r => setTimeout(r, 50));

    // The textarea should now have the new color
    expect(textarea.value).to.include('#00ff00');
    expect(textarea.value).to.not.include('#ff5733');
  });

  it('should emit change event after color change', async () => {
    const el = await fixture(html`
      <geojson-editor value='${validPolygonStr}'></geojson-editor>
    `);

    await new Promise(r => setTimeout(r, 100));

    const gutter = el.shadowRoot.querySelector('.gutter-content');
    const colorIndicator = gutter.querySelector('.color-indicator');
    const line = parseInt(colorIndicator.dataset.line);

    // Listen for change event
    const changePromise = new Promise(resolve => {
      el.addEventListener('change', resolve, { once: true });
    });

    // Change the color
    el.updateColorValue(line, '#0000ff', 'color');

    const event = await changePromise;

    // The event should contain the updated GeoJSON (wrapped in FeatureCollection)
    expect(event.detail.type).to.equal('FeatureCollection');
    expect(event.detail.features[0].properties.color).to.equal('#0000ff');
  });

  it('should detect color properties with hyphenated names (fill-color)', async () => {
    const featureWithHyphenatedColor = JSON.stringify({
      type: "Feature",
      geometry: { type: "Point", coordinates: [0, 0] },
      properties: { "fill-color": "#3498db" }
    });

    const el = await fixture(html`
      <geojson-editor value='${featureWithHyphenatedColor}'></geojson-editor>
    `);

    await new Promise(r => setTimeout(r, 100));

    const gutter = el.shadowRoot.querySelector('.gutter-content');
    const colorIndicators = gutter.querySelectorAll('.color-indicator');

    expect(colorIndicators.length).to.equal(1);
    expect(colorIndicators[0].dataset.attributeName).to.equal('fill-color');
    expect(colorIndicators[0].dataset.color).to.equal('#3498db');
  });

  it('should detect multiple hyphenated color properties', async () => {
    const featureWithMultipleColors = JSON.stringify({
      type: "Feature",
      geometry: { type: "Point", coordinates: [0, 0] },
      properties: {
        "fill-color": "#2ecc71",
        "stroke-color": "#27ae60"
      }
    });

    const el = await fixture(html`
      <geojson-editor value='${featureWithMultipleColors}'></geojson-editor>
    `);

    await new Promise(r => setTimeout(r, 100));

    const gutter = el.shadowRoot.querySelector('.gutter-content');
    const colorIndicators = gutter.querySelectorAll('.color-indicator');

    expect(colorIndicators.length).to.equal(2);

    const attributeNames = Array.from(colorIndicators).map(i => i.dataset.attributeName);
    expect(attributeNames).to.include('fill-color');
    expect(attributeNames).to.include('stroke-color');
  });

  it('should update hyphenated color property value', async () => {
    const featureWithHyphenatedColor = JSON.stringify({
      type: "Feature",
      geometry: { type: "Point", coordinates: [0, 0] },
      properties: { "stroke-color": "#e74c3c" }
    });

    const el = await fixture(html`
      <geojson-editor value='${featureWithHyphenatedColor}'></geojson-editor>
    `);

    await new Promise(r => setTimeout(r, 100));

    const textarea = el.shadowRoot.querySelector('textarea');
    const gutter = el.shadowRoot.querySelector('.gutter-content');
    const colorIndicator = gutter.querySelector('.color-indicator');

    expect(colorIndicator).to.exist;
    expect(colorIndicator.dataset.attributeName).to.equal('stroke-color');

    const line = parseInt(colorIndicator.dataset.line);
    el.updateColorValue(line, '#9b59b6', 'stroke-color');

    await new Promise(r => setTimeout(r, 50));

    expect(textarea.value).to.include('#9b59b6');
    expect(textarea.value).to.not.include('#e74c3c');
  });

  it('should detect shorthand hex colors (#rgb format)', async () => {
    const featureWithShortColor = JSON.stringify({
      type: "Feature",
      geometry: { type: "Point", coordinates: [0, 0] },
      properties: { "fill-color": "#f00" }
    });

    const el = await fixture(html`
      <geojson-editor value='${featureWithShortColor}'></geojson-editor>
    `);

    await new Promise(r => setTimeout(r, 100));

    const gutter = el.shadowRoot.querySelector('.gutter-content');
    const colorIndicators = gutter.querySelectorAll('.color-indicator');

    expect(colorIndicators.length).to.equal(1);
    expect(colorIndicators[0].dataset.attributeName).to.equal('fill-color');
    expect(colorIndicators[0].dataset.color).to.equal('#f00');
  });

  it('should detect all valid hex color formats', async () => {
    const featureWithMultipleColorFormats = JSON.stringify({
      type: "Feature",
      geometry: { type: "Point", coordinates: [0, 0] },
      properties: {
        "color-1": "#000",
        "color-2": "#fff",
        "color-3": "#abc",
        "color-4": "#000000",
        "color-5": "#ffffff",
        "color-6": "#abcdef"
      }
    });

    const el = await fixture(html`
      <geojson-editor value='${featureWithMultipleColorFormats}'></geojson-editor>
    `);

    await new Promise(r => setTimeout(r, 100));

    const gutter = el.shadowRoot.querySelector('.gutter-content');
    const colorIndicators = gutter.querySelectorAll('.color-indicator');

    expect(colorIndicators.length).to.equal(6);

    const colors = Array.from(colorIndicators).map(i => i.dataset.color);
    expect(colors).to.include('#000');
    expect(colors).to.include('#fff');
    expect(colors).to.include('#abc');
    expect(colors).to.include('#000000');
    expect(colors).to.include('#ffffff');
    expect(colors).to.include('#abcdef');
  });

  it('should update shorthand color value when color picker changes', async () => {
    const featureWithShortColor = JSON.stringify({
      type: "Feature",
      geometry: { type: "Point", coordinates: [0, 0] },
      properties: { "marker-color": "#f0f" }
    });

    const el = await fixture(html`
      <geojson-editor value='${featureWithShortColor}'></geojson-editor>
    `);

    await new Promise(r => setTimeout(r, 100));

    const textarea = el.shadowRoot.querySelector('textarea');
    const gutter = el.shadowRoot.querySelector('.gutter-content');
    const colorIndicator = gutter.querySelector('.color-indicator');

    expect(colorIndicator).to.exist;
    expect(colorIndicator.dataset.color).to.equal('#f0f');

    const line = parseInt(colorIndicator.dataset.line);
    el.updateColorValue(line, '#00ff00', 'marker-color');

    await new Promise(r => setTimeout(r, 50));

    expect(textarea.value).to.include('#00ff00');
    expect(textarea.value).to.not.include('#f0f');
  });

  it('should detect lowercase and uppercase hex colors', async () => {
    const featureWithMixedCase = JSON.stringify({
      type: "Feature",
      geometry: { type: "Point", coordinates: [0, 0] },
      properties: {
        "color-lower": "#aabbcc",
        "color-upper": "#AABBCC",
        "color-mixed": "#AaBbCc"
      }
    });

    const el = await fixture(html`
      <geojson-editor value='${featureWithMixedCase}'></geojson-editor>
    `);

    await new Promise(r => setTimeout(r, 100));

    const gutter = el.shadowRoot.querySelector('.gutter-content');
    const colorIndicators = gutter.querySelectorAll('.color-indicator');

    expect(colorIndicators.length).to.equal(3);

    const colors = Array.from(colorIndicators).map(i => i.dataset.color);
    expect(colors).to.include('#aabbcc');
    expect(colors).to.include('#AABBCC');
    expect(colors).to.include('#AaBbCc');
  });
});

describe('GeoJsonEditor - Boolean Checkbox', () => {

  it('should show checkbox for boolean properties', async () => {
    const featureWithBoolean = JSON.stringify({
      type: "Feature",
      geometry: { type: "Point", coordinates: [0, 0] },
      properties: { marker: true }
    });

    const el = await fixture(html`
      <geojson-editor value='${featureWithBoolean}'></geojson-editor>
    `);

    await new Promise(r => setTimeout(r, 100));

    const gutter = el.shadowRoot.querySelector('.gutter-content');
    const checkboxes = gutter.querySelectorAll('.boolean-checkbox');

    expect(checkboxes.length).to.equal(1);
    expect(checkboxes[0].checked).to.be.true;
    expect(checkboxes[0].dataset.attributeName).to.equal('marker');
  });

  it('should show unchecked checkbox for false boolean', async () => {
    const featureWithBoolean = JSON.stringify({
      type: "Feature",
      geometry: { type: "Point", coordinates: [0, 0] },
      properties: { visible: false }
    });

    const el = await fixture(html`
      <geojson-editor value='${featureWithBoolean}'></geojson-editor>
    `);

    await new Promise(r => setTimeout(r, 100));

    const gutter = el.shadowRoot.querySelector('.gutter-content');
    const checkbox = gutter.querySelector('.boolean-checkbox');

    expect(checkbox).to.exist;
    expect(checkbox.checked).to.be.false;
    expect(checkbox.dataset.attributeName).to.equal('visible');
  });

  it('should detect multiple boolean properties', async () => {
    const featureWithBooleans = JSON.stringify({
      type: "Feature",
      geometry: { type: "Point", coordinates: [0, 0] },
      properties: { marker: true, visible: false, active: true }
    });

    const el = await fixture(html`
      <geojson-editor value='${featureWithBooleans}'></geojson-editor>
    `);

    await new Promise(r => setTimeout(r, 100));

    const gutter = el.shadowRoot.querySelector('.gutter-content');
    const checkboxes = gutter.querySelectorAll('.boolean-checkbox');

    expect(checkboxes.length).to.equal(3);
    const attributeNames = Array.from(checkboxes).map(c => c.dataset.attributeName);
    expect(attributeNames).to.include('marker');
    expect(attributeNames).to.include('visible');
    expect(attributeNames).to.include('active');
  });

  it('should update boolean value when checkbox is toggled', async () => {
    const featureWithBoolean = JSON.stringify({
      type: "Feature",
      geometry: { type: "Point", coordinates: [0, 0] },
      properties: { marker: true }
    });

    const el = await fixture(html`
      <geojson-editor value='${featureWithBoolean}'></geojson-editor>
    `);

    await new Promise(r => setTimeout(r, 100));

    const textarea = el.shadowRoot.querySelector('textarea');
    const gutter = el.shadowRoot.querySelector('.gutter-content');
    const checkbox = gutter.querySelector('.boolean-checkbox');

    expect(checkbox).to.exist;
    expect(checkbox.checked).to.be.true;

    const line = parseInt(checkbox.dataset.line);

    // Toggle to false
    el.updateBooleanValue(line, false, 'marker');
    await new Promise(r => setTimeout(r, 50));

    expect(textarea.value).to.include('"marker": false');
    expect(textarea.value).to.not.include('"marker": true');
  });

  it('should emit change event after boolean toggle', async () => {
    const featureWithBoolean = JSON.stringify({
      type: "Feature",
      geometry: { type: "Point", coordinates: [0, 0] },
      properties: { marker: false }
    });

    const el = await fixture(html`
      <geojson-editor value='${featureWithBoolean}'></geojson-editor>
    `);

    await new Promise(r => setTimeout(r, 100));

    const gutter = el.shadowRoot.querySelector('.gutter-content');
    const checkbox = gutter.querySelector('.boolean-checkbox');
    const line = parseInt(checkbox.dataset.line);

    // Listen for change event
    const changePromise = new Promise(resolve => {
      el.addEventListener('change', resolve, { once: true });
    });

    // Toggle to true
    el.updateBooleanValue(line, true, 'marker');

    const event = await changePromise;

    expect(event.detail.type).to.equal('FeatureCollection');
    expect(event.detail.features[0].properties.marker).to.equal(true);
  });

  it('should detect boolean properties with hyphenated names', async () => {
    const featureWithHyphenatedBoolean = JSON.stringify({
      type: "Feature",
      geometry: { type: "Point", coordinates: [0, 0] },
      properties: { "show-marker": true, "is-visible": false }
    });

    const el = await fixture(html`
      <geojson-editor value='${featureWithHyphenatedBoolean}'></geojson-editor>
    `);

    await new Promise(r => setTimeout(r, 100));

    const gutter = el.shadowRoot.querySelector('.gutter-content');
    const checkboxes = gutter.querySelectorAll('.boolean-checkbox');

    expect(checkboxes.length).to.equal(2);
    const attributeNames = Array.from(checkboxes).map(c => c.dataset.attributeName);
    expect(attributeNames).to.include('show-marker');
    expect(attributeNames).to.include('is-visible');
  });

  it('should show both color indicator and checkbox for different properties', async () => {
    const featureWithColorAndBoolean = JSON.stringify({
      type: "Feature",
      geometry: { type: "Point", coordinates: [0, 0] },
      properties: { 
        color: "#ff5733",
        marker: true
      }
    });

    const el = await fixture(html`
      <geojson-editor value='${featureWithColorAndBoolean}'></geojson-editor>
    `);

    await new Promise(r => setTimeout(r, 100));

    const gutter = el.shadowRoot.querySelector('.gutter-content');
    const colorIndicators = gutter.querySelectorAll('.color-indicator');
    const checkboxes = gutter.querySelectorAll('.boolean-checkbox');

    // Each on different lines
    expect(colorIndicators.length).to.equal(1);
    expect(checkboxes.length).to.equal(1);
    expect(colorIndicators[0].dataset.attributeName).to.equal('color');
    expect(checkboxes[0].dataset.attributeName).to.equal('marker');
  });
});

describe('GeoJsonEditor - Dark Selector', () => {

  it('should apply dark theme when selector matches', async () => {
    const el = await fixture(html`
      <geojson-editor class="dark" dark-selector=".dark"></geojson-editor>
    `);

    // Set a dark theme override to generate CSS
    el.setTheme({ dark: { bgColor: '#111111' } });

    // Theme CSS should be injected with the dark selector
    const themeStyle = el.shadowRoot.querySelector('#theme-styles');
    expect(themeStyle).to.exist;
    expect(themeStyle.textContent).to.include('--bg-color');
    expect(themeStyle.textContent).to.include(':host(.dark)');
  });

  it('should update theme when dark-selector changes', async () => {
    const el = await fixture(html`
      <geojson-editor dark-selector=".dark"></geojson-editor>
    `);

    // Set a dark theme override to generate CSS
    el.setTheme({ dark: { bgColor: '#222222' } });

    el.setAttribute('dark-selector', '.night-mode');

    const themeStyle = el.shadowRoot.querySelector('#theme-styles');
    expect(themeStyle.textContent).to.include('.night-mode');
  });
});

describe('GeoJsonEditor - Feature Visibility', () => {

  // Features are edited directly, component wraps them in FeatureCollection
  const feature1 = {
    type: 'Feature',
    id: 'feature-1',
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: { name: 'First' }
  };
  const feature2 = {
    type: 'Feature',
    id: 'feature-2',
    geometry: { type: 'Point', coordinates: [1, 1] },
    properties: { name: 'Second' }
  };
  // Comma-separated features as the component expects in FeatureCollection mode
  const featuresStr = JSON.stringify(feature1, null, 2) + ',\n' + JSON.stringify(feature2, null, 2);

  it('should show visibility buttons for Features', async () => {
    const el = await fixture(html`
      <geojson-editor value='${featuresStr}'></geojson-editor>
    `);

    await new Promise(r => setTimeout(r, 150));

    const gutter = el.shadowRoot.querySelector('.gutter-content');
    const visibilityButtons = gutter.querySelectorAll('.visibility-button');

    // Should have 2 visibility buttons (one per feature)
    expect(visibilityButtons.length).to.equal(2);
  });

  it('should toggle feature visibility on button click', async () => {
    const el = await fixture(html`
      <geojson-editor value='${featuresStr}'></geojson-editor>
    `);

    await new Promise(r => setTimeout(r, 150));

    const gutter = el.shadowRoot.querySelector('.gutter-content');
    const visibilityButton = gutter.querySelector('.visibility-button');

    expect(visibilityButton).to.exist;
    expect(visibilityButton.classList.contains('hidden')).to.be.false;

    // Click to hide
    visibilityButton.click();
    await new Promise(r => setTimeout(r, 50));

    // Button should now have 'hidden' class
    const updatedButton = gutter.querySelector('.visibility-button');
    expect(updatedButton.classList.contains('hidden')).to.be.true;
  });

  it('should gray out hidden feature lines', async () => {
    const el = await fixture(html`
      <geojson-editor value='${featuresStr}'></geojson-editor>
    `);

    await new Promise(r => setTimeout(r, 150));

    const gutter = el.shadowRoot.querySelector('.gutter-content');
    const visibilityButton = gutter.querySelector('.visibility-button');

    // Hide the first feature
    visibilityButton.click();
    await new Promise(r => setTimeout(r, 50));

    const highlightLayer = el.shadowRoot.querySelector('.highlight-layer');

    // Should have hidden lines
    expect(highlightLayer.innerHTML).to.include('line-hidden');
  });

  it('should exclude hidden features from change event', async () => {
    const el = await fixture(html`
      <geojson-editor value='${featuresStr}'></geojson-editor>
    `);

    await new Promise(r => setTimeout(r, 150));

    const gutter = el.shadowRoot.querySelector('.gutter-content');
    const visibilityButton = gutter.querySelector('.visibility-button');

    // Listen for change event
    const changePromise = new Promise(resolve => {
      el.addEventListener('change', resolve, { once: true });
    });

    // Hide the first feature (this triggers emitChange)
    visibilityButton.click();

    const event = await changePromise;

    // Event should only contain one feature (the second one)
    expect(event.detail.type).to.equal('FeatureCollection');
    expect(event.detail.features.length).to.equal(1);
    expect(event.detail.features[0].id).to.equal('feature-2');
  });

  it('should restore feature in event when made visible again', async () => {
    const el = await fixture(html`
      <geojson-editor value='${featuresStr}'></geojson-editor>
    `);

    await new Promise(r => setTimeout(r, 150));

    const gutter = el.shadowRoot.querySelector('.gutter-content');
    let visibilityButton = gutter.querySelector('.visibility-button');

    // Hide the first feature
    visibilityButton.click();
    await new Promise(r => setTimeout(r, 50));

    // Listen for change event
    const changePromise = new Promise(resolve => {
      el.addEventListener('change', resolve, { once: true });
    });

    // Show the feature again
    visibilityButton = gutter.querySelector('.visibility-button');
    visibilityButton.click();

    const event = await changePromise;

    // Event should contain both features again
    expect(event.detail.features.length).to.equal(2);
  });

  it('should generate feature key from id', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    const feature = { type: 'Feature', id: 'test-123', geometry: null, properties: {} };
    const key = el.getFeatureKey(feature);

    expect(key).to.equal('id:test-123');
  });

  it('should generate feature key from properties.id when no root id', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    const feature = { type: 'Feature', geometry: null, properties: { id: 'prop-456' } };
    const key = el.getFeatureKey(feature);

    expect(key).to.equal('prop:prop-456');
  });

  it('should generate feature key from geometry hash when no id', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    const feature = { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} };
    const key = el.getFeatureKey(feature);

    expect(key).to.include('hash:Point:');
  });
});

describe('GeoJsonEditor - Features API', () => {

  const feature1 = { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { name: 'First' } };
  const feature2 = { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] }, properties: { name: 'Second' } };
  const feature3 = { type: 'Feature', geometry: { type: 'Point', coordinates: [2, 2] }, properties: { name: 'Third' } };

  describe('set()', () => {
    it('should replace all features with the given array', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      el.set([feature1, feature2]);
      await new Promise(r => setTimeout(r, 50));

      const features = el.getAll();
      expect(features.length).to.equal(2);
      expect(features[0].properties.name).to.equal('First');
      expect(features[1].properties.name).to.equal('Second');
    });

    it('should emit change event after set()', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      const changePromise = new Promise(resolve => {
        el.addEventListener('change', resolve, { once: true });
      });

      el.set([feature1]);

      const event = await changePromise;
      expect(event.detail.type).to.equal('FeatureCollection');
      expect(event.detail.features.length).to.equal(1);
    });

    it('should clear features when set with empty array', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      el.set([feature1, feature2]);
      await new Promise(r => setTimeout(r, 50));
      expect(el.getAll().length).to.equal(2);

      el.set([]);
      await new Promise(r => setTimeout(r, 50));
      expect(el.getAll().length).to.equal(0);
    });
  });

  describe('add()', () => {
    it('should add a feature at the end', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      el.set([feature1]);
      await new Promise(r => setTimeout(r, 50));

      el.add(feature2);
      await new Promise(r => setTimeout(r, 50));

      const features = el.getAll();
      expect(features.length).to.equal(2);
      expect(features[1].properties.name).to.equal('Second');
    });

    it('should emit change event after add()', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      el.set([feature1]);
      await new Promise(r => setTimeout(r, 50));

      const changePromise = new Promise(resolve => {
        el.addEventListener('change', resolve, { once: true });
      });

      el.add(feature2);

      const event = await changePromise;
      expect(event.detail.features.length).to.equal(2);
    });
  });

  describe('insertAt()', () => {
    it('should insert a feature at the specified index', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      el.set([feature1, feature3]);
      await new Promise(r => setTimeout(r, 50));

      el.insertAt(feature2, 1);
      await new Promise(r => setTimeout(r, 50));

      const features = el.getAll();
      expect(features.length).to.equal(3);
      expect(features[0].properties.name).to.equal('First');
      expect(features[1].properties.name).to.equal('Second');
      expect(features[2].properties.name).to.equal('Third');
    });

    it('should handle negative index (from end)', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      el.set([feature1, feature3]);
      await new Promise(r => setTimeout(r, 50));

      el.insertAt(feature2, -1);
      await new Promise(r => setTimeout(r, 50));

      const features = el.getAll();
      expect(features.length).to.equal(3);
      expect(features[1].properties.name).to.equal('Second');
    });

    it('should insert at beginning with index 0', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      el.set([feature2]);
      await new Promise(r => setTimeout(r, 50));

      el.insertAt(feature1, 0);
      await new Promise(r => setTimeout(r, 50));

      const features = el.getAll();
      expect(features[0].properties.name).to.equal('First');
    });
  });

  describe('removeAt()', () => {
    it('should remove feature at the specified index', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      el.set([feature1, feature2, feature3]);
      await new Promise(r => setTimeout(r, 50));

      const removed = el.removeAt(1);
      await new Promise(r => setTimeout(r, 50));

      expect(removed.properties.name).to.equal('Second');
      const features = el.getAll();
      expect(features.length).to.equal(2);
      expect(features[0].properties.name).to.equal('First');
      expect(features[1].properties.name).to.equal('Third');
    });

    it('should handle negative index (from end)', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      el.set([feature1, feature2, feature3]);
      await new Promise(r => setTimeout(r, 50));

      const removed = el.removeAt(-1);
      await new Promise(r => setTimeout(r, 50));

      expect(removed.properties.name).to.equal('Third');
      expect(el.getAll().length).to.equal(2);
    });

    it('should return undefined for out of bounds index', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      el.set([feature1]);
      await new Promise(r => setTimeout(r, 50));

      const removed = el.removeAt(5);
      expect(removed).to.be.undefined;
    });
  });

  describe('removeAll()', () => {
    it('should remove all features and return them', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      el.set([feature1, feature2, feature3]);
      await new Promise(r => setTimeout(r, 50));
      expect(el.getAll().length).to.equal(3);

      const removed = el.removeAll();
      await new Promise(r => setTimeout(r, 50));

      expect(el.getAll().length).to.equal(0);
      expect(removed.length).to.equal(3);
      expect(removed[0].properties.name).to.equal('First');
      expect(removed[1].properties.name).to.equal('Second');
      expect(removed[2].properties.name).to.equal('Third');
    });

    it('should emit change event after removeAll()', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      el.set([feature1, feature2]);
      await new Promise(r => setTimeout(r, 50));

      const changePromise = new Promise(resolve => {
        el.addEventListener('change', resolve, { once: true });
      });

      el.removeAll();

      const event = await changePromise;
      expect(event.detail.features.length).to.equal(0);
    });

    it('should return empty array when no features', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      const removed = el.removeAll();
      expect(removed).to.be.an('array');
      expect(removed.length).to.equal(0);
    });
  });

  describe('get()', () => {
    it('should return feature at the specified index', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      el.set([feature1, feature2, feature3]);
      await new Promise(r => setTimeout(r, 50));

      const f = el.get(1);
      expect(f.properties.name).to.equal('Second');
    });

    it('should handle negative index (from end)', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      el.set([feature1, feature2, feature3]);
      await new Promise(r => setTimeout(r, 50));

      const f = el.get(-1);
      expect(f.properties.name).to.equal('Third');

      const f2 = el.get(-2);
      expect(f2.properties.name).to.equal('Second');
    });

    it('should return undefined for out of bounds index', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      el.set([feature1]);
      await new Promise(r => setTimeout(r, 50));

      expect(el.get(5)).to.be.undefined;
      expect(el.get(-5)).to.be.undefined;
    });
  });

  describe('getAll()', () => {
    it('should return all features', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      el.set([feature1, feature2]);
      await new Promise(r => setTimeout(r, 50));

      const features = el.getAll();
      expect(features.length).to.equal(2);
      expect(features[0].properties.name).to.equal('First');
      expect(features[1].properties.name).to.equal('Second');
    });

    it('should return empty array when no features', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      const features = el.getAll();
      expect(features).to.be.an('array');
      expect(features.length).to.equal(0);
    });
  });

  describe('emit()', () => {
    it('should emit change event with current features', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      el.set([feature1, feature2]);
      await new Promise(r => setTimeout(r, 50));

      const changePromise = new Promise(resolve => {
        el.addEventListener('change', resolve, { once: true });
      });

      el.emit();

      const event = await changePromise;
      expect(event.detail.type).to.equal('FeatureCollection');
      expect(event.detail.features.length).to.equal(2);
    });
  });

  describe('validation', () => {
    it('set() should throw error if not an array', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      expect(() => el.set({ type: 'Feature' })).to.throw('set() expects an array of features');
      expect(() => el.set('not an array')).to.throw('set() expects an array of features');
      expect(() => el.set(null)).to.throw('set() expects an array of features');
    });

    it('set() should throw error for invalid features in array', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      const invalidFeature = { type: 'Point', coordinates: [0, 0] }; // Not a Feature
      expect(() => el.set([invalidFeature])).to.throw('Invalid features');
    });

    it('add() should throw error for invalid feature', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      expect(() => el.add(null)).to.throw('Invalid feature');
      expect(() => el.add('string')).to.throw('Invalid feature');
      expect(() => el.add([1, 2, 3])).to.throw('Invalid feature');
    });

    it('add() should throw error for feature without type', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      const noType = { geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} };
      expect(() => el.add(noType)).to.throw('Feature must have a "type" property');
    });

    it('add() should throw error for wrong feature type', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      const wrongType = { type: 'Point', coordinates: [0, 0] };
      expect(() => el.add(wrongType)).to.throw('Feature type must be "Feature"');
    });

    it('add() should throw error for feature without geometry', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      const noGeometry = { type: 'Feature', properties: {} };
      expect(() => el.add(noGeometry)).to.throw('Feature must have a "geometry" property');
    });

    it('add() should throw error for feature without properties', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      const noProperties = { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] } };
      expect(() => el.add(noProperties)).to.throw('Feature must have a "properties" property');
    });

    it('add() should throw error for invalid geometry type', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      const invalidGeomType = {
        type: 'Feature',
        geometry: { type: 'InvalidType', coordinates: [0, 0] },
        properties: {}
      };
      expect(() => el.add(invalidGeomType)).to.throw('Invalid geometry type');
    });

    it('add() should throw error for geometry without coordinates', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      const noCoords = {
        type: 'Feature',
        geometry: { type: 'Point' },
        properties: {}
      };
      expect(() => el.add(noCoords)).to.throw('Geometry must have a "coordinates" property');
    });

    it('insertAt() should throw error for invalid feature', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      el.set([feature1]);
      await new Promise(r => setTimeout(r, 50));

      expect(() => el.insertAt({ wrongStructure: true }, 0)).to.throw('Invalid feature');
    });

    it('should accept feature with null geometry', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      const nullGeomFeature = { type: 'Feature', geometry: null, properties: { name: 'No location' } };
      el.add(nullGeomFeature);
      await new Promise(r => setTimeout(r, 50));

      const features = el.getAll();
      expect(features.length).to.equal(1);
      expect(features[0].geometry).to.be.null;
    });

    it('should accept feature with null properties', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      const nullPropsFeature = { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: null };
      el.add(nullPropsFeature);
      await new Promise(r => setTimeout(r, 50));

      const features = el.getAll();
      expect(features.length).to.equal(1);
      expect(features[0].properties).to.be.null;
    });

    it('should reject GeometryCollection feature (not supported)', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      const geomCollFeature = {
        type: 'Feature',
        geometry: {
          type: 'GeometryCollection',
          geometries: [
            { type: 'Point', coordinates: [0, 0] },
            { type: 'LineString', coordinates: [[0, 0], [1, 1]] }
          ]
        },
        properties: {}
      };
      expect(() => el.add(geomCollFeature)).to.throw('Invalid geometry type "GeometryCollection"');
    });
  });
});

describe('GeoJsonEditor - Copy/Cut with Collapsed Content', () => {
  // Helper to create a mock ClipboardEvent
  function createClipboardEvent(type) {
    const clipboardData = {
      data: {},
      setData(format, value) { this.data[format] = value; },
      getData(format) { return this.data[format]; }
    };
    const event = new Event(type, { bubbles: true, cancelable: true });
    event.clipboardData = clipboardData;
    return event;
  }

  it('should expand collapsed content when copying all (Ctrl+A, Ctrl+C)', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    const textarea = el.shadowRoot.getElementById('textarea');

    // Set a feature with coordinates that will be auto-collapsed
    const feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [1.5, 2.5] },
      properties: { name: 'Test' }
    };
    el.set([feature]);
    await new Promise(r => setTimeout(r, 200)); // Wait for auto-collapse

    // Verify coordinates are collapsed
    expect(textarea.value).to.include('[...]');

    // Select all
    textarea.selectionStart = 0;
    textarea.selectionEnd = textarea.value.length;

    // Trigger copy event
    const copyEvent = createClipboardEvent('copy');
    textarea.dispatchEvent(copyEvent);

    // Check clipboard contains expanded content
    const clipboardContent = copyEvent.clipboardData.getData('text/plain');
    expect(clipboardContent).to.include('1.5');
    expect(clipboardContent).to.include('2.5');
    expect(clipboardContent).to.not.include('[...]');
  });

  it('should expand collapsed content when cutting all (Ctrl+A, Ctrl+X)', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    const textarea = el.shadowRoot.getElementById('textarea');

    // Set a feature with coordinates that will be auto-collapsed
    const feature = {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1], [2, 2]] },
      properties: {}
    };
    el.set([feature]);
    await new Promise(r => setTimeout(r, 200)); // Wait for auto-collapse

    // Verify coordinates are collapsed
    expect(textarea.value).to.include('[...]');

    // Select all
    textarea.selectionStart = 0;
    textarea.selectionEnd = textarea.value.length;

    // Trigger cut event
    const cutEvent = createClipboardEvent('cut');
    textarea.dispatchEvent(cutEvent);

    // Check clipboard contains expanded content (coordinates are formatted on separate lines)
    const clipboardContent = cutEvent.clipboardData.getData('text/plain');
    expect(clipboardContent).to.include('0,');  // First coord
    expect(clipboardContent).to.include('1,');  // Second coord
    expect(clipboardContent).to.include('2,');  // Third coord
    expect(clipboardContent).to.not.include('[...]');
  });

  it('should not modify clipboard when no collapsed content in selection', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    const textarea = el.shadowRoot.getElementById('textarea');

    // Set simple content without collapsing
    textarea.value = '"hello": "world"';
    el.updateHighlight();

    // Select all
    textarea.selectionStart = 0;
    textarea.selectionEnd = textarea.value.length;

    // Trigger copy event - should not prevent default (no collapsed content)
    const copyEvent = createClipboardEvent('copy');
    textarea.dispatchEvent(copyEvent);

    // Clipboard should not have been set by our handler (returns undefined, not empty string)
    const clipboardContent = copyEvent.clipboardData.getData('text/plain');
    expect(clipboardContent).to.be.undefined;
  });

  it('should handle partial selection with collapsed content', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    const textarea = el.shadowRoot.getElementById('textarea');

    // Set features with coordinates that will be auto-collapsed
    const features = [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [10, 20] }, properties: { id: 1 } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [30, 40] }, properties: { id: 2 } }
    ];
    el.set(features);
    await new Promise(r => setTimeout(r, 200)); // Wait for auto-collapse

    // Verify coordinates are collapsed
    expect(textarea.value).to.include('[...]');

    // Find position of first collapsed marker and select it
    const collapsePos = textarea.value.indexOf('[...]');
    if (collapsePos >= 0) {
      // Select a range that includes the collapsed marker
      const lineStart = textarea.value.lastIndexOf('\n', collapsePos) + 1;
      const lineEnd = textarea.value.indexOf('\n', collapsePos);
      textarea.selectionStart = lineStart;
      textarea.selectionEnd = lineEnd > 0 ? lineEnd : textarea.value.length;

      // Trigger copy event
      const copyEvent = createClipboardEvent('copy');
      textarea.dispatchEvent(copyEvent);

      // Check clipboard contains expanded coordinates
      const clipboardContent = copyEvent.clipboardData.getData('text/plain');
      expect(clipboardContent).to.not.include('[...]');
    }
  });

  it('should handle empty selection gracefully', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    const textarea = el.shadowRoot.getElementById('textarea');

    // Set content
    el.set([{ type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} }]);
    await new Promise(r => setTimeout(r, 200));

    // No selection (cursor only)
    textarea.selectionStart = 5;
    textarea.selectionEnd = 5;

    // Trigger copy event - should not throw
    const copyEvent = createClipboardEvent('copy');
    expect(() => textarea.dispatchEvent(copyEvent)).to.not.throw();
  });
});

describe('GeoJsonEditor - Audit Fixes', () => {

  describe('Brackets in Strings', () => {

    it('should count brackets outside strings correctly', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      // Test helper method directly
      const result1 = el._countBracketsOutsideStrings('{ "key": "value with { brace" }', '{');
      expect(result1.open).to.equal(1);
      expect(result1.close).to.equal(1);

      const result2 = el._countBracketsOutsideStrings('"no brackets here"', '{');
      expect(result2.open).to.equal(0);
      expect(result2.close).to.equal(0);

      const result3 = el._countBracketsOutsideStrings('{ { } }', '{');
      expect(result3.open).to.equal(2);
      expect(result3.close).to.equal(2);
    });

    it('should handle escaped quotes in strings', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      // String with escaped quote: "value with \" and { brace"
      const result = el._countBracketsOutsideStrings('"value with \\" and { brace"', '{');
      expect(result.open).to.equal(0);
      expect(result.close).to.equal(0);
    });

    it('should find closing bracket ignoring brackets in strings', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      const lines = [
        '"key": {',
        '  "nested": "value with } brace",',
        '  "other": 123',
        '}'
      ];

      const result = el._findClosingBracket(lines, 0, '{');
      expect(result).to.exist;
      expect(result.endLine).to.equal(3);
      expect(result.content.length).to.equal(3);
    });

    it('should handle JSON with brackets in property values', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);
      await new Promise(r => setTimeout(r, 100));

      // Feature with brackets in string values
      const feature = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: {
          description: 'This has {curly} and [square] brackets'
        }
      };

      el.set([feature]);
      await new Promise(r => setTimeout(r, 200));

      // Should not throw and features should be correctly parsed
      const features = el.getAll();
      expect(features.length).to.equal(1);
      expect(features[0].properties.description).to.equal('This has {curly} and [square] brackets');
    });

    it('should collapse/expand correctly with brackets in strings', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);
      const textarea = el.shadowRoot.getElementById('textarea');

      // Feature with nested object that has brackets in string values
      const feature = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [1, 2] },
        properties: {
          data: {
            label: 'Contains { and } characters',
            value: 42
          }
        }
      };

      el.set([feature]);
      await new Promise(r => setTimeout(r, 200));

      // Get the gutter and find a collapse button for 'data'
      const gutter = el.shadowRoot.querySelector('.gutter-content');
      const buttons = gutter.querySelectorAll('.collapse-button');

      // Find a button for an expanded node (-)
      let collapseBtn = null;
      for (const btn of buttons) {
        if (btn.textContent === '-' && btn.dataset.nodeKey === 'data') {
          collapseBtn = btn;
          break;
        }
      }

      if (collapseBtn) {
        // Collapse
        collapseBtn.click();
        await new Promise(r => setTimeout(r, 100));

        expect(textarea.value).to.include('{...}');

        // Expand
        const updatedGutter = el.shadowRoot.querySelector('.gutter-content');
        const expandBtn = updatedGutter.querySelector('.collapse-button[data-node-key="data"]');
        if (expandBtn && expandBtn.textContent === '+') {
          expandBtn.click();
          await new Promise(r => setTimeout(r, 100));

          // Content should be restored with brackets intact
          expect(textarea.value).to.include('Contains { and } characters');
        }
      }

      // Verify features are still parseable
      const features = el.getAll();
      expect(features.length).to.equal(1);
    });
  });

  describe('State Cleanup on set()', () => {

    it('should clear collapsedData when set() is called', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      // Add features with coordinates that will be auto-collapsed
      const feature1 = {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] },
        properties: {}
      };

      el.set([feature1]);
      await new Promise(r => setTimeout(r, 200));

      // Verify coordinates are collapsed
      expect(el.collapsedData.size).to.be.greaterThan(0);

      // Store the original content of collapsed data
      const originalCollapsedContent = Array.from(el.collapsedData.values())
        .map(v => v.content.join('\n'));

      // Set new features with DIFFERENT coordinates - should clear old collapsed data
      const feature2 = {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[[10, 10], [11, 10], [11, 11], [10, 11], [10, 10]]] },
        properties: {}
      };

      el.set([feature2]);
      await new Promise(r => setTimeout(r, 200));

      // Collapsed data should exist but with different content
      expect(el.collapsedData.size).to.be.greaterThan(0);

      // The content should be different (feature2's coordinates, not feature1's)
      const newCollapsedContent = Array.from(el.collapsedData.values())
        .map(v => v.content.join('\n'));

      // Original contained [0,0], [1,0] etc, new should contain [10,10], [11,10] etc
      expect(originalCollapsedContent.some(c => c.includes('10'))).to.be.false;
      expect(newCollapsedContent.some(c => c.includes('10'))).to.be.true;
    });

    it('should clear hiddenFeatures when set() is called', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      // Add features
      const feature1 = {
        type: 'Feature',
        id: 'f1',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: {}
      };
      const feature2 = {
        type: 'Feature',
        id: 'f2',
        geometry: { type: 'Point', coordinates: [1, 1] },
        properties: {}
      };

      el.set([feature1, feature2]);
      await new Promise(r => setTimeout(r, 200));

      // Hide the first feature
      const gutter = el.shadowRoot.querySelector('.gutter-content');
      const visibilityBtn = gutter.querySelector('.visibility-button');
      if (visibilityBtn) {
        visibilityBtn.click();
        await new Promise(r => setTimeout(r, 50));

        expect(el.hiddenFeatures.size).to.equal(1);
      }

      // Set new features - should clear hiddenFeatures
      const feature3 = {
        type: 'Feature',
        id: 'f3',
        geometry: { type: 'Point', coordinates: [2, 2] },
        properties: {}
      };

      el.set([feature3]);
      await new Promise(r => setTimeout(r, 200));

      // Hidden features should be cleared
      expect(el.hiddenFeatures.size).to.equal(0);
    });

    it('should emit all features after set() clears hidden state', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      // Add and hide a feature
      const feature1 = {
        type: 'Feature',
        id: 'hidden',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: {}
      };

      el.set([feature1]);
      await new Promise(r => setTimeout(r, 200));

      // Hide it
      const gutter = el.shadowRoot.querySelector('.gutter-content');
      const visibilityBtn = gutter.querySelector('.visibility-button');
      if (visibilityBtn) {
        visibilityBtn.click();
        await new Promise(r => setTimeout(r, 50));
      }

      // Set new features
      const feature2 = {
        type: 'Feature',
        id: 'new',
        geometry: { type: 'Point', coordinates: [1, 1] },
        properties: {}
      };

      let changeEvent = null;
      el.addEventListener('change', (e) => { changeEvent = e; }, { once: true });

      el.set([feature2]);
      await new Promise(r => setTimeout(r, 200));

      // All features should be emitted (none hidden)
      expect(changeEvent).to.exist;
      expect(changeEvent.detail.features.length).to.equal(1);
      expect(changeEvent.detail.features[0].id).to.equal('new');
    });
  });

  describe('_normalizeIndex() Helper', () => {

    it('should return positive index unchanged', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      expect(el._normalizeIndex(0, 5)).to.equal(0);
      expect(el._normalizeIndex(2, 5)).to.equal(2);
      expect(el._normalizeIndex(4, 5)).to.equal(4);
    });

    it('should convert negative index to positive', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      expect(el._normalizeIndex(-1, 5)).to.equal(4);  // Last element
      expect(el._normalizeIndex(-2, 5)).to.equal(3);
      expect(el._normalizeIndex(-5, 5)).to.equal(0);  // First element
    });

    it('should return -1 for out of bounds when clamp=false', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      expect(el._normalizeIndex(5, 5)).to.equal(-1);   // Too high
      expect(el._normalizeIndex(10, 5)).to.equal(-1);
      expect(el._normalizeIndex(-6, 5)).to.equal(-1);  // Too low
      expect(el._normalizeIndex(-10, 5)).to.equal(-1);
    });

    it('should clamp to valid range when clamp=true', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      expect(el._normalizeIndex(5, 5, true)).to.equal(5);   // Clamped to length (for insertAt)
      expect(el._normalizeIndex(10, 5, true)).to.equal(5);
      expect(el._normalizeIndex(-6, 5, true)).to.equal(0);  // Clamped to 0
      expect(el._normalizeIndex(-10, 5, true)).to.equal(0);
    });

    it('should handle edge cases', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      // Empty array
      expect(el._normalizeIndex(0, 0)).to.equal(-1);
      expect(el._normalizeIndex(-1, 0)).to.equal(-1);
      expect(el._normalizeIndex(0, 0, true)).to.equal(0);

      // Single element array
      expect(el._normalizeIndex(0, 1)).to.equal(0);
      expect(el._normalizeIndex(-1, 1)).to.equal(0);
      expect(el._normalizeIndex(1, 1)).to.equal(-1);
    });
  });

  describe('Color Picker Listener Cleanup', () => {

    it('should remove listener when opening new color picker', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      // Feature with color property
      const feature = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: { color: '#ff0000' }
      };

      el.set([feature]);
      await new Promise(r => setTimeout(r, 200));

      const gutter = el.shadowRoot.querySelector('.gutter-content');
      const colorIndicator = gutter.querySelector('.color-indicator');

      if (colorIndicator) {
        // Open first picker
        colorIndicator.click();
        await new Promise(r => setTimeout(r, 50));

        const picker1 = document.querySelector('.geojson-color-picker-input');
        expect(picker1).to.exist;
        expect(picker1._closeListener).to.exist;

        // Open second picker (should remove first)
        colorIndicator.click();
        await new Promise(r => setTimeout(r, 50));

        // First picker should be removed
        expect(document.querySelectorAll('.geojson-color-picker-input').length).to.equal(1);
      }
    });
  });

  describe('Lifecycle Cleanup', () => {

    it('should clean up color picker on disconnectedCallback', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      // Feature with color property
      const feature = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: { color: '#ff0000' }
      };

      el.set([feature]);
      await new Promise(r => setTimeout(r, 200));

      const gutter = el.shadowRoot.querySelector('.gutter-content');
      const colorIndicator = gutter.querySelector('.color-indicator');

      if (colorIndicator) {
        // Open picker
        colorIndicator.click();
        await new Promise(r => setTimeout(r, 50));

        const picker = document.querySelector('.geojson-color-picker-input');
        expect(picker).to.exist;

        // Remove element from DOM (triggers disconnectedCallback)
        el.remove();
        await new Promise(r => setTimeout(r, 50));

        // Picker should be removed
        expect(document.querySelector('.geojson-color-picker-input')).to.be.null;
      }
    });

    it('should clear highlight timer on disconnectedCallback', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);
      const textarea = el.shadowRoot.getElementById('textarea');

      // Trigger input to set a highlight timer
      textarea.value = '{"type": "Feature"';
      textarea.dispatchEvent(new Event('input'));

      // Timer should be set
      expect(el.highlightTimer).to.not.be.null;

      // Remove element
      el.remove();

      // Timer should be cleared
      expect(el.highlightTimer).to.be.null;
    });
  });

  describe('_performCollapse() Helper', () => {

    it('should collapse a node and return lines removed', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      const lines = [
        '  "data": {',
        '    "value": 42',
        '  }'
      ];

      const linesRemoved = el._performCollapse(lines, 0, 'data', '  ', '{');

      expect(linesRemoved).to.equal(2);
      expect(lines.length).to.equal(1);
      expect(lines[0]).to.include('{...}');
      expect(el.collapsedData.has('0-data')).to.be.true;
    });

    it('should return 0 if bracket closes on same line', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      const lines = [
        '  "data": {}',
        '  "other": 1'
      ];

      const linesRemoved = el._performCollapse(lines, 0, 'data', '  ', '{');

      expect(linesRemoved).to.equal(0);
      expect(lines.length).to.equal(2);
      expect(lines[0]).to.equal('  "data": {}');
    });

    it('should preserve trailing comma', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      const lines = [
        '  "data": [',
        '    1,',
        '    2',
        '  ],',
        '  "next": true'
      ];

      el._performCollapse(lines, 0, 'data', '  ', '[');

      expect(lines[0]).to.include('[...]');
      expect(lines[0]).to.match(/\],$/);
    });
  });
});

describe('GeoJsonEditor - Default Properties', () => {

  it('should initialize with empty default properties', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    expect(el.defaultProperties).to.equal('');
    expect(el._defaultPropertiesRules).to.deep.equal([]);
  });

  it('should parse simple default-properties format', async () => {
    const props = JSON.stringify({ 'fill-color': '#1a465b', 'stroke-width': 2 });
    const el = await fixture(html`<geojson-editor default-properties='${props}'></geojson-editor>`);

    expect(el._defaultPropertiesRules).to.have.lengthOf(1);
    expect(el._defaultPropertiesRules[0].match).to.be.null;
    expect(el._defaultPropertiesRules[0].values).to.deep.equal({
      'fill-color': '#1a465b',
      'stroke-width': 2
    });
  });

  it('should parse conditional default-properties format', async () => {
    const props = JSON.stringify([
      { match: { 'geometry.type': 'Polygon' }, values: { 'fill-color': '#1a465b' } },
      { match: { 'geometry.type': 'Point' }, values: { 'marker-color': '#ff0000' } }
    ]);
    const el = await fixture(html`<geojson-editor default-properties='${props}'></geojson-editor>`);

    expect(el._defaultPropertiesRules).to.have.lengthOf(2);
    expect(el._defaultPropertiesRules[0].match).to.deep.equal({ 'geometry.type': 'Polygon' });
    expect(el._defaultPropertiesRules[1].match).to.deep.equal({ 'geometry.type': 'Point' });
  });

  it('should handle invalid JSON in default-properties gracefully', async () => {
    const el = await fixture(html`<geojson-editor default-properties='invalid json'></geojson-editor>`);

    expect(el._defaultPropertiesRules).to.deep.equal([]);
  });

  it('should apply simple default properties to features', async () => {
    const props = JSON.stringify({ 'fill-color': '#1a465b' });
    const el = await fixture(html`<geojson-editor default-properties='${props}'></geojson-editor>`);

    const listener = oneEvent(el, 'change');

    // Set a simple point feature without fill-color
    el.set([{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { name: 'Test' }
    }]);

    const { detail } = await listener;

    expect(detail.features[0].properties['fill-color']).to.equal('#1a465b');
    expect(detail.features[0].properties.name).to.equal('Test');
  });

  it('should not overwrite existing properties', async () => {
    const props = JSON.stringify({ 'fill-color': '#1a465b', 'stroke-width': 2 });
    const el = await fixture(html`<geojson-editor default-properties='${props}'></geojson-editor>`);

    const listener = oneEvent(el, 'change');

    // Set a feature that already has fill-color
    el.set([{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { 'fill-color': '#ff0000' }
    }]);

    const { detail } = await listener;

    // Existing fill-color should be preserved
    expect(detail.features[0].properties['fill-color']).to.equal('#ff0000');
    // stroke-width should be added
    expect(detail.features[0].properties['stroke-width']).to.equal(2);
  });

  it('should apply conditional properties based on geometry.type', async () => {
    const props = JSON.stringify([
      { match: { 'geometry.type': 'Polygon' }, values: { 'fill-color': '#green' } },
      { match: { 'geometry.type': 'Point' }, values: { 'marker-color': '#red' } }
    ]);
    const el = await fixture(html`<geojson-editor default-properties='${props}'></geojson-editor>`);

    const listener = oneEvent(el, 'change');

    el.set([
      {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
        properties: {}
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: {}
      }
    ]);

    const { detail } = await listener;

    // Polygon should have fill-color
    expect(detail.features[0].properties['fill-color']).to.equal('#green');
    expect(detail.features[0].properties['marker-color']).to.be.undefined;

    // Point should have marker-color
    expect(detail.features[1].properties['marker-color']).to.equal('#red');
    expect(detail.features[1].properties['fill-color']).to.be.undefined;
  });

  it('should apply conditional properties based on properties values', async () => {
    const props = JSON.stringify([
      { match: { 'properties.type': 'airport' }, values: { 'marker-symbol': 'airport' } },
      { match: { 'properties.type': 'hospital' }, values: { 'marker-symbol': 'hospital' } }
    ]);
    const el = await fixture(html`<geojson-editor default-properties='${props}'></geojson-editor>`);

    const listener = oneEvent(el, 'change');

    el.set([
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: { type: 'airport', name: 'CDG' }
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [1, 1] },
        properties: { type: 'hospital', name: 'Clinic' }
      }
    ]);

    const { detail } = await listener;

    expect(detail.features[0].properties['marker-symbol']).to.equal('airport');
    expect(detail.features[1].properties['marker-symbol']).to.equal('hospital');
  });

  it('should apply multiple matching rules (later rules win)', async () => {
    const props = JSON.stringify([
      { values: { 'stroke-width': 1, 'stroke-color': '#333' } },  // fallback for all
      { match: { 'geometry.type': 'Polygon' }, values: { 'fill-color': '#blue' } },
      { match: { 'properties.highlighted': true }, values: { 'stroke-width': 5 } }
    ]);
    const el = await fixture(html`<geojson-editor default-properties='${props}'></geojson-editor>`);

    const listener = oneEvent(el, 'change');

    el.set([{
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      properties: { highlighted: true }
    }]);

    const { detail } = await listener;
    const props0 = detail.features[0].properties;

    // From fallback rule
    expect(props0['stroke-color']).to.equal('#333');
    // From polygon rule
    expect(props0['fill-color']).to.equal('#blue');
    // From highlighted rule (overrides fallback stroke-width)
    expect(props0['stroke-width']).to.equal(5);
  });

  it('should update rules when default-properties attribute changes', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    expect(el._defaultPropertiesRules).to.deep.equal([]);

    // Set default-properties
    el.setAttribute('default-properties', JSON.stringify({ 'fill-color': '#new' }));

    expect(el._defaultPropertiesRules).to.have.lengthOf(1);
    expect(el._defaultPropertiesRules[0].values['fill-color']).to.equal('#new');
  });

  it('should work with nested match conditions', async () => {
    const props = JSON.stringify([
      { match: { 'properties.metadata.priority': 'high' }, values: { 'stroke-color': '#red' } }
    ]);
    const el = await fixture(html`<geojson-editor default-properties='${props}'></geojson-editor>`);

    const listener = oneEvent(el, 'change');

    el.set([{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { metadata: { priority: 'high' } }
    }]);

    const { detail } = await listener;

    expect(detail.features[0].properties['stroke-color']).to.equal('#red');
  });

  describe('_matchesCondition()', () => {
    it('should return true for null match', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);
      const feature = { type: 'Feature', geometry: { type: 'Point' }, properties: {} };

      expect(el._matchesCondition(feature, null)).to.be.true;
      expect(el._matchesCondition(feature, undefined)).to.be.true;
    });

    it('should match simple property', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);
      const feature = { type: 'Feature', geometry: { type: 'Point' }, properties: {} };

      expect(el._matchesCondition(feature, { type: 'Feature' })).to.be.true;
      expect(el._matchesCondition(feature, { type: 'Other' })).to.be.false;
    });

    it('should match nested property with dot notation', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);
      const feature = { type: 'Feature', geometry: { type: 'Polygon' }, properties: { cat: 'A' } };

      expect(el._matchesCondition(feature, { 'geometry.type': 'Polygon' })).to.be.true;
      expect(el._matchesCondition(feature, { 'geometry.type': 'Point' })).to.be.false;
      expect(el._matchesCondition(feature, { 'properties.cat': 'A' })).to.be.true;
    });

    it('should require all conditions to match', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);
      const feature = { type: 'Feature', geometry: { type: 'Point' }, properties: { name: 'Test' } };

      expect(el._matchesCondition(feature, { 'geometry.type': 'Point', 'properties.name': 'Test' })).to.be.true;
      expect(el._matchesCondition(feature, { 'geometry.type': 'Point', 'properties.name': 'Other' })).to.be.false;
    });
  });

  describe('_getNestedValue()', () => {
    it('should get top-level value', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      expect(el._getNestedValue({ a: 1 }, 'a')).to.equal(1);
    });

    it('should get nested value', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      expect(el._getNestedValue({ a: { b: { c: 'deep' } } }, 'a.b.c')).to.equal('deep');
    });

    it('should return undefined for missing path', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      expect(el._getNestedValue({ a: 1 }, 'b')).to.be.undefined;
      expect(el._getNestedValue({ a: 1 }, 'a.b.c')).to.be.undefined;
    });

    it('should handle null/undefined in path', async () => {
      const el = await fixture(html`<geojson-editor></geojson-editor>`);

      expect(el._getNestedValue({ a: null }, 'a.b')).to.be.undefined;
      expect(el._getNestedValue(null, 'a')).to.be.undefined;
    });
  });
});