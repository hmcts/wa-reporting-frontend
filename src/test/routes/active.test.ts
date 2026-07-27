import { Server } from 'http';

import request from 'supertest';

import { buildRouteTestServer } from './routeTestUtils';

describe('Active session route', () => {
  let server: Server;
  let closeServer: () => Promise<void>;

  beforeAll(async () => {
    ({ server, close: closeServer } = await buildRouteTestServer());
  });

  afterAll(() => closeServer());

  it('responds without content so authenticated browser activity can renew the rolling session', async () => {
    const response = await request(server).get('/active').expect(204);

    expect(response.text).toBe('');
  });
});
