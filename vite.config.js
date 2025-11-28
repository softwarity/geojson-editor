import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { minifyHTMLLiterals } from 'minify-literals';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

const banner = `/**
 * @license MIT
 * @name ${pkg.name}
 * @version ${pkg.version}
 * @author Softwarity (https://www.softwarity.io/)
 * @copyright ${new Date().getFullYear()} Softwarity
 * @see https://github.com/softwarity/geojson-editor
 */`;

// Custom Vite plugin to minify template literals (CSS/HTML)
function minifyLiteralsPlugin() {
  return {
    name: 'minify-literals',
    async transform(code, id) {
      if (id.endsWith('.js') && code.includes('`')) {
        try {
          const result = await minifyHTMLLiterals(code, { fileName: id });
          return result ? { code: result.code, map: result.map } : null;
        } catch (e) {
          // If minification fails, return original code
          return null;
        }
      }
      return null;
    }
  };
}

export default defineConfig({
  plugins: [minifyLiteralsPlugin()],
  define: {
    __VERSION__: JSON.stringify(pkg.version)
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/geojson-editor.js'),
      name: 'GeoJsonEditor',
      fileName: 'geojson-editor',
      formats: ['es']
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        passes: 3
      },
      mangle: {
        toplevel: true
      },
      format: {
        comments: false,
        preamble: banner
      }
    },
    rollupOptions: {
      output: {
        assetFileNames: 'geojson-editor.[ext]'
      }
    }
  },
  server: {
    open: '/demo/index.html'
  }
});
