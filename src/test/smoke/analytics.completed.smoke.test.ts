import { fail } from 'assert';

import { expect } from '@jest/globals';
import axios, { AxiosResponse } from 'axios';

const testUrl = process.env.TEST_URL || 'http://localhost:3100';

describe('Analytics completed smoke test', () => {
  describe('Completed page loads', () => {
    test('with expected heading', async () => {
      try {
        const response: AxiosResponse = await axios.get(`${testUrl}/analytics/completed`, {
          headers: {
            'Accept-Encoding': 'gzip',
          },
        });
        expect(response.data).toContain('<h1 class="govuk-heading-xl">Completed tasks</h1>');
        expect(response.data).toContain('Processing and handling time');
      } catch {
        fail('Completed heading not present and/or correct');
      }
    });
  });
});
