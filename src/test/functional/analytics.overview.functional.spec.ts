import { AnalyticsOverviewPage } from '../playwright/page-objects/pages';
import { expect, test } from '../playwright/fixtures';

test('analytics overview page loads @functional', async ({ page }) => {
  const analyticsOverviewPage = new AnalyticsOverviewPage(page);

  await analyticsOverviewPage.goto();

  await expect(analyticsOverviewPage.heading).toBeVisible();
});
