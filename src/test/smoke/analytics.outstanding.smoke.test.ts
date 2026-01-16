import { fail } from 'assert';

import axios, { AxiosResponse } from 'axios';
import { expect } from 'chai';

const testUrl = process.env.TEST_URL || 'http://localhost:3100';

describe('Analytics outstanding smoke test', () => {
  describe('Outstanding page loads', () => {
    test('with expected heading', async () => {
      try {
        const response: AxiosResponse = await axios.get(`${testUrl}/analytics/outstanding`, {
          headers: {
            'Accept-Encoding': 'gzip',
          },
        });
        expect(response.data).includes('<h1 class="govuk-heading-xl">Tasks outstanding</h1>');
      } catch {
        fail('Outstanding heading not present and/or correct');
      }
    });
  });
});
