import { Server } from 'http';

import request from 'supertest';

import { buildRouteTestServer, extractCsrfToken } from './routeTestUtils';

let server: Server;
let closeServer: () => Promise<void>;

beforeAll(async () => {
  ({ server, close: closeServer } = await buildRouteTestServer());
});

afterAll(() => {
  return closeServer();
});

describe('Analytics completed routes', () => {
  describe('on GET', () => {
    test('should render the completed page', async () => {
      const response = await request(server).get('/analytics/completed').expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('Completed tasks');
      expect(response.text).toContain('Work type');
      expect(response.text).toContain('Processing and handling time');
      expect(response.text).toContain('data-module="moj-sortable-table"');
    });

    test('should render the completed summary partial for ajax requests', async () => {
      const response = await request(server)
        .get('/analytics/completed?ajaxSection=completed-summary')
        .set('X-Requested-With', 'fetch')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('Completed tasks (today)');
      expect(response.text).not.toContain('Processing and handling time');
    });

    test('should fall back to the full page when ajaxSection is unknown', async () => {
      const response = await request(server)
        .get('/analytics/completed?ajaxSection=unknown-section')
        .set('X-Requested-With', 'fetch')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('Completed tasks');
    });
  });

  describe('on POST', () => {
    test('should reject requests without a CSRF token', async () => {
      const response = await request(server)
        .post('/analytics/completed')
        .type('form')
        .send({ metric: 'processingTime' });

      expect(response.status).toBe(403);
    });

    test('should accept requests with a CSRF token', async () => {
      const agent = request.agent(server);
      const tokenResponse = await agent.get('/analytics/completed').expect(200);
      const token = extractCsrfToken(tokenResponse.text);

      const response = await agent
        .post('/analytics/completed')
        .type('form')
        .send({ _csrf: token, metric: 'processingTime' })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('Completed tasks');
    });
  });
});
