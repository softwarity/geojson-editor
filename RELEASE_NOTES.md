# Release Notes - @softwarity/geojson-editor

## v1.0.19

### New Features

- **Error Navigation** - Visual error indicators in gutter with navigation buttons (◀ ▶) to jump between errors; error count displayed in suffix area
- **Home/End Enhancement** - Double-tap Home/End to go to document start/end (single tap for line start/end)
- **PageUp/PageDown** - Page navigation with cursor movement
- **Shift Selection** - Home, End, PageUp, PageDown all support Shift for extending selection
- **goToNextError()/goToPrevError() API** - Programmatic error navigation

### Improvements

- Cursor position preserved when correcting errors (smart position restoration during reformatting)
- Collapsed nodes containing errors auto-expand after paste
- Refactored error expansion logic to reduce code duplication

### Bug Fixes

- Fixed cursor jumping when adding/removing characters that cause JSON validation state changes
- Fixed paste not rendering content until focus lost
- Fixed node collapse state: manually opened nodes (or auto-expanded due to errors) now stay open during editing
- Fixed multi-feature collapse isolation: opening one coordinates node no longer opens all coordinates nodes across features

### Code Quality

- Removed unused CSS rule (`.json-key-invalid`)
- Added `uniqueKey` to NodeRangeInfo for stable node identification across edits
- 333 unit tests (16 new tests for v1.0.19)
- Coverage: 85% statements, 80% branches, 91% functions

---

## v1.0.18

### New Features

- **Attribute Navigation** - Tab/Shift+Tab to navigate between JSON attributes (keys and values)
- **Enter/Shift+Enter for Collapse/Expand** - Enter expands, Shift+Enter collapses (frees Tab for navigation)
- **Named CSS Colors Support** - Syntax highlighting for all 147 named CSS colors with color swatch
- **getTheme() API** - Retrieve current theme settings programmatically

### Improvements

- Browser-native color handling
- TypeScript strict mode

---

## v1.0.17

- **Ctrl+Arrow Navigation** - Skip collapsed nodes when navigating with Ctrl+Left/Right

---

## v1.0.16

### New Features

- **TypeScript Migration** - Full TypeScript rewrite with exported type definitions
- **Ctrl+Arrow Word Navigation** - Jump between words with Ctrl+Left/Right
- **Ctrl+Shift+Arrow Selection** - Select words with Ctrl+Shift+Left/Right

### Improvements

- Enhanced keyboard event handling
- Inline control tests for boolean and color updates

---

## v1.0.15

### New Features

- **Undo/Redo System** - Full history with Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z (action grouping, cursor restoration, max 100 entries)
- **Save to File** - Ctrl+S to download GeoJSON as `.geojson` file
- **Open from File** - Ctrl+O to load GeoJSON from filesystem
- **Flexible Input API** - `set()`, `add()`, `insertAt()` accept FeatureCollection, Feature[], or single Feature
- **Collapsed Option** - Control which nodes are collapsed on load (`$root`, `coordinates`, etc.)

### Improvements

- Internal keyboard handlers refactored
- Simplified cursor handling
- Improved render cache management

---

## v1.0.14

### Bug Fixes

- Block rendering during inline control clicks (prevents DOM issues)
- Improved international keyboard input handling during composition
- Allow editing and cursor movement with invalid JSON
- Fixed visibility toggles after pasting into empty editor
- Preserve whitespace when rendering JSON elements

---

## v1.0.13

### New Features

- **Version Display** - Info button showing component version in editor

---

## v1.0.12

### Bug Fixes

- Handle text insertion in empty editor

---

## v1.0.11

### Improvements

- Enhanced documentation with collapsible nodes and virtualized rendering info
- Updated preview image

---

## v1.0.10

### Improvements

- SEO meta tags for demo page
- Responsive design improvements

---

## v1.0.9

### New Features

- **Collapse/Visibility Icons** - Visual icons for collapse buttons and visibility toggle

### Improvements

- Load sample GeoJSON from external file
- Support shorthand hex colors (#fff)

---

## v1.0.8

### New Features

- **Boolean Checkbox** - Inline checkbox for boolean properties (toggle true/false)

### Bug Fixes

- Reject GeometryCollection features (not supported)

---

## v1.0.7

### Improvements

- Build process optimization (minify-literals)
- Helper method for finding collapsed data
- Default properties feature for visualization

### Bug Fixes

- Padding and color adjustments for collapse button

---

## Earlier Versions

See [git history](https://github.com/softwarity/geojson-editor/commits/main) for complete changelog.

---

## Migration Guide

### From v1.0.17 to v1.0.18

**Keyboard Shortcuts Changed:**

| Action | Old (v1.0.17) | New (v1.0.18) |
|--------|---------------|---------------|
| Expand collapsed node | `Tab` | `Enter` |
| Collapse node | `Shift+Tab` | `Shift+Enter` |
| Navigate to next attribute | N/A | `Tab` |
| Navigate to previous attribute | N/A | `Shift+Tab` |

### From v1.0.14 to v1.0.15

**New API methods:**
- `undo()`, `redo()`, `canUndo()`, `canRedo()`, `clearHistory()`
- `save(filename?)`, `open(options?)`

**Options parameter added to:**
- `set(input, options?)`
- `add(input, options?)`
- `insertAt(input, index, options?)`
- `open(options?)`

```javascript
// New collapsed option
editor.set(features, { collapsed: ['coordinates'] });
editor.set(features, { collapsed: ['$root'] }); // Collapse entire features
editor.set(features, { collapsed: [] }); // No auto-collapse
```
