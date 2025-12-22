# Release Notes

## v1.0.30

---

## v1.0.29

### Bug Fixes

- **Fixed pasted features inheriting hidden status** - When deleting hidden features and pasting new ones at the same index, the new features no longer incorrectly inherit the "hidden" visibility status. Invalid hidden feature indices are now cleaned up during content updates.

### Tests

- 420 unit tests (6 new tests for hidden status and index shifting)

---

## v1.0.28

### Bug Fixes

- **Fixed syntax highlighting corruption after paste** - Pasting text after a quoted value no longer causes visual artifacts (`"` and `>` characters appearing incorrectly). The issue was caused by the JSON key detection regex incorrectly matching text that was part of the previous value.

- **Fixed Ctrl+Shift+Z not working for redo** - The redo shortcut was not responding because the key handler was case-sensitive and Shift changes the key to uppercase. Now properly normalized to lowercase.

### Tests

- 414 unit tests (2 new tests for `highlightSyntax` function, 1 new test for paste after quoted value, 2 tests fixed for Ctrl+Shift+Z with realistic uppercase key)

---

## v1.0.27

### New Features

- **Coordinate-level `current-features` event** - When cursor is inside an expanded `coordinates` block, the event now emits `Point` features for each coordinate under the cursor/selection instead of the full parent feature. This enables precise coordinate highlighting on maps when editing complex geometries (Polygons, LineStrings, etc.)

### Bug Fixes

- **Undo/Redo now preserves collapsed node state** - When undoing or redoing, the editor now restores the exact collapsed/expanded state of all nodes (coordinates, geometry, properties, etc.). Previously, undo would reset all coordinates to expanded state.

### Tests

- 411 unit tests (3 new tests for coordinate-level event detection, 3 new tests for undo/redo collapsed state preservation)

---

## v1.0.26

### Breaking Changes

- **Renamed `current-feature` event to `current-features`** - The event now emits a `FeatureCollection` instead of a single `Feature` or `null`
- **Selection-aware feature detection** - The event now includes all features that overlap with the current selection, not just the cursor position

**Example with selection:**
```javascript
// If user selects text spanning 3 features:
editor.addEventListener('current-features', (e) => {
  console.log(e.detail.features.length); // → 3
});
```

### Bug Fixes

- **Fixed `current-features` event not emitted on feature deletion** - The event is now correctly emitted when a feature is deleted via `removeAt()` or `removeAll()` API methods while the editor is focused
- **Fixed viewport not scrolling to cursor after paste** - When pasting content that moves the cursor beyond the visible area, the viewport now automatically scrolls to keep the cursor visible with a comfortable 2-line margin from the edge

### Code Quality

- Removed dead code (`parseSelectorToHostRule` function - legacy from dark-selector attribute)

### Tests

- 405 unit tests (4 tests updated for new event format, 3 new tests for selection-based multi-feature detection, 2 new tests for feature deletion event, 3 new tests for viewport scroll stability)

---

## v1.0.25

*Minor release with demo improvements and CDN compatibility fixes.*

---

## v1.0.24

### New Features

- **`current-feature` event** - New event emitted when cursor enters/leaves a feature or editor gains/loses focus; useful for highlighting the active feature on a map
- **Native CSS theme support** - Theme now uses CSS `light-dark()` function for automatic dark/light mode switching based on system preference or inherited `color-scheme`
- **Pre-built theme CSS files** - 4 ready-to-use themes available: VS Code, GitHub, Monokai, Solarized

### Breaking Changes

- **Removed `dark-selector` attribute** - No longer needed; theme automatically adapts to system color-scheme
- **Removed `setTheme()`, `getTheme()`, `resetTheme()` methods** - Themes are now pure CSS files. Use external CSS to customize colors.
- **Removed `ThemeConfig` and `ThemeSettings` types** - No longer needed with CSS-based theming

### Migration from v1.0.23

#### Theme Migration

**Before (v1.0.23):**
```javascript
// JavaScript-based theme
editor.setTheme({
  dark: { bgColor: '#1e1e1e', textColor: '#d4d4d4' },
  light: { bgColor: '#fff', textColor: '#000' }
});
```

**After (v1.0.24):**
```html
<!-- Use a pre-built theme CSS file -->
<link rel="stylesheet" href="https://unpkg.com/@softwarity/geojson-editor/themes/vscode.css">
```

Or create custom CSS:
```css
/* CSS-based theme with light-dark() */
geojson-editor {
  --bg-color: light-dark(#fff, #1e1e1e);
  --text-color: light-dark(#000, #d4d4d4);
  /* ... */
}
```

#### Available Theme Files

- `themes/vscode.css` - VS Code colors
- `themes/github.css` - GitHub styling
- `themes/monokai.css` - Monokai palette
- `themes/solarized.css` - Solarized scheme

#### Forcing Light or Dark Mode

```css
/* Force dark mode */
geojson-editor { color-scheme: dark; }

/* Force light mode */
geojson-editor { color-scheme: light; }
```

#### Integration with CSS Frameworks

For frameworks using class-based dark mode (Tailwind, Bootstrap, etc.), set `color-scheme` based on their selectors:

```css
/* Tailwind CSS */
html.dark { color-scheme: dark; }
html:not(.dark) { color-scheme: light; }

/* Bootstrap 5 */
[data-bs-theme="dark"] { color-scheme: dark; }
[data-bs-theme="light"] { color-scheme: light; }
```

### New Event

```javascript
editor.addEventListener('current-feature', (e) => {
  const feature = e.detail; // Feature object or null
  if (feature) {
    // Highlight this feature on your map
    highlightLayer.setData(feature);
  } else {
    // No current feature (blur or outside feature)
    highlightLayer.setData({ type: 'FeatureCollection', features: [] });
  }
});
```

**Triggers:**
- Editor gains focus → emits current feature at cursor
- Cursor moves to a different feature → emits new feature
- Cursor moves outside any feature → emits `null`
- Editor loses focus → emits `null`

---

## v1.0.23

### Improvements

- **Index-based visibility system** - Feature visibility state now persists when modifying feature properties or coordinates; indices automatically adjust when features are inserted/deleted
- **Auto-collapse on paste** - Coordinates are now collapsed even when pasting with temporary JSON errors (e.g., missing comma)
- **Home/End behavior simplified** - Home/End now only go to start/end of line; use Ctrl+Home/End for document start/end (removed double-tap behavior)

### Bug Fixes

- Fixed visibility state lost when modifying properties of a hidden feature
- Fixed visibility indices not adjusting when inserting/removing features via API
- Fixed collapsed state lost when calling `add()`, `insertAt()`, or `removeAt()` (existing collapsed coordinates now preserved correctly)
- Fixed `removeAll()` not clearing selection/cursor state (caused crash on subsequent paste)
- Fixed paste not auto-collapsing when content is in "feature, feature" format (from Ctrl+A Ctrl+C)

### Code Quality

- Removed dead code (`getFeatureKey` function no longer needed)
- Fixed incorrect feature index calculation that used `isRootFeature` flag instead of proper `featureRanges` map
- 376 unit tests (8 new tests for Home/End navigation, 18 new tests for visibility index system, 3 new tests for collapsed state preservation)

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
