import { AnalyticsOverviewPage } from '../playwright/page-objects/pages';
import { expect, test } from '../playwright/fixtures';

test('analytics landing page loads @functional', async ({ page }) => {
  const analyticsLandingPage = new AnalyticsOverviewPage(page);

  await analyticsLandingPage.goto();

  await expect(analyticsLandingPage.heading).toBeVisible();
});
