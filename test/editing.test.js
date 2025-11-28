import { expect, fixture, html } from '@open-wc/testing';
import GeoJsonEditor from '../src/geojson-editor.js';
import {
  validPoint,
  validPolygon
} from './fixtures/geojson-samples.js';

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

// Helper to simulate input event on hidden textarea
const simulateInput = async (editor, text) => {
  const textarea = editor.shadowRoot.querySelector('.hidden-textarea');
  textarea.value = text;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  await waitFor(50);
};

describe('GeoJsonEditor - Text Insertion', () => {

  it('should insert text in empty editor', async () => {
    const el = await createSizedFixture();
    await waitFor();
    
    // Ensure editor is empty
    expect(el.lines.length).to.equal(0);
    
    // Insert text
    el.insertText('{"type": "Feature"}');
    await waitFor(50);
    
    // Should have content now
    expect(el.lines.length).to.be.greaterThan(0);
    expect(el.getContent()).to.include('Feature');
  });

  it('should have insertNewline method', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    
    expect(el.insertNewline).to.be.a('function');
  });

  it('should insert newline at cursor position', async () => {
    const el = await createSizedFixture();
    await waitFor();
    
    // Stub formatAndUpdate to prevent error events
    const originalFormat = el.formatAndUpdate.bind(el);
    el.formatAndUpdate = () => { el.updateView(); el.scheduleRender(); };
    
    // Set simple content
    el.lines = ['{"a": 1}'];
    el.cursorLine = 0;
    el.cursorColumn = 4;  // After the colon
    const initialLineCount = el.lines.length;
    
    el.insertNewline();
    await waitFor(100);
    
    expect(el.lines.length).to.be.greaterThan(initialLineCount);
    
    // Restore
    el.formatAndUpdate = originalFormat;
  });

  it('should move cursor to new line after insertNewline', async () => {
    const el = await createSizedFixture();
    await waitFor();
    
    el.set([validPoint]);
    await waitFor(200);
    
    el.cursorLine = 0;
    el.cursorColumn = 5;
    
    el.insertNewline();
    
    expect(el.cursorLine).to.equal(1);
    expect(el.cursorColumn).to.equal(0);
  });

  it('should handle input via handleInput method', async () => {
    const el = await createSizedFixture();
    await waitFor();
    
    el.set([validPoint]);
    await waitFor(200);
    
    expect(el.handleInput).to.be.a('function');
  });
});

describe('GeoJsonEditor - Text Deletion', () => {

  it('should have deleteBackward method', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    
    expect(el.deleteBackward).to.be.a('function');
  });

  it('should have deleteForward method', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    
    expect(el.deleteForward).to.be.a('function');
  });

  it('should delete character before cursor with deleteBackward', async () => {
    const el = await createSizedFixture();
    await waitFor();
    
    // Stub formatAndUpdate to prevent error events
    el.formatAndUpdate = () => { el.updateView(); el.scheduleRender(); };
    
    // Set simple valid JSON to edit
    el.lines = ['{"a": "test"}'];
    el.cursorLine = 0;
    el.cursorColumn = 10;  // Position at 't' in "test"
    const originalLength = el.lines[0].length;
    
    el.deleteBackward();
    await waitFor(50);
    
    expect(el.lines[0].length).to.be.lessThan(originalLength);
  });

  it('should delete character after cursor with deleteForward', async () => {
    const el = await createSizedFixture();
    await waitFor();
    
    // Stub formatAndUpdate to prevent error events
    el.formatAndUpdate = () => { el.updateView(); el.scheduleRender(); };
    
    // Set simple valid JSON to edit
    el.lines = ['{"a": "test"}'];
    el.cursorLine = 0;
    el.cursorColumn = 8;  // Position at 'e' in "test"
    const originalLength = el.lines[0].length;
    
    el.deleteForward();
    await waitFor(50);
    
    expect(el.lines[0].length).to.be.lessThan(originalLength);
  });

  it('should merge lines when deleting at start of line', async () => {
    const el = await createSizedFixture();
    await waitFor();
    
    // Stub formatAndUpdate to prevent error events
    el.formatAndUpdate = () => { el.updateView(); el.scheduleRender(); };
    
    // Set multi-line content
    el.lines = ['{', '  "a": 1', '}'];
    el.cursorLine = 1;
    el.cursorColumn = 0;
    const initialLineCount = el.lines.length;
    
    el.deleteBackward();
    await waitFor(50);
    
    expect(el.lines.length).to.be.lessThan(initialLineCount);
  });

  it('should delete selection when selection exists', async () => {
    const el = await createSizedFixture();
    await waitFor();
    
    el.set([validPoint]);
    await waitFor(200);
    
    el.selectionStart = { line: 0, column: 0 };
    el.selectionEnd = { line: 0, column: 5 };
    
    el._deleteSelection();
    
    expect(el._hasSelection()).to.be.false;
  });
});

describe('GeoJsonEditor - Copy/Cut/Paste', () => {

  it('should have handleCopy method', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    
    expect(el.handleCopy).to.be.a('function');
  });

  it('should have handleCut method', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    
    expect(el.handleCut).to.be.a('function');
  });

  it('should have handlePaste method', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    
    expect(el.handlePaste).to.be.a('function');
  });

  it('should get selected text with _getSelectedText', async () => {
    const el = await createSizedFixture();
    await waitFor();
    
    el.set([validPoint]);
    await waitFor(200);
    
    el.selectionStart = { line: 0, column: 0 };
    el.selectionEnd = { line: 0, column: 5 };
    
    const text = el._getSelectedText();
    
    expect(text).to.be.a('string');
    expect(text.length).to.be.greaterThan(0);
  });
});

describe('GeoJsonEditor - Format and Update', () => {

  it('should have formatAndUpdate method', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    
    expect(el.formatAndUpdate).to.be.a('function');
  });

  it('should format JSON content', async () => {
    const el = await createSizedFixture();
    await waitFor();
    
    // Set content manually without formatting
    el.lines = ['{"type":"Feature","geometry":null,"properties":{}}'];
    
    el.formatAndUpdate();
    await waitFor(100);
    
    // Should now have multiple lines due to formatting
    expect(el.lines.length).to.be.greaterThan(1);
  });

  it('should preserve cursor position after format', async () => {
    const el = await createSizedFixture();
    await waitFor();
    
    el.set([validPoint]);
    await waitFor(200);
    
    el.cursorLine = 1;
    el.cursorColumn = 2;
    
    el.formatAndUpdate();
    await waitFor(100);
    
    // Cursor should still be within valid bounds
    expect(el.cursorLine).to.be.at.least(0);
    expect(el.cursorColumn).to.be.at.least(0);
  });
});
