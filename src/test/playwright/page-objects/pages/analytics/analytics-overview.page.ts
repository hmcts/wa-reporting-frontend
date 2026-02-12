import { Locator, Page } from '@playwright/test';

import { buildUrl } from '../../../config';

export class AnalyticsOverviewPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto(buildUrl('/'));
  }

  get heading(): Locator {
    return this.page.getByRole('heading', {
      name: 'Service performance overview',
      level: 1,
    });
  }
}
