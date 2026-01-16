import { fail } from 'assert';

import axios, { AxiosResponse } from 'axios';
import { expect } from 'chai';

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
        expect(response.data).includes('<h1 class="govuk-heading-xl">Completed tasks</h1>');
        expect(response.data).includes('Processing and handling time');
      } catch {
        fail('Completed heading not present and/or correct');
      }
    });
  });
});
