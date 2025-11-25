# GeoJSON Editor Web Component

A feature-rich, framework-agnostic Web Component for editing GeoJSON features with syntax highlighting, collapsible nodes, and integrated color picker.

**[🚀 Try the Live Demo](https://softwarity.github.io/geojson-editor/)**

## Features

- **GeoJSON-Aware Highlighting** - Distinct colors for GeoJSON keywords (`type`, `coordinates`, `geometry`, etc.)
- **GeoJSON Type Validation** - Valid types (`Point`, `LineString`, `Polygon`, etc.) highlighted distinctly; invalid types (`LinearRing`, unknown types) shown with error styling (colors configurable via theme)
- **Syntax Highlighting** - JSON syntax highlighting with customizable color schemes
- **Collapsible Nodes** - Collapse/expand JSON objects and arrays with visual indicators (`{...}` / `[...]`)
- **Color Picker** - Built-in color picker for color properties in left gutter
- **Dark/Light Themes** - Automatic theme detection from parent page (Bootstrap, Tailwind, custom)
- **Auto-format** - Optional automatic JSON formatting in real-time
- **Readonly Mode** - Visual indicator with diagonal stripes when editing is disabled
- **Block Editing in Collapsed Areas** - Prevents accidental edits in collapsed sections
- **Smart Copy/Paste** - Copy includes expanded content even from collapsed nodes
- **FeatureCollection Mode** - Optional mode to auto-wrap features in a FeatureCollection structure
- **CSS Isolation** - Complete Shadow DOM isolation from external CSS frameworks

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

### Basic Usage (FeatureCollection mode)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <script type="module" src="https://unpkg.com/@softwarity/geojson-editor"></script>
</head>
<body>
  <!-- User edits features, component wraps in FeatureCollection -->
  <geojson-editor
    feature-collection
    collapsed='["coordinates"]'
    placeholder="Enter GeoJSON features here..."
  ></geojson-editor>
</body>
</html>
```

### Standalone Mode (Full GeoJSON)

```html
<!-- User edits a complete GeoJSON object (Feature or FeatureCollection) -->
<geojson-editor
  placeholder="Enter GeoJSON here..."
></geojson-editor>
```

### With Auto-format and Theme Detection

```html
<geojson-editor
  feature-collection
  dark-selector="html.dark"
  auto-format
></geojson-editor>
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
| `value` | `string` | `""` | Initial editor content |
| `placeholder` | `string` | `""` | Placeholder text |
| `readonly` | `boolean` | `false` | Make editor read-only |
| `collapsed` | `string[]` (JSON) | `[]` | List of keys that start collapsed (all nodes are collapsible) |
| `auto-format` | `boolean` | `false` | Auto-format JSON on input |
| `dark-selector` | `string` | `".dark"` | CSS selector for dark theme (if matches → dark, else → light) |
| `feature-collection` | `boolean` | `false` | When set, wraps editor content in a FeatureCollection for validation/events |

### Dark Selector Syntax

The `dark-selector` attribute determines when the dark theme is active. If the selector matches, dark theme is applied; otherwise, light theme is used.

**Examples:**

- `.dark` - Component has `dark` class: `<geojson-editor class="dark">`
- `html.dark` - HTML element has `dark` class (Tailwind CSS): `<html class="dark">`
- `html[data-bs-theme=dark]` - HTML has Bootstrap theme attribute: `<html data-bs-theme="dark">`
- Empty string `""` - Uses component's `data-color-scheme` attribute as fallback

## API Methods

```javascript
const editor = document.querySelector('geojson-editor');

// Get/set theme
const themes = editor.getTheme();
editor.setTheme({
  dark: { background: '#000', textColor: '#fff' },
  light: { background: '#fff', textColor: '#000' }
});
editor.resetTheme();

// Get/set value
editor.setAttribute('value', JSON.stringify(data));
const value = editor.querySelector('#textarea').value; // via Shadow DOM
```

## Events

### `change`

Fired when content changes and GeoJSON is valid (debounced 150ms).

```javascript
editor.addEventListener('change', (e) => {
  console.log(e.detail);  // Parsed GeoJSON object directly
});
```

**Event detail:** The parsed GeoJSON object directly. In `feature-collection` mode, the wrapper is included.

**Example with FeatureCollection mode:**

```html
<geojson-editor feature-collection></geojson-editor>
```

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
