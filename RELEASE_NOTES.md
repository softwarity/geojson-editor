# Release Notes - @softwarity/geojson-editor

## v1.0.23

### Improvements

- **Index-based visibility system** - Feature visibility state now persists when modifying feature properties or coordinates; indices automatically adjust when features are inserted/deleted
- **Auto-collapse on paste** - Coordinates are now collapsed even when pasting with temporary JSON errors (e.g., missing comma)
- **Home/End behavior simplified** - Home/End now only go to start/end of line; use Ctrl+Home/End for document start/end (removed double-tap behavior)

### Bug Fixes

- Fixed visibility state lost when modifying properties of a hidden feature
- Fixed visibility indices not adjusting when inserting/removing features via API

### Code Quality

- Removed dead code (`getFeatureKey` function no longer needed)
- 372 unit tests (8 new tests for Home/End navigation, 18 new tests for visibility index system)

---

## v1.0.22

### Bug Fixes

- Fixed `add()`, `insertAt()`, and Ctrl+I reopening previously collapsed features (collapsed state now preserved)
- Fixed `removeAt()` reopening collapsed features (collapsed state now preserved)
- Fixed drag selection auto-scroll not continuing when mouse exits editor bounds
- Fixed cursor position after pasting multi-line content (cursor now correctly positioned at end of pasted text)
- Fixed pasted features not having their coordinates auto-collapsed
- Fixed visibility toggle button missing for features with same coordinates but different properties (feature keys now include properties in hash)

### Code Quality

- 347 unit tests

---

## v1.0.21

### New Features

- **Ctrl+I Add Feature Shortcut** - Optional shortcut to add features via native prompt (accepts Feature, Feature[], or FeatureCollection). Enable with `internal-add-shortcut` attribute.

### Bug Fixes

- Fixed cursor position jumping to wrong line when adding characters at end of file in invalid JSON

---

## v1.0.20

### New Features

- **Double-click to select** - Double-click on a word, JSON key, or string value to select it

---

## v1.0.19

### New Features

- **Error Navigation** - Visual error indicators in gutter with navigation buttons (◀ ▶) to jump between errors; error count displayed in suffix area
- **Home/End Enhancement** - Double-tap Home/End to go to document start/end (single tap for line start/end) *(Note: removed in v1.0.23, use Ctrl+Home/End instead)*
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
- Fixed best-effort formatting causing text to jump while typing on invalid JSON lines (cursor line now preserved as-is)

### Code Quality

- Removed unused CSS rule (`.json-key-invalid`)
- Added `uniqueKey` to NodeRangeInfo for stable node identification across edits
- 333 unit tests
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
