import { CommonConfig, ProjectsConfig } from '@hmcts/playwright-common';
import { defineConfig } from '@playwright/test';
import config from 'config';
import path from 'node:path';

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
const authEnabled = Boolean(config.get('auth.enabled'));
const authSessionFile = path.resolve(process.cwd(), 'src/test/playwright/.sessions', 'idam-session.json');

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

export default defineConfig({
  ...CommonConfig.recommended,
  testDir: './src/test',
  testMatch: ['**/*.smoke.spec.ts', '**/*.functional.spec.ts', '**/*.a11y.spec.ts'],
  snapshotDir: './src/test/playwright/snapshots',
  globalSetup: authEnabled ? './src/test/playwright/auth/global-setup.ts' : undefined,
  reporter,
  outputDir,
  use: {
    ...CommonConfig.recommended.use,
    baseURL: baseUrl,
    headless,
    storageState: authEnabled ? authSessionFile : undefined,
  },
  projects: [ProjectsConfig.chromium, ProjectsConfig.firefox, ProjectsConfig.webkit, ProjectsConfig.edge],
});
