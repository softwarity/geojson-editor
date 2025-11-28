import { playwrightLauncher } from '@web/test-runner-playwright';
import { esbuildPlugin } from '@web/dev-server-esbuild';
import fs from 'fs';
import path from 'path';

const isCI = process.env.CI === 'true';

// Custom plugin to handle Vite's ?inline CSS imports
function inlineCssPlugin() {
  return {
    name: 'inline-css',
    async transform(context) {
      if (context.path.endsWith('.css?inline')) {
        const cssPath = context.path.replace('?inline', '');
        const filePath = path.join(process.cwd(), 'src', path.basename(cssPath));
        const cssContent = fs.readFileSync(filePath, 'utf-8');
        const escaped = cssContent.replace(/`/g, '\\`').replace(/\$/g, '\\$');
        return { body: `export default \`${escaped}\`;` };
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
