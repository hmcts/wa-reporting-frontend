import { createLogger } from '@hmcts/playwright-common';
import { test as base, expect } from '@playwright/test';

const serviceName = 'wa-reporting-frontend-tests';

type Logger = ReturnType<typeof createLogger>;

type Fixtures = {
  logger: Logger;
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
});

export { expect };
