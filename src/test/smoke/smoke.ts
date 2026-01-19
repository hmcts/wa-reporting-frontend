import { fail } from 'assert';

import { expect } from '@jest/globals';
import axios, { AxiosResponse } from 'axios';

const testUrl = process.env.TEST_URL || 'http://localhost:3100';

describe('Smoke Test', () => {
  describe('Home page loads', () => {
    test('with correct content', async () => {
      try {
        const response: AxiosResponse = await axios.get(testUrl, {
          headers: {
            'Accept-Encoding': 'gzip',
          },
        });
        expect(response.data).toContain('<h1 class="govuk-heading-xl">Analytics</h1>');
      } catch {
        fail('Heading not present and/or correct');
      }
    });
  });
});
