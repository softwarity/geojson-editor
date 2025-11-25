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

describe('GeoJsonEditor - Auto Format', () => {

  it('should format JSON when auto-format is enabled', async () => {
    const el = await fixture(html`<geojson-editor auto-format></geojson-editor>`);
    const textarea = el.shadowRoot.querySelector('textarea');

    // Input minified JSON
    textarea.value = '{"type":"Feature","geometry":null,"properties":{}}';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    // Wait for debounce
    await new Promise(r => setTimeout(r, 200));

    // Should be formatted with indentation
    expect(textarea.value).to.include('\n');
  });

  it('should not format when auto-format is disabled', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    const textarea = el.shadowRoot.querySelector('textarea');

    const minified = '{"type":"Feature"}';
    textarea.value = minified;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    await new Promise(r => setTimeout(r, 200));

    // Should remain minified (no newlines added)
    expect(textarea.value).to.equal(minified);
  });
});

describe('GeoJsonEditor - Events', () => {

  it('should emit change event with valid GeoJSON', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    const textarea = el.shadowRoot.querySelector('textarea');

    setTimeout(() => {
      textarea.value = '{"type": "Feature", "geometry": null, "properties": {}}';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }, 0);

    const event = await oneEvent(el, 'change', false);

    expect(event.detail).to.exist;
    expect(event.detail.type).to.equal('Feature');
  });

  it('should emit change event when value is set via setAttribute', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    const changePromise = new Promise(resolve => {
      el.addEventListener('change', resolve, { once: true });
    });

    el.setAttribute('value', '{"type": "Feature", "geometry": null, "properties": {}}');

    const event = await changePromise;

    expect(event.detail).to.exist;
    expect(event.detail.type).to.equal('Feature');
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

  it('should return default theme via getTheme()', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    const theme = el.getTheme();

    expect(theme.dark).to.exist;
    expect(theme.light).to.exist;
    expect(theme.dark.background).to.equal('#1e1e1e');
    expect(theme.light.background).to.equal('#ffffff');
  });

  it('should allow theme customization via setTheme()', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    el.setTheme({
      dark: { controlColor: '#ff0000' }
    });

    const theme = el.getTheme();
    expect(theme.dark.controlColor).to.equal('#ff0000');
    // Other properties should remain unchanged
    expect(theme.dark.background).to.equal('#1e1e1e');
  });

  it('should reset theme via resetTheme()', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    el.setTheme({
      dark: { background: '#000000' }
    });

    expect(el.getTheme().dark.background).to.equal('#000000');

    el.resetTheme();

    expect(el.getTheme().dark.background).to.equal('#1e1e1e');
  });
});

describe('GeoJsonEditor - Feature Collection Mode', () => {

  it('should show prefix/suffix when feature-collection is set', async () => {
    const el = await fixture(html`<geojson-editor feature-collection></geojson-editor>`);

    const prefix = el.shadowRoot.querySelector('#editorPrefix');
    const suffix = el.shadowRoot.querySelector('#editorSuffix');

    expect(prefix.style.display).to.not.equal('none');
    expect(suffix.style.display).to.not.equal('none');
    expect(prefix.textContent).to.include('FeatureCollection');
  });

  it('should hide prefix/suffix when feature-collection is not set', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    const prefix = el.shadowRoot.querySelector('#editorPrefix');
    const suffix = el.shadowRoot.querySelector('#editorSuffix');

    expect(prefix.style.display).to.equal('none');
    expect(suffix.style.display).to.equal('none');
  });

  it('should wrap content in FeatureCollection for change event', async () => {
    const el = await fixture(html`<geojson-editor feature-collection></geojson-editor>`);
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

    // The event should contain the updated GeoJSON
    expect(event.detail.properties.color).to.equal('#0000ff');
  });
});

describe('GeoJsonEditor - Dark Selector', () => {

  it('should apply dark theme when selector matches', async () => {
    const el = await fixture(html`
      <geojson-editor class="dark" dark-selector=".dark"></geojson-editor>
    `);

    // Theme CSS should be injected
    const themeStyle = el.shadowRoot.querySelector('#theme-styles');
    expect(themeStyle).to.exist;
    expect(themeStyle.textContent).to.include('--bg-color');
  });

  it('should update theme when dark-selector changes', async () => {
    const el = await fixture(html`
      <geojson-editor dark-selector=".dark"></geojson-editor>
    `);

    el.setAttribute('dark-selector', '.night-mode');

    const themeStyle = el.shadowRoot.querySelector('#theme-styles');
    expect(themeStyle.textContent).to.include('.night-mode');
  });
});
