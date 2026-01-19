import { fail } from 'assert';

import { expect } from '@jest/globals';
import axios, { AxiosResponse } from 'axios';

const testUrl = process.env.TEST_URL || 'http://localhost:3100';

describe('Analytics overview smoke test', () => {
  describe('Overview page loads', () => {
    test('with expected heading', async () => {
      try {
        const response: AxiosResponse = await axios.get(`${testUrl}/analytics/overview`, {
          headers: {
            'Accept-Encoding': 'gzip',
          },
        });
        expect(response.data).toContain('<h1 class="govuk-heading-xl">Service performance overview</h1>');
      } catch {
        fail('Overview heading not present and/or correct');
      }
    });
  });
});
