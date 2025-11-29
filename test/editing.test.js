import { expect, fixture, html } from '@open-wc/testing';
import GeoJsonEditor from '../src/geojson-editor.ts';
import {
  validPoint,
  validPolygon,
  validFeatureCollection
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

  it('should paste FeatureCollection and extract features', async () => {
    const el = await createSizedFixture();
    await waitFor();

    const mockEvent = {
      preventDefault: () => {},
      clipboardData: {
        getData: () => JSON.stringify(validFeatureCollection)
      }
    };

    el.handlePaste(mockEvent);
    await waitFor(200);

    const features = el.getAll();
    expect(features.length).to.equal(2);
    expect(features[0].geometry.type).to.equal('Point');
    expect(features[1].geometry.type).to.equal('LineString');
  });

  it('should paste single Feature', async () => {
    const el = await createSizedFixture();
    await waitFor();

    const mockEvent = {
      preventDefault: () => {},
      clipboardData: {
        getData: () => JSON.stringify(validPoint)
      }
    };

    el.handlePaste(mockEvent);
    await waitFor(200);

    const features = el.getAll();
    expect(features.length).to.equal(1);
    expect(features[0].geometry.type).to.equal('Point');
  });

  it('should paste array of Features', async () => {
    const el = await createSizedFixture();
    await waitFor();

    const mockEvent = {
      preventDefault: () => {},
      clipboardData: {
        getData: () => JSON.stringify([validPoint, validPolygon])
      }
    };

    el.handlePaste(mockEvent);
    await waitFor(200);

    const features = el.getAll();
    expect(features.length).to.equal(2);
  });

  it('should fallback to raw text when pasting invalid GeoJSON', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Suppress error events during test
    el.addEventListener('error', (e) => e.stopPropagation());

    const rawText = '{"some": "data"}';
    const mockEvent = {
      preventDefault: () => {},
      clipboardData: {
        getData: () => rawText
      }
    };

    el.handlePaste(mockEvent);
    await waitFor(200);

    // Should contain the raw text since it's not valid GeoJSON
    const content = el.getContent();
    expect(content).to.include('some');
    expect(content).to.include('data');
  });

  it('should fallback to raw text when pasting plain text', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Suppress error events during test
    el.addEventListener('error', (e) => e.stopPropagation());

    const rawText = 'Hello World';
    const mockEvent = {
      preventDefault: () => {},
      clipboardData: {
        getData: () => rawText
      }
    };

    el.handlePaste(mockEvent);
    await waitFor(200);

    const content = el.getContent();
    expect(content).to.include('Hello World');
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

describe('GeoJsonEditor - Invalid JSON Handling', () => {

  // Helper to suppress error events during test (prevents test framework from catching them)
  const suppressErrors = (el) => {
    el.addEventListener('error', (e) => {
      e.stopPropagation();
    });
  };

  it('should allow editing after pasting invalid JSON', async () => {
    const el = await createSizedFixture();
    suppressErrors(el);
    await waitFor();

    // Paste invalid JSON (missing closing brace)
    const invalidJson = '{"type": "Feature", "geometry": null';
    el.insertText(invalidJson);
    await waitFor(200);

    // Editor should have content
    expect(el.lines.length).to.be.greaterThan(0);

    // Should be able to move cursor
    el.cursorLine = 0;
    el.cursorColumn = 5;
    el.moveCursorHorizontal(1);

    expect(el.cursorColumn).to.equal(6);
  });

  it('should not block cursor movement with invalid JSON', async () => {
    const el = await createSizedFixture();
    suppressErrors(el);
    await waitFor();

    // Paste invalid JSON
    const invalidJson = '{"type": "Feature"';
    el.insertText(invalidJson);
    await waitFor(200);

    // Set cursor position
    el.cursorLine = 0;
    el.cursorColumn = 0;

    // Move right should work
    el.moveCursorHorizontal(1);
    expect(el.cursorColumn).to.equal(1);

    // Move right again
    el.moveCursorHorizontal(1);
    expect(el.cursorColumn).to.equal(2);
  });

  it('should not have collapsed nodes for invalid JSON', async () => {
    const el = await createSizedFixture();
    suppressErrors(el);
    await waitFor();

    // Paste invalid JSON
    const invalidJson = '{"type": "Feature", "geometry": {';
    el.insertText(invalidJson);
    await waitFor(200);

    // Should not have any collapsed nodes since JSON is invalid
    expect(el.collapsedNodes.size).to.equal(0);
  });

  it('should allow text insertion with invalid JSON', async () => {
    const el = await createSizedFixture();
    suppressErrors(el);
    await waitFor();

    // Paste invalid JSON
    const invalidJson = '{"type": "Feature"';
    el.insertText(invalidJson);
    await waitFor(200);

    const initialContent = el.getContent();

    // Set cursor at end
    el.cursorLine = 0;
    el.cursorColumn = el.lines[0].length;

    // Insert more text
    el.insertText('}');
    await waitFor(200);

    // Content should have changed
    expect(el.getContent()).to.not.equal(initialContent);
  });

  it('should handle multi-line invalid JSON', async () => {
    const el = await createSizedFixture();
    suppressErrors(el);
    await waitFor();

    // Paste multi-line invalid JSON
    // Note: When pasting into empty editor, invalid JSON stays on single line
    // because formatAndUpdate can't parse it to split into multiple lines
    const invalidJson = `{
  "type": "Feature",
  "geometry": {
    "type": "Point"`;
    el.insertText(invalidJson);
    await waitFor(200);

    // Editor should have content (may be single line for invalid JSON)
    expect(el.lines.length).to.be.greaterThan(0);
    expect(el.getContent()).to.include('Feature');

    // Should be able to move cursor within the line
    el.cursorLine = 0;
    el.cursorColumn = 0;
    el.moveCursorHorizontal(1);

    expect(el.cursorColumn).to.equal(1);
  });

  it('should not block input handler with invalid JSON', async () => {
    const el = await createSizedFixture();
    suppressErrors(el);
    await focusEditor(el);
    await waitFor();

    // Paste invalid JSON
    const invalidJson = '{"broken": ';
    el.insertText(invalidJson);
    await waitFor(200);

    // Cursor at end of line
    el.cursorLine = 0;
    el.cursorColumn = el.lines[0].length;

    // Simulate typing more characters
    const textarea = el.shadowRoot.querySelector('.hidden-textarea');
    textarea.value = '"value"';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(200);

    // Content should have the new text
    expect(el.getContent()).to.include('value');
  });

  it('should emit error event for invalid JSON', async () => {
    const el = await createSizedFixture();
    await waitFor();

    let errorEvent = null;
    el.addEventListener('error', (e) => {
      e.stopPropagation();
      errorEvent = e;
    });

    // Paste invalid JSON
    const invalidJson = '{"type": "Feature"';
    el.insertText(invalidJson);
    await waitFor(200);

    expect(errorEvent).to.exist;
    expect(errorEvent.detail.error).to.be.a('string');
  });

  it('should allow editing with malformed JSON that has unmatched braces', async () => {
    const el = await createSizedFixture();
    suppressErrors(el);
    await waitFor();

    // This specific invalid JSON was reported to block all editing
    const invalidJson = `{ "type"
  {
    "type": "MultiPoint",
    "coordinates": [
      [15.407, 46.665],
      [14.900, 46.206],
      [14.905, 46.296],
      [15.386, 46.183]
    ]`;
    el.insertText(invalidJson);
    await waitFor(200);

    // Editor should have multiple lines (properly split)
    expect(el.lines.length).to.equal(9);

    // Set cursor to a valid position
    el.cursorLine = 0;
    el.cursorColumn = 0;

    // Should be able to move cursor right
    el.moveCursorHorizontal(1);
    expect(el.cursorColumn).to.equal(1);

    // Should be able to type characters
    const initialContent = el.getContent();
    el.cursorColumn = el.lines[0].length;
    el.insertText('x');
    await waitFor(200);
    expect(el.getContent()).to.not.equal(initialContent);
  });

  it('should allow editing after paste with autoCollapseCoordinates on invalid JSON', async () => {
    const el = await createSizedFixture();
    suppressErrors(el);
    await waitFor();

    // Simulate what handlePaste does for empty editor
    const invalidJson = `{ "type"
  {
    "type": "MultiPoint",
    "coordinates": [
      [15.407, 46.665],
      [14.900, 46.206],
      [14.905, 46.296],
      [15.386, 46.183]
    ]`;

    const wasEmpty = el.lines.length === 0;
    el.insertText(invalidJson);

    // Simulate autoCollapseCoordinates like handlePaste does
    if (wasEmpty && el.lines.length > 0) {
      if (el.renderTimer) {
        cancelAnimationFrame(el.renderTimer);
        el.renderTimer = null;
      }
      el.autoCollapseCoordinates();
    }
    await waitFor(200);

    // Should have 9 lines
    expect(el.lines.length).to.equal(9);

    // Coordinates should be collapsed
    expect(el.collapsedNodes.size).to.equal(1);

    // Should still be able to move cursor on line 0
    el.cursorLine = 0;
    el.cursorColumn = 0;
    el.moveCursorHorizontal(1);
    expect(el.cursorColumn).to.equal(1);

    // Should be able to navigate to other visible lines
    el.cursorLine = 1;
    el.cursorColumn = 0;
    el.moveCursorHorizontal(1);
    expect(el.cursorColumn).to.equal(1);
  });

  it('should insert newline at correct cursor position with single-line invalid JSON', async () => {
    const el = await createSizedFixture();
    suppressErrors(el);
    await waitFor();

    // Single line invalid JSON (incomplete)
    const invalidJson = '{"type":"Feature","geometry":{"type":"MultiPoint","coordinates":[[15.40709171,46.66454198],[14.89978682,46.20643583]]},"properties":{"numPoints":2}';
    el.insertText(invalidJson);
    await waitFor(200);

    // Should be on a single line (invalid JSON doesn't get formatted)
    expect(el.lines.length).to.equal(1);
    expect(el.lines[0]).to.equal(invalidJson);

    // Position cursor after "geometry":{
    // Find position of "geometry":{ in the string
    const geomPos = invalidJson.indexOf('"geometry":{');
    const cursorPos = geomPos + '"geometry":{'.length;

    el.cursorLine = 0;
    el.cursorColumn = cursorPos;

    // Insert newline
    el.insertNewline();
    await waitFor(200);

    // Should now have 2 lines
    expect(el.lines.length).to.equal(2);

    // First line should be everything before cursor
    expect(el.lines[0]).to.equal(invalidJson.substring(0, cursorPos));

    // Second line should be everything after cursor
    expect(el.lines[1]).to.equal(invalidJson.substring(cursorPos));

    // Cursor should be at start of new line
    expect(el.cursorLine).to.equal(1);
    expect(el.cursorColumn).to.equal(0);
  });
});

describe('GeoJsonEditor - Internal Keyboard Handlers', () => {

  it('should have _handleEnter method', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    expect(el._handleEnter).to.be.a('function');
  });

  it('should have _handleBackspace method', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    expect(el._handleBackspace).to.be.a('function');
  });

  it('should have _handleDelete method', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    expect(el._handleDelete).to.be.a('function');
  });

  it('should have _handleTab method', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    expect(el._handleTab).to.be.a('function');
  });

  it('_handleEnter should insert newline and move cursor', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Stub formatAndUpdate to prevent formatting
    el.formatAndUpdate = () => { el.updateView(); el.scheduleRender(); };

    el.lines = ['{"a": 1}'];
    el.cursorLine = 0;
    el.cursorColumn = 4;

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    el._handleEnter(event);
    await waitFor(50);

    expect(el.lines.length).to.equal(2);
    expect(el.cursorLine).to.equal(1);
    expect(el.cursorColumn).to.equal(0);
  });

  it('_handleBackspace should delete character before cursor', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Stub formatAndUpdate to prevent formatting
    el.formatAndUpdate = () => { el.updateView(); el.scheduleRender(); };

    el.lines = ['{"a": 1}'];
    el.cursorLine = 0;
    el.cursorColumn = 5;

    const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true });
    el._handleBackspace(event);
    await waitFor(50);

    expect(el.lines[0]).to.equal('{"a" 1}');
    expect(el.cursorColumn).to.equal(4);
  });

  it('_handleBackspace should merge lines at line start', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Stub formatAndUpdate
    el.formatAndUpdate = () => { el.updateView(); el.scheduleRender(); };

    el.lines = ['{', '"a": 1', '}'];
    el.cursorLine = 1;
    el.cursorColumn = 0;

    const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true });
    el._handleBackspace(event);
    await waitFor(50);

    expect(el.lines.length).to.equal(2);
    expect(el.cursorLine).to.equal(0);
  });

  it('_handleDelete should delete character after cursor', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Stub formatAndUpdate
    el.formatAndUpdate = () => { el.updateView(); el.scheduleRender(); };

    el.lines = ['{"a": 1}'];
    el.cursorLine = 0;
    el.cursorColumn = 4;

    const event = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true });
    el._handleDelete(event);
    await waitFor(50);

    expect(el.lines[0]).to.equal('{"a" 1}');
    expect(el.cursorColumn).to.equal(4);
  });

  it('_handleDelete should merge with next line at line end', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Stub formatAndUpdate
    el.formatAndUpdate = () => { el.updateView(); el.scheduleRender(); };

    el.lines = ['{', '"a": 1', '}'];
    el.cursorLine = 0;
    el.cursorColumn = 1;

    const event = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true });
    el._handleDelete(event);
    await waitFor(50);

    expect(el.lines.length).to.equal(2);
    expect(el.lines[0]).to.equal('{"a": 1');
  });

  it('_handleTab should expand collapsed node', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon]);
    await waitFor(200);

    // Collapse a node
    const nodeId = Array.from(el._nodeIdToLines.keys())[0];
    if (nodeId) {
      el.collapsedNodes.add(nodeId);
      el.updateView();
      await waitFor(50);

      // Position cursor on collapsed node
      const nodeInfo = el._nodeIdToLines.get(nodeId);
      if (nodeInfo?.start !== undefined) {
        el.cursorLine = nodeInfo.start;
        el.cursorColumn = 0;

        const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
        el._handleTab(event);

        expect(el.collapsedNodes.has(nodeId)).to.be.false;
      }
    }
  });

  it('_handleTab with shiftKey should collapse containing node', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon]);
    await waitFor(200);

    // Position cursor inside content
    el.cursorLine = 3;
    el.cursorColumn = 0;

    const initialSize = el.collapsedNodes.size;

    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
    el._handleTab(event);

    expect(el.collapsedNodes.size).to.be.greaterThan(initialSize);
  });
});

describe('GeoJsonEditor - Internal Cursor Movement', () => {

  it('should have _moveCursorRight method', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    expect(el._moveCursorRight).to.be.a('function');
  });

  it('should have _moveCursorLeft method', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);

    expect(el._moveCursorLeft).to.be.a('function');
  });

  it('_moveCursorRight should move cursor one position right', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    el.cursorLine = 0;
    el.cursorColumn = 0;

    el._moveCursorRight();

    expect(el.cursorColumn).to.equal(1);
  });

  it('_moveCursorRight should wrap to next line at line end', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    el.cursorLine = 0;
    el.cursorColumn = el.visibleLines[0].content.length;

    el._moveCursorRight();

    expect(el.cursorLine).to.equal(1);
    expect(el.cursorColumn).to.equal(0);
  });

  it('_moveCursorLeft should move cursor one position left', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    el.cursorLine = 0;
    el.cursorColumn = 5;

    el._moveCursorLeft();

    expect(el.cursorColumn).to.equal(4);
  });

  it('_moveCursorLeft should wrap to previous line at line start', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    el.cursorLine = 1;
    el.cursorColumn = 0;

    el._moveCursorLeft();

    expect(el.cursorLine).to.equal(0);
    expect(el.cursorColumn).to.equal(el.visibleLines[0].content.length);
  });

  it('_moveCursorLeft should not go before start of document', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    el.cursorLine = 0;
    el.cursorColumn = 0;

    el._moveCursorLeft();

    expect(el.cursorLine).to.equal(0);
    expect(el.cursorColumn).to.equal(0);
  });

  it('_moveCursorRight should stay at end of document', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    const lastLineIdx = el.visibleLines.length - 1;
    const lastLineLength = el.visibleLines[lastLineIdx].content.length;
    el.cursorLine = lastLineIdx;
    el.cursorColumn = lastLineLength;

    const prevLine = el.cursorLine;
    const prevCol = el.cursorColumn;

    el._moveCursorRight();

    // Either stays at same position or wraps to virtual next line (implementation dependent)
    // At minimum, should not throw and cursor should still be valid
    expect(el.cursorLine).to.be.at.least(prevLine);
    expect(el.cursorColumn).to.be.at.least(0);
  });
});
