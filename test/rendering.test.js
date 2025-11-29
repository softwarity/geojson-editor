import { expect, fixture, html } from '@open-wc/testing';
import GeoJsonEditor from '../src/geojson-editor.ts';

// Helper to wait for component to stabilize
const waitFor = (ms = 100) => new Promise(r => setTimeout(r, ms));

// Create a fixture with explicit size for viewport rendering tests
const createSizedFixture = async (attributes = '') => {
  return await fixture(html`<geojson-editor style="height: 400px; width: 600px;" ${attributes}></geojson-editor>`);
};
import {
  validPointStr,
  validPolygonStr,
  validPoint,
  validPolygon
} from './fixtures/geojson-samples.js';

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

  it('should allow text selection when readonly', async () => {
    const el = await fixture(html`<geojson-editor readonly></geojson-editor>`);
    const textarea = el.shadowRoot.querySelector('.hidden-textarea');
    
    // readOnly should be true but disabled should be false (allows selection)
    expect(textarea.readOnly).to.be.true;
    expect(textarea.disabled).to.be.false;
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
