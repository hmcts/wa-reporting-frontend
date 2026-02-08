import { AnalyticsUserOverviewPage } from '../playwright/page-objects/pages';
import { expect, test } from '../playwright/fixtures';

test('analytics user overview page loads @functional', async ({ page }) => {
  const analyticsUserOverviewPage = new AnalyticsUserOverviewPage(page);

  await analyticsUserOverviewPage.goto();

  await expect(analyticsUserOverviewPage.heading).toBeVisible();
});
