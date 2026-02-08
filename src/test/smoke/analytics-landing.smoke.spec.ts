import { AnalyticsLandingPage } from '../playwright/page-objects/pages';
import { expect, test } from '../playwright/fixtures';

test('analytics landing page loads @smoke', async ({ page }) => {
  const analyticsLandingPage = new AnalyticsLandingPage(page);

  await analyticsLandingPage.goto();

  await expect(analyticsLandingPage.heading).toBeVisible();
});
