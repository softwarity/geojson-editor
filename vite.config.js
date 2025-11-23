import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/geojson-editor.js'),
      name: 'GeoJsonEditor',
      fileName: 'geojson-editor',
      formats: ['es']
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
