import { fail } from 'assert';

import { expect } from '@jest/globals';
import axios, { AxiosResponse } from 'axios';

const testUrl = process.env.TEST_URL || 'http://localhost:3100';

describe('Analytics user overview smoke test', () => {
  describe('User overview page loads', () => {
    test('with expected heading', async () => {
      try {
        const response: AxiosResponse = await axios.get(`${testUrl}/analytics/users`, {
          headers: {
            'Accept-Encoding': 'gzip',
          },
        });
        expect(response.data).toContain('<h1 class="govuk-heading-xl">User overview</h1>');
      } catch {
        fail('User overview heading not present and/or correct');
      }
    });
  });
});
