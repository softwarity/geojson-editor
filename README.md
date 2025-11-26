<p align="center">
  <a href="https://www.softwarity.io/">
    <img src="https://www.softwarity.io/img/softwarity.svg" alt="Softwarity" height="60">
  </a>
</p>

# @softwarity/geojson-editor

<p align="center">
  <a href="https://www.npmjs.com/package/@softwarity/geojson-editor">
    <img src="https://img.shields.io/npm/v/@softwarity/geojson-editor?color=blue&label=npm" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/@softwarity/geojson-editor">
    <img src="https://img.shields.io/bundlephobia/minzip/@softwarity/geojson-editor?label=size" alt="bundle size">
  </a>
  <a href="https://github.com/softwarity/geojson-editor/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue" alt="license">
  </a>
  <a href="https://codecov.io/gh/softwarity/geojson-editor">
    <img src="https://codecov.io/gh/softwarity/geojson-editor/graph/badge.svg" alt="codecov">
  </a>
</p>

A feature-rich, framework-agnostic **Web Component** for editing GeoJSON features with syntax highlighting, collapsible nodes, and integrated color picker.

**[🚀 Try the Live Demo](https://softwarity.github.io/geojson-editor/)**

## Why not Monaco, CodeMirror, or Prism?

| | @softwarity/geojson-editor | Monaco Editor | CodeMirror 6 | Prism.js |
|---|:---:|:---:|:---:|:---:|
| **Size (gzip)** | <img src="https://img.shields.io/bundlephobia/minzip/@softwarity/geojson-editor?label="> | ~2.5 MB* | ~150 KB* | ~20 KB* |
| **GeoJSON validation** | ✅ Built-in | ❌ Manual | ❌ Manual | ❌ None |
| **Type highlighting** | ✅ Contextual | ⚠️ Generic JSON | ⚠️ Generic JSON | ⚠️ Generic JSON |
| **Invalid type detection** | ✅ Visual feedback | ❌ | ❌ | ❌ |
| **Collapsible nodes** | ✅ Native | ✅ | ✅ Plugin | ❌ |
| **Color picker** | ✅ Integrated | ❌ | ❌ | ❌ |
| **Feature visibility toggle** | ✅ | ❌ | ❌ | ❌ |
| **Auto-collapse coordinates** | ✅ | ❌ | ❌ | ❌ |
| **FeatureCollection output** | ✅ Always | ❌ | ❌ | ❌ |
| **Clear button** | ✅ | ❌ | ❌ | ❌ |
| **Dark mode detection** | ✅ Auto | ⚠️ Manual | ⚠️ Manual | ⚠️ Manual |
| **Dependencies** | 0 | Many | Few | 0 |
| **Setup complexity** | 1 line | Complex | Moderate | Simple |

<sub>* Estimated total size: Monaco includes web workers loaded dynamically; CodeMirror/Prism require plugins for equivalent functionality (line numbers, folding, language support).</sub>

**TL;DR**: If you're building a GeoJSON-focused application and need a lightweight, specialized editor with built-in validation and GeoJSON-aware features, this component does exactly that — without the overhead of a general-purpose code editor.

## Features

- **GeoJSON-Aware Highlighting** - Distinct colors for GeoJSON keywords (`type`, `coordinates`, `geometry`, etc.)
- **GeoJSON Type Validation** - Valid types (`Point`, `LineString`, `Polygon`, etc.) highlighted distinctly; invalid types (`LinearRing`, unknown types) shown with error styling (colors configurable via theme)
- **Syntax Highlighting** - JSON syntax highlighting with customizable color schemes
- **Collapsible Nodes** - Collapse/expand JSON objects and arrays with visual indicators (`{...}` / `[...]`); `coordinates` auto-collapsed on load
- **Feature Visibility Toggle** - Hide/show individual Features via eye icon in gutter; hidden features are grayed out and excluded from `change` events (useful for temporary filtering without deleting data)
- **Color Picker** - Built-in color picker for color properties in left gutter
- **Default Properties** - Auto-inject default visualization properties (fill-color, stroke-color, etc.) into features based on configurable rules
- **Dark/Light Themes** - Automatic theme detection from parent page (Bootstrap, Tailwind, custom)
- **Auto-format** - Automatic JSON formatting in real-time (always enabled)
- **Readonly Mode** - Visual indicator with diagonal stripes when editing is disabled
- **Block Editing in Collapsed Areas** - Prevents accidental edits in collapsed sections
- **Smart Copy/Paste** - Copy includes expanded content even from collapsed nodes
- **FeatureCollection Output** - Emits valid FeatureCollection with all edited features
- **Clear Button** - Discreet ✕ button in suffix area to clear all editor content (hidden in readonly mode)

## Installation

### Option 1: CDN (No build step required)

Simply add a script tag to your HTML file:

```html
<!-- Using unpkg -->
<script type="module" src="https://unpkg.com/@softwarity/geojson-editor"></script>

<!-- Or using jsDelivr -->
<script type="module" src="https://cdn.jsdelivr.net/npm/@softwarity/geojson-editor"></script>
```

You can also specify a version:

```html
<!-- Specific version -->
<script type="module" src="https://unpkg.com/@softwarity/geojson-editor@1.0.0"></script>

<!-- Latest minor/patch of v1 -->
<script type="module" src="https://unpkg.com/@softwarity/geojson-editor@1"></script>
```

### Option 2: NPM (With bundler)

If you're using a bundler (Vite, Webpack, Rollup, etc.):

```bash
npm install @softwarity/geojson-editor
```

Then import in your JavaScript:

```javascript
import '@softwarity/geojson-editor';
```

## Usage

### Basic Usage

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <script type="module" src="https://unpkg.com/@softwarity/geojson-editor"></script>
</head>
<body>
  <!-- User edits features, component wraps in FeatureCollection -->
  <geojson-editor placeholder="Enter GeoJSON features here..."></geojson-editor>
</body>
</html>
```

Users edit features directly (comma-separated), and the component automatically wraps them in a `{"type": "FeatureCollection", "features": [...]}` structure for validation and events.

### With Theme Detection

```html
<geojson-editor dark-selector="html.dark"></geojson-editor>
```

### Listen to Changes

```javascript
const editor = document.querySelector('geojson-editor');

// Valid GeoJSON emits change event with parsed object directly
editor.addEventListener('change', (e) => {
  console.log('GeoJSON:', e.detail); // Parsed GeoJSON object
});

// Invalid JSON or GeoJSON validation error emits error event
editor.addEventListener('error', (e) => {
  console.error('Error:', e.detail.error);
  console.log('Errors:', e.detail.errors); // Array of validation errors (if GeoJSON validation)
});
```

## Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `value` | `string` | `""` | Initial editor content (features array content) |
| `placeholder` | `string` | `""` | Placeholder text |
| `readonly` | `boolean` | `false` | Make editor read-only |
| `dark-selector` | `string` | `".dark"` | CSS selector for dark theme (if matches → dark, else → light) |
| `default-properties` | `string` | `""` | Default properties to add to features (see [Default Properties](#default-properties)) |

**Note:** `coordinates` nodes are automatically collapsed when content is loaded to improve readability. All nodes can be manually expanded/collapsed by clicking the toggle button.

### Dark Selector Syntax

The `dark-selector` attribute determines when the dark theme is active. If the selector matches, dark theme is applied; otherwise, light theme is used.

**Examples:**

- `.dark` - Component has `dark` class: `<geojson-editor class="dark">`
- `html.dark` - HTML element has `dark` class (Tailwind CSS): `<html class="dark">`
- `html[data-bs-theme=dark]` - HTML has Bootstrap theme attribute: `<html data-bs-theme="dark">`
- Empty string `""` - Uses component's `data-color-scheme` attribute as fallback

### Default Properties

The `default-properties` attribute allows you to define default properties that will be automatically added to features. This is useful for setting visualization attributes (fill color, stroke color, opacity, etc.) that your mapping framework can use for styling.

**Behavior:**
- Default properties are **injected directly into the editor content** when features are added (via API or paste/typing)
- Properties are only added if not already defined on the feature (existing properties are never overwritten)
- Users can see and modify the default values in the editor

#### Simple Format (all features)

Apply the same default properties to all features:

```html
<geojson-editor default-properties='{"fill-color": "#1a465b", "stroke-color": "#000", "stroke-width": 2}'></geojson-editor>
```

#### Conditional Format (based on geometry type or properties)

Apply different default properties based on conditions using an array of rules. Conditions support dot notation for nested properties:

```html
<geojson-editor default-properties='[
  {"match": {"geometry.type": "Polygon"}, "values": {"fill-color": "#1a465b", "fill-opacity": 0.5}},
  {"match": {"geometry.type": "LineString"}, "values": {"stroke-color": "#ff0000", "stroke-width": 3}},
  {"match": {"geometry.type": "Point"}, "values": {"marker-color": "#00ff00"}}
]'></geojson-editor>
```

#### Conditional on Feature Properties

You can also match on existing feature properties:

```html
<geojson-editor default-properties='[
  {"match": {"properties.type": "airport"}, "values": {"marker-symbol": "airport", "marker-color": "#0000ff"}},
  {"match": {"properties.category": "water"}, "values": {"fill-color": "#0066cc"}},
  {"values": {"stroke-width": 1}}
]'></geojson-editor>
```

#### Combined: Conditionals with Fallback

Rules without a `match` condition apply to all features (use as fallback). All matching rules are applied, with later rules taking precedence for the same property:

```html
<geojson-editor default-properties='[
  {"values": {"stroke-width": 1, "stroke-color": "#333"}},
  {"match": {"geometry.type": "Polygon"}, "values": {"fill-color": "#1a465b", "fill-opacity": 0.3}},
  {"match": {"properties.highlighted": true}, "values": {"stroke-color": "#ff0000", "stroke-width": 3}}
]'></geojson-editor>
```

In this example:
- All features get `stroke-width: 1` and `stroke-color: "#333"` by default
- Polygons additionally get fill styling
- Features with `properties.highlighted: true` override the stroke styling

**Use Case:** This feature is designed to work seamlessly with mapping libraries like Mapbox GL, Leaflet, OpenLayers, etc. You can define default visualization properties that your layer styling can reference, without manually editing each feature.

## API Methods

```javascript
const editor = document.querySelector('geojson-editor');
```

### Features API

Programmatic manipulation of features:

| Method | Description |
|--------|-------------|
| `set(features[])` | Replace all features with the given array (throws if invalid) |
| `add(feature)` | Add a feature at the end (throws if invalid) |
| `insertAt(feature, index)` | Insert at index (negative = from end: -1 = before last) (throws if invalid) |
| `removeAt(index)` | Remove feature at index (negative = from end), returns removed feature |
| `removeAll()` | Remove all features, returns array of removed features |
| `get(index)` | Get feature at index (negative = from end) |
| `getAll()` | Get all features as an array |
| `emit()` | Emit the current document on the change event |

**Validation:** `set()`, `add()`, and `insertAt()` validate features before adding. Invalid features throw an `Error` with a descriptive message. A valid Feature must have:
- `type: "Feature"`
- `geometry`: object with valid type (`Point`, `LineString`, `Polygon`, etc.) and `coordinates`, or `null`
- `properties`: object or `null`

```javascript
// Set features
editor.set([
  { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} },
  { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] }, properties: {} }
]);

// Add a feature
editor.add({ type: 'Feature', geometry: { type: 'Point', coordinates: [2, 2] }, properties: {} });

// Insert at position 1
editor.insertAt({ type: 'Feature', ... }, 1);

// Remove last feature
const removed = editor.removeAt(-1);

// Get all features
const features = editor.getAll();

// Manually emit change event
editor.emit();
```

### Theme API

```javascript
// Get current theme
const themes = editor.getTheme();

// Set custom theme (partial update)
editor.setTheme({
  dark: { background: '#000', textColor: '#fff' },
  light: { background: '#fff', textColor: '#000' }
});

// Reset to defaults
editor.resetTheme();
```

## Events

### `change`

Fired when content changes and GeoJSON is valid (debounced 150ms).

```javascript
editor.addEventListener('change', (e) => {
  console.log(e.detail);  // Parsed GeoJSON object directly
});
```

**Event detail:** The parsed GeoJSON object (always a FeatureCollection).

**Note:** Hidden features (toggled via the eye icon) are automatically excluded from the emitted GeoJSON. This allows temporary filtering without modifying the actual JSON content.

**Example:**

```javascript
// User edits features only, but change event includes the FeatureCollection wrapper
editor.addEventListener('change', (e) => {
  console.log(e.detail);
  // → { type: "FeatureCollection", features: [{ type: "Feature", ... }] }
});
```

### `error`

Fired when content changes but JSON is invalid or GeoJSON validation fails (debounced 150ms).

```javascript
editor.addEventListener('error', (e) => {
  console.error(e.detail.error);   // Error message
  console.log(e.detail.errors);    // Array of validation errors (GeoJSON validation only)
  console.log(e.detail.content);   // Raw content for debugging
});
```

**Event detail properties:**

| Property | Type | Description |
|----------|------|-------------|
| `error` | `string` | Error message (JSON parse error or GeoJSON validation summary) |
| `errors` | `string[]` | Array of validation errors with paths (GeoJSON validation only) |
| `content` | `string` | Raw editor content (for debugging) |

**GeoJSON validation errors include:**
- Invalid types (e.g., `"LinearRing"`)
- Unknown types (any `type` value not in the GeoJSON specification)

## Styling

The component uses Shadow DOM with CSS variables for theming. Themes can be customized via the `setTheme()` API.

## Browser Support

Works in all modern browsers supporting:
- Web Components
- Shadow DOM
- ES6 Modules

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed development guide.

```bash
# Install dependencies
npm install

# Start dev server with live demo
npm run dev

# Build for production
npm run build
```

## License

MIT
