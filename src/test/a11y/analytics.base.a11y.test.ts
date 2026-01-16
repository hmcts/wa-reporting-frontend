import { Server } from 'http';
import { AddressInfo } from 'net';

import supertest from 'supertest';

import { app } from '../../main/app';

const pa11y = require('pa11y');

let server: Server;
let port: number;

beforeAll(() => {
  server = app.listen(0, '127.0.0.1');
  const address = server.address();
  if (address && typeof address !== 'string') {
    port = (address as AddressInfo).port;
  } else {
    throw new Error('Server address is not available');
  }
});

afterAll(() => {
  return server.close();
});

function ensurePageCallWillSucceed(url: string): Promise<void> {
  return supertest(app)
    .get(url)
    .then((res: supertest.Response) => {
      if (res.status >= 400) {
        throw new Error(`Call to ${url} failed with status: ${res.status}`);
      }
    });
}

function runPa11y(url: string) {
  const fullUrl = `http://localhost:${port}${url}`;
  return pa11y(fullUrl, {
    hideElements: '.govuk-footer__licence-logo, .govuk-header__logotype-crown',
    timeout: 120000,
    chromeLaunchConfig: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
  });
}

function expectNoErrors(issues: { type: string }[]): void {
  const errors = issues.filter(issue => issue.type === 'error');
  if (errors.length > 0) {
    const errorsAsJson = `${JSON.stringify(errors, null, 2)}`;
    throw new Error(`There are accessibility issues: \n${errorsAsJson}\n`);
  }
}

describe('Analytics landing page', () => {
  test('should have no accessibility errors', async () => {
    await ensurePageCallWillSucceed('/analytics');
    const result = await runPa11y('/analytics');
    expect(result.issues).toEqual(expect.any(Array));
    expectNoErrors(result.issues);
  }, 150000);
});
