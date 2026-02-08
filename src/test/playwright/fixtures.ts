import { AxeUtils, createLogger } from '@hmcts/playwright-common';
import { test as base, expect } from '@playwright/test';

import { IdamLoginPage } from './page-objects/pages';

const serviceName = 'wa-reporting-frontend-tests';

type Logger = ReturnType<typeof createLogger>;

type Fixtures = {
  logger: Logger;
  axeUtils: AxeUtils;
  idamPage: IdamLoginPage;
};

export const test = base.extend<Fixtures>({
  logger: async ({ page: _page }, use, testInfo) => {
    const logger = createLogger({
      serviceName,
      defaultMeta: {
        testId: `${testInfo.project.name}::${testInfo.title}`,
      },
    });
    await use(logger);
  },
  axeUtils: async ({ page }, use, testInfo) => {
    const axeUtils = new AxeUtils(page);
    await use(axeUtils);
    await axeUtils.generateReport(testInfo);
  },
  idamPage: async ({ page }, use) => {
    await use(new IdamLoginPage(page));
  },
});

export { expect };
