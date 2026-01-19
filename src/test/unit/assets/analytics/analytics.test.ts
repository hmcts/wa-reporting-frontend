/* @jest-environment jsdom */
import { initAll as initMojAll } from '@ministryofjustice/frontend';

jest.mock('../../../../main/assets/scss/analytics.scss', () => ({}), { virtual: true });
jest.mock('govuk-frontend', () => ({ initAll: jest.fn() }));
jest.mock('@ministryofjustice/frontend', () => ({ initAll: jest.fn() }));

import '../../../../main/assets/js/analytics';
import { setupAnalyticsDom } from './analyticsTestUtils';

const flushPromises = async (): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 0));
};

describe('analytics bootstrap', () => {
  beforeEach(() => {
    setupAnalyticsDom();
  });

  test('runs DOMContentLoaded bootstrap without throwing', async () => {
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();
    expect(initMojAll).toHaveBeenCalled();
  });
});
