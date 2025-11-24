# GeoJSON Editor Web Component

A feature-rich, framework-agnostic Web Component for editing GeoJSON features with syntax highlighting, collapsible nodes, and integrated color picker.

**[🚀 Try the Live Demo](https://softwarity.github.io/geojson-editor/)**

## Features

- **Syntax Highlighting** - JSON syntax highlighting with customizable color schemes
- **Collapsible Nodes** - Collapse/expand JSON objects and arrays with visual indicators (`{...}` / `[...]`)
- **Color Picker** - Built-in color picker for color properties in left gutter
- **Dark/Light Themes** - Automatic theme detection from parent page (Bootstrap, Tailwind, custom)
- **Auto-format** - Optional automatic JSON formatting
- **Block Editing in Collapsed Areas** - Prevents accidental edits in collapsed sections
- **Smart Copy/Paste** - Copy includes expanded content even from collapsed nodes
- **Prefix/Suffix** - Configurable text before/after editor content for wrapping (e.g., FeatureCollection wrapper)
- **CSS Isolation** - Complete Shadow DOM isolation from external CSS frameworks

## Installation

```bash
npm install @softwarity/geojson-editor
```

## Usage

### Basic Usage

```html
<script type="module">
  import '@softwarity/geojson-editor';
</script>

<geojson-editor
  prefix='{"type": "FeatureCollection", "features": ['
  suffix=']}'
  collapsed='["coordinates"]'
  placeholder="Enter GeoJSON features here..."
></geojson-editor>
```

### With Auto-format and Theme Detection

```html
<geojson-editor
  prefix='{"type": "FeatureCollection", "features": ['
  suffix=']}'
  dark-selector="html.dark"
  auto-format
></geojson-editor>
```

### Listen to Changes

```javascript
const editor = document.querySelector('geojson-editor');

// Valid JSON emits change event with parsed object
editor.addEventListener('change', (e) => {
  console.log('Timestamp:', e.detail.timestamp);
  console.log('Parsed value:', e.detail.value); // Parsed JSON object
});

// Invalid JSON emits error event
editor.addEventListener('error', (e) => {
  console.error('Error:', e.detail.error);
  console.log('Content:', e.detail.content); // Raw content for debugging
});
```

## Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `value` | `string` | `""` | Initial value (editor content only, without prefix/suffix) |
| `placeholder` | `string` | `""` | Placeholder text |
| `readonly` | `boolean` | `false` | Make editor read-only |
| `collapsed` | `string[]` (JSON) | `[]` | List of keys that start collapsed (all nodes are collapsible) |
| `auto-format` | `boolean` | `false` | Auto-format JSON on input |
| `dark-selector` | `string` | `".dark"` | CSS selector for dark theme (if matches → dark, else → light) |
| `prefix` | `string` | `""` | Text displayed before editor (used for validation) |
| `suffix` | `string` | `""` | Text displayed after editor (used for validation) |

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

Fired when content changes and JSON is valid (debounced 150ms).

```javascript
editor.addEventListener('change', (e) => {
  console.log(e.detail.timestamp);  // ISO timestamp
  console.log(e.detail.value);      // Parsed JSON object (includes prefix/suffix)
});
```

**Event detail properties:**

| Property | Type | Description |
|----------|------|-------------|
| `timestamp` | `string` | ISO timestamp of the change |
| `value` | `object` | Parsed JSON object including prefix and suffix |

### `error`

Fired when content changes but JSON is invalid (debounced 150ms).

```javascript
editor.addEventListener('error', (e) => {
  console.error(e.detail.error);    // Error message
  console.log(e.detail.content);    // Raw content for debugging
  console.log(e.detail.timestamp);  // ISO timestamp
});
```

**Event detail properties:**

| Property | Type | Description |
|----------|------|-------------|
| `timestamp` | `string` | ISO timestamp of the change |
| `error` | `string` | Error message from JSON.parse |
| `content` | `string` | Raw editor content (for debugging) |

**Example with custom prefix/suffix:**

```html
<geojson-editor
  prefix='{"type": "FeatureCollection", "features": ['
  suffix=']}'
></geojson-editor>
```

```javascript
editor.addEventListener('change', (e) => {
  console.log(e.detail.value);
  // → { type: "FeatureCollection", features: [{ type: "Feature", ... }] }
  // Already parsed as JSON object
});
```

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
