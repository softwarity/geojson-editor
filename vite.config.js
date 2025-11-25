import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

const banner = `/**
 * @license MIT
 * @name ${pkg.name}
 * @version ${pkg.version}
 * @author Softwarity (https://www.softwarity.io/)
 * @copyright 2024 Softwarity
 * @see https://github.com/softwarity/geojson-editor
 */`;

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/geojson-editor.js'),
      name: 'GeoJsonEditor',
      fileName: 'geojson-editor',
      formats: ['es']
    },
    minify: true,
    rollupOptions: {
      output: {
        banner,
        assetFileNames: 'geojson-editor.[ext]'
      }
    }
  },
  server: {
    open: '/demo/index.html'
  }
});
