import { AnalyticsUserOverviewPage } from '../playwright/page-objects/pages';
import { expect, test } from '../playwright/fixtures';

test('analytics user overview page loads @functional', async ({ page }) => {
  const analyticsUserOverviewPage = new AnalyticsUserOverviewPage(page);

  await analyticsUserOverviewPage.goto();

  await expect(analyticsUserOverviewPage.heading).toBeVisible();

  const assignedSummary = page.locator('[data-user-overview-layout="assigned-summary"]');
  const assignedTable = page.locator('[data-user-overview-layout="assigned-table"]');
  const completedSummary = page.locator('[data-user-overview-layout="completed-summary"]');
  const completedTable = page.locator('[data-user-overview-layout="completed-table"]');

  await expect(assignedSummary).toBeVisible();
  await expect(assignedTable).toBeVisible();
  await expect(completedSummary).toBeVisible();
  await expect(completedTable).toBeVisible();

  const assignedSummaryBox = await assignedSummary.boundingBox();
  const assignedTableBox = await assignedTable.boundingBox();
  const completedSummaryBox = await completedSummary.boundingBox();
  const completedTableBox = await completedTable.boundingBox();

  expect(assignedSummaryBox).not.toBeNull();
  expect(assignedTableBox).not.toBeNull();
  expect(completedSummaryBox).not.toBeNull();
  expect(completedTableBox).not.toBeNull();

  expect((assignedSummaryBox as { y: number }).y).toBeLessThan((assignedTableBox as { y: number }).y);
  expect((completedSummaryBox as { y: number }).y).toBeLessThan((completedTableBox as { y: number }).y);
});
