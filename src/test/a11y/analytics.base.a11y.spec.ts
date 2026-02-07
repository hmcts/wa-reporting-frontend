import { buildUrl } from '../playwright/config';
import { AnalyticsLandingPage } from '../playwright/page-objects/pages';
import { expect, test } from '../playwright/fixtures';

import { A11Y_EXCLUDED_SELECTORS } from './a11y.constants';

test.describe('Analytics landing page accessibility', () => {
  test('should have no accessibility errors @a11y', async ({ page, axeUtils }) => {
    const analyticsLandingPage = new AnalyticsLandingPage(page);

    await page.goto(buildUrl('/analytics'));

    await expect(analyticsLandingPage.heading).toBeVisible();
    await axeUtils.audit({ exclude: A11Y_EXCLUDED_SELECTORS });
  });
});
