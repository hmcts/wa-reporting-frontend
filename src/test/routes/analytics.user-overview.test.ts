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

describe('Analytics user overview route', () => {
  describe('on GET', () => {
    test('should render the user overview page', async () => {
      const response = await request(server).get('/users').expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('User overview');
      const workTypeIndex = response.text.indexOf('Work type');
      const taskNameIndex = response.text.indexOf('Task name');
      expect(workTypeIndex).toBeGreaterThan(-1);
      expect(taskNameIndex).toBeGreaterThan(-1);
      expect(workTypeIndex).toBeLessThan(taskNameIndex);
      expect(response.text).toContain('data-module="moj-sortable-table"');
    });

    test('should render the assigned tasks partial for ajax requests', async () => {
      const response = await request(server)
        .get('/users?ajaxSection=user-overview-assigned')
        .set('X-Requested-With', 'fetch')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('Currently assigned tasks');
      expect(response.text).not.toContain('User overview');
    });

    test('should fall back to the full page when ajaxSection is unknown', async () => {
      const response = await request(server)
        .get('/users?ajaxSection=unknown-section')
        .set('X-Requested-With', 'fetch')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('User overview');
    });
  });

  describe('on POST', () => {
    test('should reject requests without a CSRF token', async () => {
      const response = await request(server).post('/users').type('form').send({ user: '123' });

      expect(response.status).toBe(403);
    });

    test('should accept requests with a CSRF token', async () => {
      const agent = request.agent(server);
      const tokenResponse = await agent.get('/users').expect(200);
      const token = extractCsrfToken(tokenResponse.text);

      const response = await agent.post('/users').type('form').send({ _csrf: token, user: '123' }).expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('User overview');
    });
  });
});
