import { AnalyticsOutstandingPage } from '../playwright/page-objects/pages';
import { expect, test } from '../playwright/fixtures';

test('analytics outstanding page loads @functional', async ({ page }) => {
  const analyticsOutstandingPage = new AnalyticsOutstandingPage(page);

  await analyticsOutstandingPage.goto();

  await expect(analyticsOutstandingPage.heading).toBeVisible();
});
