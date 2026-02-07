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

describe('Analytics outstanding route', () => {
  describe('on GET', () => {
    test('should render the outstanding page', async () => {
      const response = await request(server).get('/analytics/outstanding').expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('Tasks outstanding');
      expect(response.text).toContain('data-module="moj-sortable-table"');
      expect(response.text).toContain('resetFilters=1');
    }, 15000);

    test('should render the open tasks summary partial for ajax requests', async () => {
      const response = await request(server)
        .get('/analytics/outstanding?ajaxSection=open-tasks-summary')
        .set('X-Requested-With', 'fetch')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('Open tasks');
      expect(response.text).not.toContain('Tasks outstanding');
    }, 15000);

    test('should fall back to the full page when ajaxSection is unknown', async () => {
      const response = await request(server)
        .get('/analytics/outstanding?ajaxSection=unknown-section')
        .set('X-Requested-With', 'fetch')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('Tasks outstanding');
    });
  });

  describe('on POST', () => {
    test('should reject requests without a CSRF token', async () => {
      const response = await request(server).post('/analytics/outstanding').type('form').send({ service: 'Tribunal' });

      expect(response.status).toBe(403);
    });

    test('should accept requests with a CSRF token', async () => {
      const agent = request.agent(server);
      const tokenResponse = await agent.get('/analytics/outstanding').expect(200);
      const token = extractCsrfToken(tokenResponse.text);

      const response = await agent
        .post('/analytics/outstanding')
        .type('form')
        .send({ _csrf: token, service: 'Tribunal' })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('Tasks outstanding');
    });
  });
});
