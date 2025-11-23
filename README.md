# GeoJSON Editor Web Component

A feature-rich, framework-agnostic Web Component for editing GeoJSON features with syntax highlighting, collapsible nodes, and integrated color picker.

**[🚀 Try the Live Demo](https://softwarity.github.io/geojson-editor/)**

## Features

- **Syntax Highlighting** - JSON syntax highlighting with customizable color schemes
- **Collapsible Nodes** - Collapse/expand JSON objects and arrays with visual indicators (`{...}` / `[...]`)
- **Color Picker** - Built-in color picker for color properties in left gutter
- **Dark/Light Themes** - Automatic theme detection from parent page (Bootstrap, Tailwind, custom)
- **Two Modes** - `json` mode for complete objects, `array` mode for feature lists
- **Auto-format** - Optional automatic JSON formatting
- **Block Editing in Collapsed Areas** - Prevents accidental edits in collapsed sections
- **Smart Copy/Paste** - Copy includes expanded content even from collapsed nodes
- **Prefix/Suffix** - Configurable text before/after editor (e.g., `[` and `]` for arrays)
- **CSS Isolation** - Complete Shadow DOM isolation from external CSS frameworks

## Installation

```bash
npm install @softwarity/geojson-editor
```

## Usage

### Basic Usage

```html
<script type="module">
  import '/path/to/geojson-editor.js';
</script>

<geojson-editor
  mode="array"
  collapsable='["coordinates", "properties", "geometry"]'
  placeholder="Enter GeoJSON features here..."
></geojson-editor>
```

### With Framework Detection

```html
<geojson-editor
  mode="array"
  dark-selector="html@data-theme=dark"
  light-selector="html@data-theme=light"
  auto-format
></geojson-editor>
```

### Listen to Changes

```javascript
const editor = document.querySelector('geojson-editor');

editor.addEventListener('change', (e) => {
  const { value, valid } = e.detail;
  console.log('Valid JSON:', valid);
  console.log('Value:', value);
});
```

## Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `mode` | `"json"` \| `"array"` | `"json"` | Editor mode - `array` wraps content in brackets |
| `value` | `string` | `""` | Initial value |
| `placeholder` | `string` | `""` | Placeholder text |
| `readonly` | `boolean` | `false` | Make editor read-only |
| `collapsable` | `string[]` (JSON) | `[]` | List of keys that can be collapsed (empty = all) |
| `collapsed` | `string[]` (JSON) | `[]` | List of keys collapsed by default |
| `auto-format` | `boolean` | `false` | Auto-format JSON on input |
| `color-scheme` | `"dark"` \| `"light"` | `"dark"` | Color scheme (if no selectors) |
| `dark-selector` | `string` | - | Selector for dark theme detection |
| `light-selector` | `string` | - | Selector for light theme detection |
| `prefix` | `string` | `"["` (array mode) | Text displayed before editor |
| `suffix` | `string` | `"]"` (array mode) | Text displayed after editor |

### Selector Syntax

Theme selectors support special syntax for framework detection:

- `html@data-theme=dark` - Attribute matching (e.g., `<html data-theme="dark">`)
- `html.dark` - Class matching (e.g., `<html class="dark">`)
- `@color-scheme=dark` - Self-reference (component's own attribute)

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

Fired when content changes (debounced 150ms).

```javascript
editor.addEventListener('change', (e) => {
  console.log(e.detail.value);  // string
  console.log(e.detail.valid);  // boolean
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
