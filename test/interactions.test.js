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
    const initialColumn = el.cursorColumn;

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    el.handleKeydown(event);

    // Should have moved cursor (to attribute or bracket position)
    expect(el.cursorColumn).to.be.greaterThan(initialColumn);
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

  it('should update selection when scrolling up during drag', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon]);
    await waitFor(200);

    // Start a selection from middle of document
    el.selectionStart = { line: 5, column: 2 };
    el.selectionEnd = { line: 5, column: 5 };
    el.cursorLine = 5;
    el.cursorColumn = 5;

    // Simulate scrolling up during drag
    el._updateSelectionFromScroll('up');

    // Selection should extend to first visible line at column 0
    expect(el.selectionEnd.line).to.equal(el.visibleLines[0].index);
    expect(el.selectionEnd.column).to.equal(0);
    expect(el.cursorLine).to.equal(el.visibleLines[0].index);
    expect(el.cursorColumn).to.equal(0);
  });

  it('should update selection when scrolling down during drag', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon]);
    await waitFor(200);

    // Start a selection from middle of document
    el.selectionStart = { line: 2, column: 0 };
    el.selectionEnd = { line: 2, column: 3 };
    el.cursorLine = 2;
    el.cursorColumn = 3;

    // Simulate scrolling down during drag
    el._updateSelectionFromScroll('down');

    // Selection should extend to last visible line at end of line
    const lastVisible = el.visibleLines[el.visibleLines.length - 1];
    expect(el.selectionEnd.line).to.equal(lastVisible.index);
    expect(el.selectionEnd.column).to.equal(lastVisible.content?.length || 0);
    expect(el.cursorLine).to.equal(lastVisible.index);
    expect(el.cursorColumn).to.equal(lastVisible.content?.length || 0);
  });

  it('should not scroll viewport when typing character that invalidates JSON', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Suppress error events (expected when JSON becomes invalid)
    el.addEventListener('error', (e) => e.stopPropagation());

    // Set valid features
    el.set([
      { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { name: 'First' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] }, properties: { name: 'Second' } }
    ]);
    await waitFor(200);

    // Focus editor and move cursor to end of last feature (after closing brace)
    await focusEditor(el);
    const lastLine = el.lines.length - 1;
    el.cursorLine = lastLine;
    el.cursorColumn = el.lines[lastLine].length;
    el.renderViewport();
    await waitFor(50);

    // Record scroll position before typing
    const viewport = el.shadowRoot.getElementById('viewport');
    const scrollTopBefore = viewport.scrollTop;

    // Type a comma at the end (this will invalidate JSON as it expects another feature)
    const textarea = el.shadowRoot.querySelector('.hidden-textarea');
    textarea.value = ',';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(200);

    // Scroll position should not have changed significantly (allow small tolerance)
    const scrollTopAfter = viewport.scrollTop;
    const scrollDiff = Math.abs(scrollTopAfter - scrollTopBefore);

    // Viewport should not scroll more than one line height
    expect(scrollDiff).to.be.lessThan(el.lineHeight * 2,
      `Viewport scrolled unexpectedly by ${scrollDiff}px when typing comma`);
  });

  it('should keep cursor visible without excessive scrolling when typing at end', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Suppress error events (expected when JSON becomes invalid)
    el.addEventListener('error', (e) => e.stopPropagation());

    // Set a feature
    el.set([
      { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} }
    ]);
    await waitFor(200);

    await focusEditor(el);

    // Move cursor to end
    const lastLine = el.lines.length - 1;
    el.cursorLine = lastLine;
    el.cursorColumn = el.lines[lastLine].length;
    el.renderViewport();
    await waitFor(50);

    // Get cursor line position in viewport
    const viewport = el.shadowRoot.getElementById('viewport');
    const cursorYBefore = el.cursorLine * el.lineHeight - viewport.scrollTop;

    // Type a character
    const textarea = el.shadowRoot.querySelector('.hidden-textarea');
    textarea.value = ',';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(200);

    // Cursor should still be in similar position relative to viewport
    const cursorYAfter = el.cursorLine * el.lineHeight - viewport.scrollTop;
    const positionDiff = Math.abs(cursorYAfter - cursorYBefore);

    // Cursor relative position should not change dramatically
    expect(positionDiff).to.be.lessThan(el.lineHeight * 3,
      `Cursor position in viewport changed by ${positionDiff}px`);
  });

  it('should scroll to keep cursor visible after pasting a feature', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Set an initial feature
    el.set([
      { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { name: 'Initial' } }
    ]);
    await waitFor(200);

    await focusEditor(el);

    // Move cursor to end of content (after the closing brace)
    const lastLine = el.lines.length - 1;
    el.cursorLine = lastLine;
    el.cursorColumn = el.lines[lastLine].length;
    el.renderViewport();
    await waitFor(50);

    const viewport = el.shadowRoot.getElementById('viewport');

    // Create a paste event with a new feature
    const newFeature = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] }, properties: { name: 'Pasted' } };
    const pasteText = ',\n' + JSON.stringify(newFeature, null, 2);

    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: new DataTransfer()
    });
    pasteEvent.clipboardData.setData('text/plain', pasteText);

    const textarea = el.shadowRoot.querySelector('.hidden-textarea');
    textarea.dispatchEvent(pasteEvent);
    await waitFor(400); // Wait for paste + RAF for scroll adjustment

    // After paste, cursor should be at end of pasted content
    // and cursor should be visible in viewport with comfortable margin
    // Use visibleIndex like _scrollToCursor does (accounts for collapsed lines)
    const visibleIndex = el.visibleLines.findIndex(vl => vl.index === el.cursorLine);
    expect(visibleIndex).to.be.greaterThan(-1, 'Cursor line should be in visibleLines');

    const cursorY = visibleIndex * el.lineHeight;
    const viewportTop = viewport.scrollTop;
    const viewportBottom = viewportTop + viewport.clientHeight;
    // _scrollToCursor uses a margin of 2 lines for comfortable visibility
    const scrollMargin = el.lineHeight * 2;

    // Cursor should be comfortably within visible viewport (not at edge)
    expect(cursorY).to.be.at.least(viewportTop,
      `Cursor is above viewport after paste (cursorY=${cursorY}, viewportTop=${viewportTop})`);
    expect(cursorY + el.lineHeight).to.be.at.most(viewportBottom,
      `Cursor is below viewport after paste (cursorY=${cursorY}, lineHeight=${el.lineHeight}, viewportBottom=${viewportBottom})`);

    // Verify cursor is not at the very edge - should have margin space
    // Either there's space above (cursor not at top edge) or cursor is near top of document
    const hasMarginAbove = cursorY >= viewportTop + scrollMargin || cursorY < scrollMargin;
    // Either there's space below (cursor not at bottom edge) or cursor is near end of document
    const totalContentHeight = el.visibleLines.length * el.lineHeight;
    const hasMarginBelow = cursorY + el.lineHeight <= viewportBottom - scrollMargin || cursorY + el.lineHeight >= totalContentHeight - scrollMargin;

    expect(hasMarginAbove || hasMarginBelow).to.be.true,
      'Cursor should have comfortable margin from viewport edge after paste';
  });
});
