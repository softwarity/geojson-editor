import { playwrightLauncher } from '@web/test-runner-playwright';

const isCI = process.env.CI === 'true';

export default {
  files: 'test/**/*.test.js',
  nodeResolve: true,

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
