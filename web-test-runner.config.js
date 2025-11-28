import { playwrightLauncher } from '@web/test-runner-playwright';
import { esbuildPlugin } from '@web/dev-server-esbuild';
import fs from 'fs';
import path from 'path';

const isCI = process.env.CI === 'true';

// Custom plugin to handle Vite's ?inline CSS imports
function inlineCssPlugin() {
  return {
    name: 'inline-css',
    resolveMimeType(context) {
      if (context.path.includes('.css')) {
        return 'js';
      }
    },
    async serve(context) {
      if (context.path.includes('.css')) {
        // Remove query params for file path
        const cleanPath = context.path.split('?')[0];
        const filePath = path.join(process.cwd(), cleanPath.startsWith('/') ? cleanPath.slice(1) : cleanPath);
        try {
          const cssContent = fs.readFileSync(filePath, 'utf-8');
          const escaped = cssContent.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
          return { body: `export default \`${escaped}\`;`, type: 'js' };
        } catch (e) {
          console.error('Failed to load CSS:', filePath, e.message);
        }
      }
    },
  };
}

export default {
  files: 'test/**/*.test.js',
  nodeResolve: true,

  // Plugins to handle Vite-specific imports
  plugins: [
    inlineCssPlugin(),
    esbuildPlugin({ ts: false }),
  ],

  // Use Playwright for real headless browser testing
  browsers: [
    playwrightLauncher({ product: 'chromium' }),
  ],

  // Test timeout (ms)
  testFramework: {
    config: {
      timeout: 5000,
    },
  },

  // Coverage reporting
  coverage: isCI,
  coverageConfig: {
    reportDir: 'coverage',
    reporters: ['html', 'lcov', 'text-summary'],
    include: ['src/**/*.js'],
    threshold: {
      statements: 60,
      branches: 50,
      functions: 60,
      lines: 60,
    },
  },
};
