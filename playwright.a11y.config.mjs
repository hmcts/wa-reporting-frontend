import { CommonConfig, ProjectsConfig } from '@hmcts/playwright-common';
import { defineConfig } from '@playwright/test';

const resolveBoolean = (value, defaultValue) => {
  if (value === undefined) {
    return defaultValue;
  }
  const normalised = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalised)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalised)) {
    return false;
  }
  return defaultValue;
};

const baseUrl = process.env.TEST_URL || 'http://localhost:3100';
const headless = resolveBoolean(process.env.TEST_HEADLESS, true);
const htmlOutput = process.env.PLAYWRIGHT_HTML_OUTPUT || 'playwright-report';
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results';

const reporter = [
  ['list'],
  [
    'html',
    {
      open: 'never',
      outputFolder: htmlOutput,
    },
  ],
];

const serverUrl = new URL(baseUrl);
const serverPort = serverUrl.port || (serverUrl.protocol === 'https:' ? '443' : '80');
const readinessUrl = new URL('/health', baseUrl).toString();

export default defineConfig({
  ...CommonConfig.recommended,
  testDir: './src/test',
  testMatch: ['**/*.a11y.spec.ts'],
  snapshotDir: './src/test/playwright/snapshots',
  reporter,
  outputDir,
  use: {
    ...CommonConfig.recommended.use,
    baseURL: baseUrl,
    headless,
  },
  projects: [ProjectsConfig.chromium],
  webServer: {
    command: `AUTH_ENABLED=false PORT=${serverPort} yarn start:dev`,
    url: readinessUrl,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
