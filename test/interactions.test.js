import { expect, fixture, html } from '@open-wc/testing';
import GeoJsonEditor from '../src/geojson-editor.ts';

// Helper to wait for component to stabilize
const waitFor = (ms = 100) => new Promise(r => setTimeout(r, ms));

// Create a fixture with explicit size for viewport rendering tests
const createSizedFixture = async (attributes = '') => {
  return await fixture(html`<geojson-editor style="height: 400px; width: 600px;" ${attributes}></geojson-editor>`);
};

// Helper to focus the editor
const focusEditor = async (editor) => {
  const textarea = editor.shadowRoot.querySelector('.hidden-textarea');
  textarea.focus();
  await waitFor(50);
};

// Helper to set cursor position
const setCursor = (editor, line, column) => {
  editor.cursorLine = line;
  editor.cursorColumn = column;
  editor._clearSelection();
};

// Helper to simulate keyboard events
const simulateKeydown = (element, key, options = {}) => {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options
  });
  element.dispatchEvent(event);
  return event;
};
import {
  validPoint,
  validPolygon
} from './fixtures/geojson-samples.js';

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

  it('should initialize cursor at 0,0', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    
    expect(el.cursorLine).to.equal(0);
    expect(el.cursorColumn).to.equal(0);
  });

  it('should update cursor position when set', async () => {
    const el = await createSizedFixture();
    await waitFor();
    
    el.set([validPoint]);
    await waitFor(200);
    
    el.cursorLine = 2;
    el.cursorColumn = 5;
    
    expect(el.cursorLine).to.equal(2);
    expect(el.cursorColumn).to.equal(5);
  });

  it('should have _hasSelection method', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    
    expect(el._hasSelection).to.be.a('function');
  });

  it('should return false for _hasSelection when no selection', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    
    el.selectionStart = null;
    el.selectionEnd = null;
    
    expect(el._hasSelection()).to.be.false;
  });

  it('should return true for _hasSelection when selection exists', async () => {
    const el = await createSizedFixture();
    await waitFor();
    
    el.set([validPoint]);
    await waitFor(200);
    
    el.selectionStart = { line: 0, column: 0 };
    el.selectionEnd = { line: 1, column: 5 };
    
    expect(el._hasSelection()).to.be.true;
  });

  it('should clear selection with _clearSelection', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    
    el.selectionStart = { line: 0, column: 0 };
    el.selectionEnd = { line: 1, column: 5 };
    
    el._clearSelection();
    
    expect(el.selectionEnd).to.be.null;
  });
});

describe('GeoJsonEditor - Keyboard Navigation', () => {

  it('should have handleKeydown method', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    
    expect(el.handleKeydown).to.be.a('function');
  });

  it('should move cursor down with ArrowDown', async () => {
    const el = await createSizedFixture();
    await waitFor();
    
    el.set([validPoint]);
    await waitFor(200);
    
    el.cursorLine = 0;
    el.cursorColumn = 0;
    
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
    el.handleKeydown(event);
    
    expect(el.cursorLine).to.equal(1);
  });

  it('should move cursor up with ArrowUp', async () => {
    const el = await createSizedFixture();
    await waitFor();
    
    el.set([validPoint]);
    await waitFor(200);
    
    el.cursorLine = 2;
    el.cursorColumn = 0;
    
    const event = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true });
    el.handleKeydown(event);
    
    expect(el.cursorLine).to.equal(1);
  });

  it('should move cursor right with ArrowRight', async () => {
    const el = await createSizedFixture();
    await waitFor();
    
    el.set([validPoint]);
    await waitFor(200);
    
    el.cursorLine = 0;
    el.cursorColumn = 0;
    
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
    el.handleKeydown(event);
    
    expect(el.cursorColumn).to.equal(1);
  });

  it('should move cursor left with ArrowLeft', async () => {
    const el = await createSizedFixture();
    await waitFor();
    
    el.set([validPoint]);
    await waitFor(200);
    
    el.cursorLine = 0;
    el.cursorColumn = 5;
    
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
    el.handleKeydown(event);
    
    expect(el.cursorColumn).to.equal(4);
  });

  it('should move to start of line with Home', async () => {
    const el = await createSizedFixture();
    await waitFor();
    
    el.set([validPoint]);
    await waitFor(200);
    
    el.cursorLine = 1;
    el.cursorColumn = 10;
    
    const event = new KeyboardEvent('keydown', { key: 'Home', bubbles: true });
    el.handleKeydown(event);
    
    expect(el.cursorColumn).to.equal(0);
  });

  it('should move to end of line with End', async () => {
    const el = await createSizedFixture();
    await waitFor();
    
    el.set([validPoint]);
    await waitFor(200);
    
    el.cursorLine = 1;
    el.cursorColumn = 0;
    const lineLength = el.lines[1].length;
    
    const event = new KeyboardEvent('keydown', { key: 'End', bubbles: true });
    el.handleKeydown(event);
    
    expect(el.cursorColumn).to.equal(lineLength);
  });

  it('should select all with Ctrl+A', async () => {
    const el = await createSizedFixture();
    await waitFor();
    
    el.set([validPoint]);
    await waitFor(200);
    
    const event = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true });
    el.handleKeydown(event);
    
    expect(el._hasSelection()).to.be.true;
  });
});

describe('GeoJsonEditor - Collapse/Expand with Tab', () => {

  it('should expand collapsed node with Enter', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon]);
    await waitFor(200);

    // Find a collapsible node and collapse it
    const nodeId = Array.from(el._nodeIdToLines.keys())[0];
    if (nodeId) {
      el.collapsedNodes.add(nodeId);
      el.updateView();
      await waitFor(100);

      // Position cursor on collapsed node
      const startLine = el._nodeIdToLines.get(nodeId)?.startLine;
      if (startLine !== undefined) {
        el.cursorLine = startLine;
        el.cursorColumn = 0;

        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        el.handleKeydown(event);

        expect(el.collapsedNodes.has(nodeId)).to.be.false;
      }
    }
  });

  it('should collapse expanded node with Shift+Enter', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon], { collapsed: [] }); // Start with nothing collapsed
    await waitFor(200);

    // Position cursor inside a node
    el.cursorLine = 2;
    el.cursorColumn = 0;

    const initialCollapsedCount = el.collapsedNodes.size;

    const event = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true });
    el.handleKeydown(event);

    // Should have collapsed something
    expect(el.collapsedNodes.size).to.be.greaterThan(initialCollapsedCount);
  });

  it('should navigate to next attribute with Tab', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon], { collapsed: [] });
    await waitFor(200);

    // Position at start
    el.cursorLine = 0;
    el.cursorColumn = 0;

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    el.handleKeydown(event);

    // Should have selection on an attribute
    expect(el.selectionStart).to.not.be.null;
    expect(el.selectionEnd).to.not.be.null;
  });
});

describe('GeoJsonEditor - Scroll and Viewport', () => {

  it('should have scrollTop property', async () => {
    const el = await createSizedFixture();
    
    expect(el.scrollTop).to.be.a('number');
  });

  it('should have lineHeight property', async () => {
    const el = await createSizedFixture();
    
    expect(el.lineHeight).to.be.a('number');
    expect(el.lineHeight).to.be.greaterThan(0);
  });

  it('should sync gutter scroll with viewport', async () => {
    const el = await createSizedFixture();
    await waitFor();
    
    el.set([validPolygon]);
    await waitFor(200);
    
    const viewport = el.shadowRoot.getElementById('viewport');
    const gutterScroll = el.shadowRoot.getElementById('gutterScroll');
    
    viewport.scrollTop = 50;
    el.syncGutterScroll();
    await waitFor(50);
    
    expect(gutterScroll.scrollTop).to.equal(viewport.scrollTop);
  });

  it('should have renderViewport method', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    
    expect(el.renderViewport).to.be.a('function');
  });

  it('should render visible lines only', async () => {
    const el = await createSizedFixture();
    await waitFor();
    
    el.set([validPolygon]);
    await waitFor(200);
    
    el.renderViewport();
    
    const linesContainer = el.shadowRoot.getElementById('linesContainer');
    const renderedLines = linesContainer.querySelectorAll('.line');
    
    // Should render some but not necessarily all lines
    expect(renderedLines.length).to.be.greaterThan(0);
  });
});
