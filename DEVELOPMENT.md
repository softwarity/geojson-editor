# Development Guide

This guide explains how to develop and test the `@softwarity/geojson-editor` Web Component locally.

## Prerequisites

- Node.js 18+ or 20+
- npm 9+
- Git

## Initial Setup

Clone the repository and install dependencies:

```bash
# Clone the repo
git clone https://github.com/softwarity/geojson-editor.git
cd geojson-editor

# Install dependencies
npm install
```

## Local Development

### 1. Start Development Server

The easiest way to develop is using Vite's dev server:

```bash
npm run dev
```

This will:
- Start a dev server at `http://localhost:5173`
- Open the demo page (`demo/index.html`) automatically
- Enable hot-module replacement (HMR)
- Watch for file changes and rebuild automatically

**Development workflow:**
1. Edit `src/geojson-editor.ts`
2. Save the file
3. Browser refreshes automatically
4. Test changes in the demo

### 2. Build for Production

Build the component for distribution:

```bash
npm run build
```

This creates:
- `dist/geojson-editor.js` - Production-ready ES module (minified)
- `types/geojson-editor.d.ts` - TypeScript type definitions

### 3. Preview Production Build

Test the production build locally:

```bash
npm run preview
```

This serves the production build at `http://localhost:4173`

## Testing the Component

### Unit Tests

The project uses [@web/test-runner](https://modern-web.dev/docs/test-runner/overview/) with Playwright for unit testing.

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch
```

**Test output example:**
```
test/rendering.test.js:
  ✓ GeoJsonEditor - Basic Rendering > should render with default state
test/editing.test.js:
  ✓ GeoJsonEditor - Text Insertion > should have insertNewline method
test/api.test.js:
  ✓ GeoJsonEditor - Features API > should set features via set()
  ...

Chromium: 286 passed, 0 failed
Finished running tests in 21s, all tests passed! 🎉
```

### Test Organization

Tests are split across 7 themed files for better maintainability:

| File | Purpose |
|------|---------|
| `geojson-editor.test.js` | Original comprehensive tests |
| `rendering.test.js` | Basic rendering, attributes, UI elements |
| `interactions.test.js` | Cursor, selection, navigation, scroll |
| `editing.test.js` | Text insertion, deletion, newlines |
| `highlighting.test.js` | Syntax highlighting, themes, gutter |
| `api.test.js` | Features API, collapse/expand, visibility, collapsed option |
| `shortcuts.test.js` | Keyboard shortcuts (Ctrl+Z, Ctrl+S, Ctrl+O, Tab, Ctrl+Arrow) |

### Coverage Report

Coverage is automatically generated in CI. To run locally with coverage:

```bash
# Run tests with coverage report
npx web-test-runner --coverage

# Coverage report will be in coverage/ directory
# Open coverage/lcov-report/index.html in browser
```

**Coverage configuration** is in `web-test-runner.config.js`.

### Writing Tests

Tests are located in the `test/` directory. Example test structure:

```javascript
import { fixture, html, expect } from '@open-wc/testing';
import '../src/geojson-editor.ts';

// Helper for async operations
const waitFor = (ms = 100) => new Promise(r => setTimeout(r, ms));

describe('GeoJsonEditor - MyFeature', () => {
  it('should do something', async () => {
    const el = await fixture(html`<geojson-editor></geojson-editor>`);
    await waitFor();

    // Access shadow DOM
    const textarea = el.shadowRoot.querySelector('.hidden-textarea');
    expect(textarea).to.exist;

    // Test lines array (core data model)
    el.lines = ['{"test": true}'];
    el.updateModel();
    el.scheduleRender();
    await waitFor();
    
    expect(el.lines.length).to.equal(1);
  });
});
```

**Note**: The test runner requires custom middleware for CSS `?inline` imports. See `web-test-runner.config.js`.

### Test in Demo Page

The demo page (`demo/index.html`) includes comprehensive examples:

1. Start dev server: `npm run dev`
2. Open `http://localhost:5173`
3. Test features:
   - FeatureCollection output (prefix/suffix display)
   - Color scheme (Dark/Light)
   - Readonly mode
   - Collapsible nodes (Tab/Shift+Tab)
   - Virtualized rendering
   - Inline color picker
   - Boolean toggle checkbox
   - Feature visibility toggle
   - Theme customization
   - Features API (in browser console)

### Test as npm Package (Local)

Test the component as if it were installed from npm:

```bash
# 1. Build the package
npm run build

# 2. Create a test project
mkdir ../test-geojson-editor
cd ../test-geojson-editor
npm init -y

# 3. Install from local directory
npm install ../geojson-editor

# 4. Create test HTML
cat > index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Test GeoJSON Editor</title>
</head>
<body>
  <h1>Testing @softwarity/geojson-editor</h1>

  <geojson-editor placeholder="Enter GeoJSON features..."></geojson-editor>

  <script type="module">
    import '@softwarity/geojson-editor';

    const editor = document.querySelector('geojson-editor');

    // Valid GeoJSON emits change event with parsed object directly
    editor.addEventListener('change', (e) => {
      console.log('GeoJSON:', e.detail); // Parsed GeoJSON object
    });

    // Invalid JSON/GeoJSON emits error event
    editor.addEventListener('error', (e) => {
      console.error('Error:', e.detail.error);
    });
  </script>
</body>
</html>
EOF

# 5. Serve with any static server
npx vite
```

### Test with Link (Alternative)

Use `npm link` for easier local testing:

```bash
# In geojson-editor directory
npm link

# In your test project
npm link @softwarity/geojson-editor
```

Now changes to the source will be reflected immediately.

## Project Structure

```
geojson-editor/
├── src/
│   ├── geojson-editor.ts       # Main Web Component (TypeScript, ~3000 lines)
│   ├── geojson-editor.css      # Styles with CSS variables (~400 lines)
│   ├── geojson-editor.template.ts # HTML template generator
│   └── vite-env.d.ts           # TypeScript declarations for Vite
├── types/                      # Generated TypeScript declarations
│   └── geojson-editor.d.ts     # Exported types for consumers
├── test/
│   ├── geojson-editor.test.js  # Original comprehensive tests
│   ├── rendering.test.js       # Basic rendering, attributes, UI
│   ├── interactions.test.js    # Cursor, selection, navigation, scroll
│   ├── editing.test.js         # Text insertion, deletion, features API
│   ├── highlighting.test.js    # Syntax highlighting, themes
│   ├── api.test.js             # Features API, collapse, visibility, collapsed option
│   ├── shortcuts.test.js       # Keyboard shortcuts (Ctrl+Z/S/O, Tab, Ctrl+Arrow)
│   └── fixtures/
│       └── geojson-samples.js  # Shared test data
├── demo/
│   └── index.html              # Interactive demo page
├── dist/                       # Built output (generated)
│   └── geojson-editor.js       # Production bundle (~13.5 KB gzipped)
├── coverage/                   # Coverage reports (generated)
│   └── lcov-report/            # HTML coverage report
├── .github/
│   └── workflows/
│       ├── main.yml            # CI build + tests on all branches
│       ├── release.yml         # Manual release workflow
│       ├── tag.yml             # Publish to npm on tag
│       └── deploy-demo.yml     # Deploy demo to GitHub Pages
├── package.json                # Package configuration
├── tsconfig.json               # TypeScript configuration
├── vite.config.js              # Vite build configuration
├── web-test-runner.config.js   # Test runner configuration (with CSS middleware)
├── README.md                   # User documentation
├── DEVELOPMENT.md              # This file
├── CLAUDE.md                   # AI assistant guidelines
├── RELEASE.md                  # Release process guide
└── LICENSE                     # MIT License
```

### Architecture Notes

The component uses a **Monaco-like architecture**:
- **Virtual viewport**: Only visible lines are rendered to DOM
- **Hidden textarea**: Captures keyboard input
- **CSS pseudo-elements**: Inline controls (color picker, checkbox) don't affect text layout
- **Separate CSS file**: Easier theming via CSS custom properties

## Development Tips

### 1. Browser DevTools

Use browser DevTools to debug:

```javascript
// In browser console
const editor = document.querySelector('geojson-editor');

// Access core data model
editor.lines                 // Array of line strings
editor.visibleLines          // Lines currently displayed
editor.collapsedNodes        // Set of collapsed node IDs

// Access Shadow DOM
editor.shadowRoot.querySelector('.viewport')
editor.shadowRoot.querySelector('.hidden-textarea')

// Test features API
editor.set([{ type: 'Feature', geometry: null, properties: {} }])
editor.getAll()

// Set custom theme
editor.setTheme({
  dark: { bgColor: '#000000', textColor: '#ffffff' }
})
```

### 2. Live Reload

Vite provides instant feedback:
- Edit `src/geojson-editor.ts`
- Save (Ctrl+S)
- Browser auto-refreshes
- No manual reload needed

### 3. Testing Different Scenarios

Edit `demo/index.html` to test edge cases:

```html
<!-- Test with initial value (features array content) -->
<geojson-editor
  value='{"type": "Feature", "geometry": {"type": "Point", "coordinates": [0, 0]}}'
></geojson-editor>

<!-- Test readonly -->
<geojson-editor readonly></geojson-editor>

<!-- Test with placeholder -->
<geojson-editor placeholder="Enter GeoJSON features..."></geojson-editor>

<!-- Test with dark color scheme detection (Tailwind style) -->
<geojson-editor dark-selector="html.dark"></geojson-editor>
```

**Note:** Users edit features directly (comma-separated). The component wraps them in a FeatureCollection structure automatically.

### 4. Check Build Output

Inspect the production build:

```bash
npm run build

# Check file size
ls -lh dist/

# View the built code
cat dist/geojson-editor.js | head -50
```

## Troubleshooting

### Port Already in Use

If port 5173 is busy:

```bash
# Vite will auto-increment (5174, 5175, etc.)
# Or specify a custom port:
vite --port 3000
```

### Changes Not Reflecting

1. Hard refresh: Ctrl+Shift+R (Linux/Windows) or Cmd+Shift+R (Mac)
2. Clear cache: Browser DevTools → Network → Disable cache
3. Restart dev server: Ctrl+C then `npm run dev`

### Build Errors

```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

### Module Resolution Issues

If imports fail in the demo:

```bash
# Ensure you're using ES modules
<script type="module" src="..."></script>

# Check browser supports ES modules (all modern browsers do)
```

## Testing Checklist

Before submitting changes, verify:

- [ ] `npm test` passes all 304 unit tests
- [ ] `npm run dev` starts without errors
- [ ] Component renders correctly in demo
- [ ] All features work:
  - Collapse/expand with Tab/Shift+Tab
  - Inline color picker
  - Boolean checkbox toggle
  - Color schemes (dark/light)
- [ ] `npm run build` completes successfully
- [ ] `dist/geojson-editor.js` exists and is not empty
- [ ] No console errors in browser DevTools
- [ ] Works in both dark and light color schemes
- [ ] FeatureCollection prefix/suffix displays correctly with gutter
- [ ] Feature visibility toggle works (eye icon)
- [ ] Clear button works (✕ in suffix area)
- [ ] Features API works (set, add, insertAt, removeAt, removeAll, get, getAll, emit)
- [ ] Features API options work (collapsed option with $root, coordinates, etc.)
- [ ] Readonly mode works (clear button hidden)
- [ ] `change` events fire with valid GeoJSON (e.detail is the parsed object)
- [ ] `error` events fire with invalid JSON/GeoJSON
- [ ] Virtualized rendering works for large GeoJSON

## Making Changes

### 1. Feature Development

```bash
# 1. Create feature branch
git checkout -b feature/my-new-feature

# 2. Make changes to src/geojson-editor.ts
# 3. Test in dev server
npm run dev

# 4. Build and verify
npm run build

# 5. Commit changes
git add .
git commit -m "feat: add my new feature"

# 6. Push to GitHub
git push origin feature/my-new-feature

# 7. Create Pull Request on GitHub
```

### 2. Bug Fixes

```bash
git checkout -b fix/bug-description
# ... make fixes ...
git commit -m "fix: resolve bug with X"
git push origin fix/bug-description
```

### 3. Documentation Updates

```bash
git checkout -b docs/update-readme
# ... update docs ...
git commit -m "docs: improve installation instructions"
git push origin docs/update-readme
```

## Performance Profiling

### 1. Browser Performance

```javascript
// In browser console
console.time('render');
const editor = document.createElement('geojson-editor');
document.body.appendChild(editor);
console.timeEnd('render');
```

### 2. Build Size

```bash
npm run build

# Check gzipped size (what users download)
gzip -c dist/geojson-editor.js | wc -c
```

### 3. Lighthouse

Run Lighthouse on the demo page:
1. Open demo in Chrome
2. DevTools → Lighthouse tab
3. Generate report
4. Check Performance, Accessibility scores

## GitHub Pages Demo

The demo is automatically deployed to GitHub Pages on every push to `main`.

**View the live demo:**
```
https://softwarity.github.io/geojson-editor/
```

**Manual deployment:**
```bash
# Via GitHub Actions UI
GitHub → Actions → Deploy Demo to GitHub Pages → Run workflow
```

The demo includes:
- Interactive component showcase
- All configuration options
- Theme customization
- Sample GeoJSON data
- Event logging

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly (see checklist above)
5. Commit with descriptive messages
6. Push to your fork
7. Create a Pull Request

## Questions?

- Check existing issues: https://github.com/softwarity/geojson-editor/issues
- Create new issue: Describe the problem and steps to reproduce
- Discussion: Use GitHub Discussions for questions

## Quick Reference

```bash
# Development
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:5173)
npm run build        # Build for production (JS + types)
npm run build:types  # Generate TypeScript declarations only
npm run typecheck    # Type-check without emitting
npm run preview      # Preview production build

# Testing
npm test                        # Run unit tests once
npm run test:watch              # Run tests in watch mode
npx web-test-runner --coverage  # Run tests with coverage report

# Package testing
npm link             # Link package globally
npm run build        # Build before testing

# Git
git checkout -b feature/name    # New feature branch
git add .                       # Stage changes
git commit -m "feat: ..."       # Commit with message
git push origin feature/name    # Push to GitHub
```
