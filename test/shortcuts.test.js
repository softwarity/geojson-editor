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

  it('should expand collapsed node with Tab', async () => {
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
          key: 'Tab',
          bubbles: true
        });
        el.handleKeydown(event);
        await waitFor(100);

        // Should be expanded now
        expect(el.collapsedNodes.has(nodeId)).to.be.false;
      }
    }
  });

  it('should collapse node with Shift+Tab', async () => {
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
        key: 'Tab',
        shiftKey: true,
        bubbles: true
      });
      el.handleKeydown(event);
      await waitFor(100);

      // Should be collapsed now
      expect(el.collapsedNodes.has(range.nodeId)).to.be.true;
    }
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
});
