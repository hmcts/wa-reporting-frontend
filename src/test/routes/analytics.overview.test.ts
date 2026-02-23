import { Server } from 'http';

import request from 'supertest';

import { buildRouteTestServer, extractCsrfToken, getFilterCookieName } from './routeTestUtils';

let server: Server;
let closeServer: () => Promise<void>;

beforeAll(async () => {
  ({ server, close: closeServer } = await buildRouteTestServer());
});

afterAll(() => {
  return closeServer();
});

describe('Analytics overview route', () => {
  describe('on GET', () => {
    test('should render the overview page', async () => {
      const response = await request(server).get('/').expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('Service performance overview');
      const workTypeIndex = response.text.indexOf('Work type');
      const taskNameIndex = response.text.indexOf('Task name');
      expect(workTypeIndex).toBeGreaterThan(-1);
      expect(taskNameIndex).toBeGreaterThan(-1);
      expect(workTypeIndex).toBeLessThan(taskNameIndex);
      expect(response.text).toContain('Created and completed tasks by service');
      expect(response.text).not.toContain('>Cancelled<');
      expect(response.text).toContain('data-module="moj-sortable-table"');
      expect(response.text).toContain('data-total-row="true"');
    });

    test('should render the service performance partial for ajax requests', async () => {
      const response = await request(server)
        .get('/?ajaxSection=overview-service-performance')
        .set('X-Requested-With', 'fetch')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('Open and assigned tasks by service');
      expect(response.text).not.toContain('Service performance overview');
    });

    test('should fall back to the full page when ajaxSection is unknown', async () => {
      const response = await request(server)
        .get('/?ajaxSection=unknown-section')
        .set('X-Requested-With', 'fetch')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('Service performance overview');
    });
  });

  describe('on POST', () => {
    test('should reject requests without a CSRF token', async () => {
      const response = await request(server).post('/').type('form').send({ service: 'Tribunal' });

      expect(response.status).toBe(403);
    });

    test('should accept requests with a CSRF token and set the filter cookie', async () => {
      const agent = request.agent(server);
      const tokenResponse = await agent.get('/').expect(200);
      const token = extractCsrfToken(tokenResponse.text);

      const response = await agent.post('/').type('form').send({ _csrf: token, service: 'Tribunal' }).expect(200);

      const cookieName = getFilterCookieName();
      const rawCookies = response.headers['set-cookie'];
      const cookies = Array.isArray(rawCookies) ? rawCookies : rawCookies ? [rawCookies] : [];
      expect(cookies.some((cookie: string) => cookie.startsWith(`${cookieName}=`))).toBe(true);
    });

    test('should render the service performance partial for ajax requests', async () => {
      const agent = request.agent(server);
      const tokenResponse = await agent.get('/').expect(200);
      const token = extractCsrfToken(tokenResponse.text);

      const response = await agent
        .post('/')
        .set('X-Requested-With', 'fetch')
        .type('form')
        .send({ _csrf: token, ajaxSection: 'overview-service-performance' })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('Open and assigned tasks by service');
      expect(response.text).not.toContain('Service performance overview');
    });
  });
});

describe('Analytics overview route with authentication enabled', () => {
  let authServer: Server;
  let closeAuthServer: () => Promise<void>;

  beforeAll(async () => {
    ({ server: authServer, close: closeAuthServer } = await buildRouteTestServer({ authEnabled: true }));
  });

  afterAll(() => {
    return closeAuthServer();
  });

  test('should forbid unauthenticated access', async () => {
    const response = await request(authServer).get('/').expect(403);

    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('Sorry, access to this resource is forbidden');
  });
});
