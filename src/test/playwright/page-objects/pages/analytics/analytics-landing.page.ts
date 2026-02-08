import { Locator, Page } from '@playwright/test';

import { buildUrl } from '../../../config';

export class AnalyticsLandingPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto(buildUrl('/'));
  }

  get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Analytics', level: 1 });
  }
}
