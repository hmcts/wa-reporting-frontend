import { AnalyticsCompletedPage } from '../playwright/page-objects/pages';
import { expect, test } from '../playwright/fixtures';

test('analytics completed page loads @functional', async ({ page }) => {
  const analyticsCompletedPage = new AnalyticsCompletedPage(page);

  await analyticsCompletedPage.goto();

  await expect(analyticsCompletedPage.heading).toBeVisible();
  await expect(analyticsCompletedPage.processingAndHandlingTimeText).toBeVisible();
});
