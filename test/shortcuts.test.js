import { expect, fixture, html } from '@open-wc/testing';
import GeoJsonEditor from '../src/geojson-editor.ts';
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

// Helper to stub formatAndUpdate and emitChange to avoid JSON parsing errors
const stubEditorMethods = (el) => {
  el.formatAndUpdate = () => { el.updateView(); el.scheduleRender(); };
  el.emitChange = () => {}; // Suppress change events in tests
};

describe('GeoJsonEditor - Undo/Redo Shortcuts', () => {

  it('should handle Ctrl+Z keyboard shortcut for undo', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"a": 1}'];
    el.cursorLine = 0;
    el.cursorColumn = 0;

    const originalLine = el.lines[0];

    el.insertText('X');
    await waitFor(100);

    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(100);

    expect(el.lines[0]).to.equal(originalLine);
  });

  it('should handle Cmd+Z keyboard shortcut for undo (macOS)', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"a": 1}'];
    el.cursorLine = 0;
    el.cursorColumn = 0;

    const originalLine = el.lines[0];

    el.insertText('X');
    await waitFor(100);

    const event = new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(100);

    expect(el.lines[0]).to.equal(originalLine);
  });

  it('should handle Ctrl+Shift+Z keyboard shortcut for redo', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"a": 1}'];
    el.cursorLine = 0;
    el.cursorColumn = 0;

    el.insertText('X');
    await waitFor(100);

    const modifiedLine = el.lines[0];

    el.undo();
    await waitFor(100);

    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(100);

    expect(el.lines[0]).to.equal(modifiedLine);
  });

  it('should handle Cmd+Shift+Z keyboard shortcut for redo (macOS)', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"a": 1}'];
    el.cursorLine = 0;
    el.cursorColumn = 0;

    el.insertText('X');
    await waitFor(100);

    const modifiedLine = el.lines[0];

    el.undo();
    await waitFor(100);

    const event = new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      shiftKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(100);

    expect(el.lines[0]).to.equal(modifiedLine);
  });

  it('should handle Ctrl+Y keyboard shortcut for redo', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"a": 1}'];
    el.cursorLine = 0;
    el.cursorColumn = 0;

    el.insertText('X');
    await waitFor(100);

    const modifiedLine = el.lines[0];

    el.undo();
    await waitFor(100);

    const event = new KeyboardEvent('keydown', {
      key: 'y',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(100);

    expect(el.lines[0]).to.equal(modifiedLine);
  });

  it('should handle Cmd+Y keyboard shortcut for redo (macOS)', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"a": 1}'];
    el.cursorLine = 0;
    el.cursorColumn = 0;

    el.insertText('X');
    await waitFor(100);

    const modifiedLine = el.lines[0];

    el.undo();
    await waitFor(100);

    const event = new KeyboardEvent('keydown', {
      key: 'y',
      metaKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(100);

    expect(el.lines[0]).to.equal(modifiedLine);
  });
});

describe('GeoJsonEditor - Save Shortcuts', () => {

  it('should handle Ctrl+S keyboard shortcut', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    let saveCalled = false;
    const originalSave = el.save.bind(el);
    el.save = () => { saveCalled = true; return originalSave(); };

    const originalCreateElement = document.createElement.bind(document);
    document.createElement = (tag) => {
      const elem = originalCreateElement(tag);
      if (tag === 'a') {
        elem.click = () => {};
      }
      return elem;
    };

    const event = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);

    expect(saveCalled).to.be.true;

    document.createElement = originalCreateElement;
  });

  it('should handle Cmd+S keyboard shortcut (macOS)', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    let saveCalled = false;
    const originalSave = el.save.bind(el);
    el.save = () => { saveCalled = true; return originalSave(); };

    const originalCreateElement = document.createElement.bind(document);
    document.createElement = (tag) => {
      const elem = originalCreateElement(tag);
      if (tag === 'a') {
        elem.click = () => {};
      }
      return elem;
    };

    const event = new KeyboardEvent('keydown', {
      key: 's',
      metaKey: true,
      bubbles: true
    });
    el.handleKeydown(event);

    expect(saveCalled).to.be.true;

    document.createElement = originalCreateElement;
  });
});

describe('GeoJsonEditor - Open Shortcuts', () => {

  it('should handle Ctrl+O keyboard shortcut', async () => {
    const el = await createSizedFixture();
    await waitFor();

    let openCalled = false;
    el.open = () => { openCalled = true; return Promise.resolve(false); };

    const event = new KeyboardEvent('keydown', {
      key: 'o',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);

    expect(openCalled).to.be.true;
  });

  it('should handle Cmd+O keyboard shortcut (macOS)', async () => {
    const el = await createSizedFixture();
    await waitFor();

    let openCalled = false;
    el.open = () => { openCalled = true; return Promise.resolve(false); };

    const event = new KeyboardEvent('keydown', {
      key: 'o',
      metaKey: true,
      bubbles: true
    });
    el.handleKeydown(event);

    expect(openCalled).to.be.true;
  });

  it('should block Ctrl+O in readonly mode', async () => {
    const el = await fixture(html`<geojson-editor readonly style="height: 400px; width: 600px;"></geojson-editor>`);
    await waitFor();

    let openCalled = false;
    el.open = () => { openCalled = true; return Promise.resolve(false); };

    const event = new KeyboardEvent('keydown', {
      key: 'o',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);

    expect(openCalled).to.be.false;
  });

  it('should block Cmd+O in readonly mode (macOS)', async () => {
    const el = await fixture(html`<geojson-editor readonly style="height: 400px; width: 600px;"></geojson-editor>`);
    await waitFor();

    let openCalled = false;
    el.open = () => { openCalled = true; return Promise.resolve(false); };

    const event = new KeyboardEvent('keydown', {
      key: 'o',
      metaKey: true,
      bubbles: true
    });
    el.handleKeydown(event);

    expect(openCalled).to.be.false;
  });
});

describe('GeoJsonEditor - Collapse/Expand Shortcuts', () => {

  it('should expand collapsed node with Enter', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon]);
    await waitFor(200);

    // Find a collapsed node
    const nodeId = Array.from(el._nodeIdToLines.keys())[0];
    if (nodeId) {
      el.collapsedNodes.add(nodeId);
      el.updateView();
      el.scheduleRender();
      await waitFor(100);

      // Position cursor at the collapsed line
      const nodeInfo = el._nodeIdToLines.get(nodeId);
      if (nodeInfo) {
        el.cursorLine = nodeInfo.startLine;
        el.cursorColumn = 0;

        const event = new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true
        });
        el.handleKeydown(event);
        await waitFor(100);

        // Should be expanded now
        expect(el.collapsedNodes.has(nodeId)).to.be.false;
      }
    }
  });

  it('should collapse node with Shift+Enter', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon], { collapsed: [] }); // Start with nothing collapsed
    await waitFor(200);

    // Find a collapsible node
    const ranges = el._findCollapsibleRanges();
    const range = ranges.find(r => r.nodeKey === 'geometry');

    if (range) {
      // Position cursor inside the geometry node
      el.cursorLine = range.startLine + 1;
      el.cursorColumn = 0;

      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        shiftKey: true,
        bubbles: true
      });
      el.handleKeydown(event);
      await waitFor(100);

      // Should be collapsed now
      expect(el.collapsedNodes.has(range.nodeId)).to.be.true;
    }
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

    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(100);

    // Should have moved cursor (to attribute or bracket position)
    expect(el.cursorColumn).to.be.greaterThan(initialColumn);
  });

  it('should navigate to previous attribute with Shift+Tab', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon], { collapsed: [] });
    await waitFor(200);

    // Position on a line with attributes (line 1 should have "type": "Feature")
    // Find a line with content
    let startLine = 1;
    while (startLine < el.lines.length && el.lines[startLine].trim().length < 5) {
      startLine++;
    }
    el.cursorLine = startLine;
    const initialColumn = el.lines[startLine]?.length || 0;
    el.cursorColumn = initialColumn;

    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(100);

    // Should have moved cursor backward (to attribute or bracket position)
    expect(el.cursorColumn).to.be.lessThan(initialColumn);
  });

  it('should navigate Tab to standalone numbers in arrays', async () => {
    const el = await createSizedFixture();
    await waitFor();

    // Use a LineString which has standalone coordinate numbers
    const lineString = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[2.55, 49.01], [105.8, 21.2]]
      },
      properties: {}
    };
    el.set([lineString], { collapsed: [] });
    await waitFor(200);

    // Find line with first coordinate number
    const numLineIdx = el.lines.findIndex(line => line.includes('2.55'));
    expect(numLineIdx).to.be.greaterThan(-1);

    // Position before the number
    el.cursorLine = numLineIdx;
    el.cursorColumn = 0;

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    el.handleKeydown(event);
    await waitFor(100);

    // Should have moved to the number position
    const line = el.lines[el.cursorLine];
    const numPos = line.indexOf('2.55');
    expect(el.cursorColumn).to.equal(numPos);
  });

  it('should navigate Shift+Tab backward through standalone numbers', async () => {
    const el = await createSizedFixture();
    await waitFor();

    const lineString = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[2.55, 49.01], [105.8, 21.2]]
      },
      properties: {}
    };
    el.set([lineString], { collapsed: [] });
    await waitFor(200);

    // Find properties line and start from there
    const propsLineIdx = el.lines.findIndex(line => line.includes('"properties"'));
    expect(propsLineIdx).to.be.greaterThan(-1);

    el.cursorLine = propsLineIdx;
    el.cursorColumn = el.lines[propsLineIdx].length;

    // Navigate backward multiple times - should pass through numbers
    let foundNumber = false;
    for (let i = 0; i < 20; i++) {
      const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
      el.handleKeydown(event);
      await waitFor(50);

      const currentLine = el.lines[el.cursorLine];
      // Check if we landed on a number
      if (/^\s*-?\d+\.?\d*/.test(currentLine)) {
        foundNumber = true;
        break;
      }
    }

    expect(foundNumber).to.be.true;
  });

  it('should stop Tab on opening brackets of expanded nodes', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon], { collapsed: [] });
    await waitFor(200);

    // Find geometry line with opening bracket
    const geometryLineIdx = el.lines.findIndex(line => line.includes('"geometry"'));
    expect(geometryLineIdx).to.be.greaterThan(-1);

    // Position before geometry
    el.cursorLine = geometryLineIdx;
    el.cursorColumn = 0;

    // Tab should first go to "geometry" key, then to the bracket
    const event1 = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    el.handleKeydown(event1);
    await waitFor(50);

    const event2 = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    el.handleKeydown(event2);
    await waitFor(50);

    // Should be positioned after the bracket
    const line = el.lines[el.cursorLine];
    const bracketPos = line.indexOf('{');
    if (bracketPos >= 0) {
      expect(el.cursorColumn).to.equal(bracketPos + 1);
    }
  });

  it('should do nothing when Enter on expanded node', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon], { collapsed: [] });
    await waitFor(200);

    // Find geometry line (expanded node)
    const geometryLineIdx = el.lines.findIndex(line => line.includes('"geometry"'));
    const geometryLine = el.lines[geometryLineIdx];
    const bracketPos = geometryLine.indexOf('{');

    el.cursorLine = geometryLineIdx;
    el.cursorColumn = bracketPos + 1; // After the bracket

    const initialLines = el.lines.length;
    const initialCursorLine = el.cursorLine;
    const initialCursorColumn = el.cursorColumn;

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    el.handleKeydown(event);
    await waitFor(100);

    // Nothing should have changed
    expect(el.lines.length).to.equal(initialLines);
    expect(el.cursorLine).to.equal(initialCursorLine);
    expect(el.cursorColumn).to.equal(initialCursorColumn);
  });

  it('should collapse node with Shift+Enter from deep inside', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPolygon], { collapsed: [] });
    await waitFor(200);

    // Find coordinates line (deep inside geometry)
    const coordsLineIdx = el.lines.findIndex(line => line.includes('"coordinates"'));
    expect(coordsLineIdx).to.be.greaterThan(-1);

    // Position cursor on coordinates line
    el.cursorLine = coordsLineIdx;
    el.cursorColumn = 5;

    const initialCollapsed = el.collapsedNodes.size;

    const event = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true });
    el.handleKeydown(event);
    await waitFor(100);

    // Should have collapsed something (the innermost containing node)
    expect(el.collapsedNodes.size).to.be.greaterThan(initialCollapsed);
  });

});

describe('GeoJsonEditor - Word Navigation Shortcuts', () => {

  it('should move cursor to next word with Ctrl+ArrowRight', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"hello": "world"}'];
    el.cursorLine = 0;
    el.cursorColumn = 2; // At 'h' of hello
    el.updateModel();
    el.scheduleRender();
    await waitFor(100);

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(100);

    // Should jump past 'hello' to the next boundary
    expect(el.cursorColumn).to.be.greaterThan(6);
  });

  it('should move cursor to previous word with Ctrl+ArrowLeft', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"hello": "world"}'];
    el.cursorLine = 0;
    el.cursorColumn = 12; // At 'w' of world
    el.updateModel();
    el.scheduleRender();
    await waitFor(100);

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(100);

    // Should jump back to before 'world'
    expect(el.cursorColumn).to.be.lessThan(12);
  });

  it('should select word with Ctrl+Shift+ArrowRight', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"hello": "world"}'];
    el.cursorLine = 0;
    el.cursorColumn = 2; // At 'h' of hello
    el.selectionStart = null;
    el.selectionEnd = null;
    el.updateModel();
    el.scheduleRender();
    await waitFor(100);

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(100);

    // Should have a selection
    expect(el.selectionStart).to.exist;
    expect(el.selectionEnd).to.exist;
    expect(el.selectionStart.column).to.equal(2);
    expect(el.selectionEnd.column).to.be.greaterThan(6);
  });

  it('should select word with Ctrl+Shift+ArrowLeft', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"hello": "world"}'];
    el.cursorLine = 0;
    el.cursorColumn = 16; // At end of 'world'
    el.selectionStart = null;
    el.selectionEnd = null;
    el.updateModel();
    el.scheduleRender();
    await waitFor(100);

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(100);

    // Should have a selection
    expect(el.selectionStart).to.exist;
    expect(el.selectionEnd).to.exist;
    expect(el.selectionStart.column).to.equal(16);
    expect(el.selectionEnd.column).to.be.lessThan(16);
  });

  it('should move cursor with Cmd+ArrowRight (macOS)', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"hello": "world"}'];
    el.cursorLine = 0;
    el.cursorColumn = 2;
    el.updateModel();
    el.scheduleRender();
    await waitFor(100);

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      metaKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(100);

    expect(el.cursorColumn).to.be.greaterThan(6);
  });

  it('should select word with Cmd+Shift+ArrowRight (macOS)', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"hello": "world"}'];
    el.cursorLine = 0;
    el.cursorColumn = 2;
    el.selectionStart = null;
    el.selectionEnd = null;
    el.updateModel();
    el.scheduleRender();
    await waitFor(100);

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      metaKey: true,
      shiftKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(100);

    expect(el.selectionStart).to.exist;
    expect(el.selectionEnd).to.exist;
  });

  it('should move to next line when at end of line with Ctrl+ArrowRight', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"a": 1}', '{"b": 2}'];
    el.cursorLine = 0;
    el.cursorColumn = 8; // End of first line
    el.updateModel();
    el.scheduleRender();
    await waitFor(100);

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(100);

    // Should be on second line
    expect(el.cursorLine).to.equal(1);
    expect(el.cursorColumn).to.equal(0);
  });

  it('should move to previous line when at start of line with Ctrl+ArrowLeft', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"a": 1}', '{"b": 2}'];
    el.cursorLine = 1;
    el.cursorColumn = 0; // Start of second line
    el.updateModel();
    el.scheduleRender();
    await waitFor(100);

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(100);

    // Should be at end of first line
    expect(el.cursorLine).to.equal(0);
    expect(el.cursorColumn).to.equal(8);
  });

  it('should skip collapsed node with Ctrl+ArrowRight', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    // Simulate a collapsed coordinates array
    el.lines = [
      '{',
      '  "coordinates": [',
      '    1,',
      '    2',
      '  ]',
      '}'
    ];
    el.updateModel();
    await waitFor(100);

    // Collapse the coordinates node (line 1)
    const nodeId = el._lineToNodeId.get(1);
    if (nodeId) {
      el.collapsedNodes.add(nodeId);
    }
    el.updateView();
    el.scheduleRender();
    await waitFor(100);

    // Position cursor at the bracket on line 1
    el.cursorLine = 1;
    el.cursorColumn = 17; // At the '['

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(100);

    // Should jump to closing line (line 4: "  ]")
    expect(el.cursorLine).to.equal(4);
    expect(el.cursorColumn).to.equal(el.lines[4].length);
  });

  it('should skip collapsed node with Ctrl+ArrowLeft from closing line', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    // Simulate a collapsed coordinates array
    el.lines = [
      '{',
      '  "coordinates": [',
      '    1,',
      '    2',
      '  ]',
      '}'
    ];
    el.updateModel();
    await waitFor(100);

    // Collapse the coordinates node (line 1)
    const nodeId = el._lineToNodeId.get(1);
    if (nodeId) {
      el.collapsedNodes.add(nodeId);
    }
    el.updateView();
    el.scheduleRender();
    await waitFor(100);

    // Position cursor at the closing bracket on line 4
    el.cursorLine = 4;
    el.cursorColumn = 3; // At the ']'

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(100);

    // Should jump to opening line (line 1), at the '['
    expect(el.cursorLine).to.equal(1);
    expect(el.cursorColumn).to.equal(17); // Position of '['
  });

  it('should skip collapsed zone when moving to next line with Ctrl+ArrowRight', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = [
      '{',
      '  "a": [',
      '    1',
      '  ],',
      '  "b": 2',
      '}'
    ];
    el.updateModel();
    await waitFor(100);

    // Collapse the "a" array (line 1)
    const nodeId = el._lineToNodeId.get(1);
    if (nodeId) {
      el.collapsedNodes.add(nodeId);
    }
    el.updateView();
    el.scheduleRender();
    await waitFor(100);

    // Position cursor at end of opening line, after the bracket
    el.cursorLine = 1;
    el.cursorColumn = 8; // After the '['

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(100);

    // Should skip the collapsed content and land on the closing line
    expect(el.cursorLine).to.equal(3);
    expect(el.cursorColumn).to.equal(el.lines[3].length);
  });
});

describe('GeoJsonEditor - Copy/Paste Shortcuts', () => {

  it('should handle Ctrl+A to select all', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    const event = new KeyboardEvent('keydown', {
      key: 'a',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(100);

    // Selection should cover all content
    expect(el.selectionStart).to.exist;
    expect(el.selectionEnd).to.exist;
    expect(el.selectionStart.line).to.equal(0);
    expect(el.selectionStart.column).to.equal(0);
  });

  it('should handle Cmd+A to select all (macOS)', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    const event = new KeyboardEvent('keydown', {
      key: 'a',
      metaKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(100);

    // Selection should cover all content
    expect(el.selectionStart).to.exist;
    expect(el.selectionEnd).to.exist;
    expect(el.selectionStart.line).to.equal(0);
    expect(el.selectionStart.column).to.equal(0);
  });

  it('should copy selected text via handleCopy', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    // Select some text
    el.selectionStart = { line: 0, column: 0 };
    el.selectionEnd = { line: 0, column: 5 };

    let copiedText = '';
    const clipboardData = {
      setData: (type, data) => { copiedText = data; }
    };
    const event = { preventDefault: () => {}, clipboardData };

    el.handleCopy(event);

    expect(copiedText.length).to.be.greaterThan(0);
  });

  it('should copy all content when no selection via handleCopy', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    // No selection
    el.selectionStart = null;
    el.selectionEnd = null;

    let copiedText = '';
    const clipboardData = {
      setData: (type, data) => { copiedText = data; }
    };
    const event = { preventDefault: () => {}, clipboardData };

    el.handleCopy(event);

    // Should copy all content
    expect(copiedText).to.include('"type"');
    expect(copiedText).to.include('Feature');
  });

  it('should cut selected text via handleCut', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"test": "value"}'];
    el.cursorLine = 0;
    el.cursorColumn = 0;

    // Select some text
    el.selectionStart = { line: 0, column: 0 };
    el.selectionEnd = { line: 0, column: 5 };

    let cutText = '';
    const clipboardData = {
      setData: (type, data) => { cutText = data; }
    };
    const event = { preventDefault: () => {}, clipboardData };

    el.handleCut(event);
    await waitFor(100);

    expect(cutText.length).to.be.greaterThan(0);
    // Selection should be cleared after cut
    expect(el.selectionStart).to.be.null;
  });

  it('should cut all content when no selection via handleCut', async () => {
    const el = await createSizedFixture();
    await waitFor();

    stubEditorMethods(el);

    el.lines = ['{"test": "value"}'];
    el.cursorLine = 0;
    el.cursorColumn = 0;
    el.selectionStart = null;
    el.selectionEnd = null;

    let cutText = '';
    const clipboardData = {
      setData: (type, data) => { cutText = data; }
    };
    const event = { preventDefault: () => {}, clipboardData };

    el.handleCut(event);
    await waitFor(100);

    expect(cutText).to.include('test');
    // All content should be removed
    expect(el.lines.length).to.equal(0);
  });
});

describe('GeoJsonEditor - Ctrl+I Add Feature Shortcut', () => {

  it('should have internalAddShortcut property', async () => {
    const el = await createSizedFixture();
    expect(el.internalAddShortcut).to.be.false;
  });

  it('should enable internal add shortcut via attribute', async () => {
    const el = await fixture(html`<geojson-editor internal-add-shortcut></geojson-editor>`);
    expect(el.internalAddShortcut).to.be.true;
  });

  it('should not trigger add prompt when attribute is not set', async () => {
    const el = await createSizedFixture();
    await waitFor();

    let promptCalled = false;
    const originalPrompt = window.prompt;
    window.prompt = () => { promptCalled = true; return null; };

    const event = new KeyboardEvent('keydown', {
      key: 'i',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(50);

    window.prompt = originalPrompt;
    expect(promptCalled).to.be.false;
  });

  it('should trigger add prompt when attribute is set', async () => {
    const el = await fixture(html`<geojson-editor internal-add-shortcut style="height: 400px; width: 600px;"></geojson-editor>`);
    await waitFor();

    let promptCalled = false;
    const originalPrompt = window.prompt;
    window.prompt = () => { promptCalled = true; return null; };

    const event = new KeyboardEvent('keydown', {
      key: 'i',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(50);

    window.prompt = originalPrompt;
    expect(promptCalled).to.be.true;
  });

  it('should not trigger add prompt in readonly mode', async () => {
    const el = await fixture(html`<geojson-editor internal-add-shortcut readonly style="height: 400px; width: 600px;"></geojson-editor>`);
    await waitFor();

    let promptCalled = false;
    const originalPrompt = window.prompt;
    window.prompt = () => { promptCalled = true; return null; };

    const event = new KeyboardEvent('keydown', {
      key: 'i',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(50);

    window.prompt = originalPrompt;
    expect(promptCalled).to.be.false;
  });

  it('should add feature when valid JSON is entered', async () => {
    const el = await fixture(html`<geojson-editor internal-add-shortcut style="height: 400px; width: 600px;"></geojson-editor>`);
    await waitFor();

    const originalPrompt = window.prompt;
    window.prompt = () => JSON.stringify(validPoint);

    const initialCount = el.getAll().length;

    const event = new KeyboardEvent('keydown', {
      key: 'i',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(200);

    window.prompt = originalPrompt;
    expect(el.getAll().length).to.equal(initialCount + 1);
  });

  it('should add multiple features from FeatureCollection', async () => {
    const el = await fixture(html`<geojson-editor internal-add-shortcut style="height: 400px; width: 600px;"></geojson-editor>`);
    await waitFor();

    const originalPrompt = window.prompt;
    const featureCollection = {
      type: 'FeatureCollection',
      features: [validPoint, validPolygon]
    };
    window.prompt = () => JSON.stringify(featureCollection);

    const initialCount = el.getAll().length;

    const event = new KeyboardEvent('keydown', {
      key: 'i',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(200);

    window.prompt = originalPrompt;
    expect(el.getAll().length).to.equal(initialCount + 2);
  });

  it('should ignore invalid JSON input', async () => {
    const el = await fixture(html`<geojson-editor internal-add-shortcut style="height: 400px; width: 600px;"></geojson-editor>`);
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    const originalPrompt = window.prompt;
    window.prompt = () => 'not valid json {{{';

    const initialCount = el.getAll().length;

    const event = new KeyboardEvent('keydown', {
      key: 'i',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(200);

    window.prompt = originalPrompt;
    expect(el.getAll().length).to.equal(initialCount);
  });

  it('should ignore empty input', async () => {
    const el = await fixture(html`<geojson-editor internal-add-shortcut style="height: 400px; width: 600px;"></geojson-editor>`);
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    const originalPrompt = window.prompt;
    window.prompt = () => '';

    const initialCount = el.getAll().length;

    const event = new KeyboardEvent('keydown', {
      key: 'i',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(200);

    window.prompt = originalPrompt;
    expect(el.getAll().length).to.equal(initialCount);
  });

  it('should ignore cancelled prompt', async () => {
    const el = await fixture(html`<geojson-editor internal-add-shortcut style="height: 400px; width: 600px;"></geojson-editor>`);
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    const originalPrompt = window.prompt;
    window.prompt = () => null; // User cancelled

    const initialCount = el.getAll().length;

    const event = new KeyboardEvent('keydown', {
      key: 'i',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(200);

    window.prompt = originalPrompt;
    expect(el.getAll().length).to.equal(initialCount);
  });

  it('should preserve collapsed state of existing features when adding via Ctrl+I', async () => {
    const el = await fixture(html`<geojson-editor internal-add-shortcut style="height: 400px; width: 600px;"></geojson-editor>`);
    await waitFor();

    // Set initial feature with coordinates collapsed
    el.set([validPolygon], { collapsed: ['coordinates'] });
    await waitFor(200);

    // Verify coordinates is collapsed
    const rangesBefore = el._findCollapsibleRanges();
    const coordsRangeBefore = rangesBefore.find(r => r.nodeKey === 'coordinates');
    expect(el.collapsedNodes.has(coordsRangeBefore.nodeId)).to.be.true;

    // Add a new feature via Ctrl+I
    const originalPrompt = window.prompt;
    window.prompt = () => JSON.stringify(validPoint);

    const event = new KeyboardEvent('keydown', {
      key: 'i',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);
    await waitFor(200);

    window.prompt = originalPrompt;

    // Verify we now have 2 features
    expect(el.getAll().length).to.equal(2);

    // Verify the first feature's coordinates is STILL collapsed (state preserved)
    const rangesAfter = el._findCollapsibleRanges();
    const coordsRangesAfter = rangesAfter.filter(r => r.nodeKey === 'coordinates');
    // First feature should still have coordinates collapsed
    const firstFeatureCoords = coordsRangesAfter[0];
    expect(el.collapsedNodes.has(firstFeatureCoords.nodeId)).to.be.true;
  });
});

describe('GeoJsonEditor - Home/End Navigation', () => {

  it('should move cursor to start of line with Home', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    // Position cursor in middle of a line
    el.cursorLine = 1;
    el.cursorColumn = 5;

    const event = new KeyboardEvent('keydown', {
      key: 'Home',
      bubbles: true
    });
    el.handleKeydown(event);

    expect(el.cursorLine).to.equal(1);
    expect(el.cursorColumn).to.equal(0);
  });

  it('should stay at start of line when Home pressed twice (no document jump)', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    // Position cursor on line 2, column 5
    el.cursorLine = 2;
    el.cursorColumn = 5;

    // First Home - go to start of line
    const event1 = new KeyboardEvent('keydown', {
      key: 'Home',
      bubbles: true
    });
    el.handleKeydown(event1);

    expect(el.cursorLine).to.equal(2);
    expect(el.cursorColumn).to.equal(0);

    // Second Home - should stay at start of line (not jump to document start)
    const event2 = new KeyboardEvent('keydown', {
      key: 'Home',
      bubbles: true
    });
    el.handleKeydown(event2);

    expect(el.cursorLine).to.equal(2);
    expect(el.cursorColumn).to.equal(0);
  });

  it('should move cursor to end of line with End', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    // Position cursor at start of a line
    el.cursorLine = 1;
    el.cursorColumn = 0;

    const lineLength = el.lines[1].length;

    const event = new KeyboardEvent('keydown', {
      key: 'End',
      bubbles: true
    });
    el.handleKeydown(event);

    expect(el.cursorLine).to.equal(1);
    expect(el.cursorColumn).to.equal(lineLength);
  });

  it('should stay at end of line when End pressed twice (no document jump)', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    // Position cursor on line 2
    el.cursorLine = 2;
    el.cursorColumn = 0;
    const lineLength = el.lines[2].length;

    // First End - go to end of line
    const event1 = new KeyboardEvent('keydown', {
      key: 'End',
      bubbles: true
    });
    el.handleKeydown(event1);

    expect(el.cursorLine).to.equal(2);
    expect(el.cursorColumn).to.equal(lineLength);

    // Second End - should stay at end of line (not jump to document end)
    const event2 = new KeyboardEvent('keydown', {
      key: 'End',
      bubbles: true
    });
    el.handleKeydown(event2);

    expect(el.cursorLine).to.equal(2);
    expect(el.cursorColumn).to.equal(lineLength);
  });

  it('should move cursor to start of document with Ctrl+Home', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint, validPolygon]);
    await waitFor(200);

    // Position cursor somewhere in the middle
    el.cursorLine = 5;
    el.cursorColumn = 3;

    const event = new KeyboardEvent('keydown', {
      key: 'Home',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);

    expect(el.cursorLine).to.equal(0);
    expect(el.cursorColumn).to.equal(0);
  });

  it('should move cursor to end of document with Ctrl+End', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint, validPolygon]);
    await waitFor(200);

    // Position cursor at start
    el.cursorLine = 0;
    el.cursorColumn = 0;

    const lastLine = el.lines.length - 1;
    const lastLineLength = el.lines[lastLine].length;

    const event = new KeyboardEvent('keydown', {
      key: 'End',
      ctrlKey: true,
      bubbles: true
    });
    el.handleKeydown(event);

    expect(el.cursorLine).to.equal(lastLine);
    expect(el.cursorColumn).to.equal(lastLineLength);
  });

  it('should select from cursor to start of line with Shift+Home', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    // Position cursor in middle of a line
    el.cursorLine = 1;
    el.cursorColumn = 5;

    const event = new KeyboardEvent('keydown', {
      key: 'Home',
      shiftKey: true,
      bubbles: true
    });
    el.handleKeydown(event);

    expect(el.cursorColumn).to.equal(0);
    expect(el.selectionStart).to.exist;
    expect(el.selectionStart.line).to.equal(1);
    expect(el.selectionStart.column).to.equal(5);
    expect(el.selectionEnd).to.exist;
    expect(el.selectionEnd.line).to.equal(1);
    expect(el.selectionEnd.column).to.equal(0);
  });

  it('should select from cursor to end of line with Shift+End', async () => {
    const el = await createSizedFixture();
    await waitFor();

    el.set([validPoint]);
    await waitFor(200);

    // Position cursor at start of a line
    el.cursorLine = 1;
    el.cursorColumn = 0;
    const lineLength = el.lines[1].length;

    const event = new KeyboardEvent('keydown', {
      key: 'End',
      shiftKey: true,
      bubbles: true
    });
    el.handleKeydown(event);

    expect(el.cursorColumn).to.equal(lineLength);
    expect(el.selectionStart).to.exist;
    expect(el.selectionStart.line).to.equal(1);
    expect(el.selectionStart.column).to.equal(0);
    expect(el.selectionEnd).to.exist;
    expect(el.selectionEnd.line).to.equal(1);
    expect(el.selectionEnd.column).to.equal(lineLength);
  });
});
