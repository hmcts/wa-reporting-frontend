import { Server } from 'http';

import { expect } from 'chai';
import request from 'supertest';

import { app } from '../../main/app';

let server: Server;

beforeAll(() => {
  server = app.listen(0, '127.0.0.1');
});

afterAll(() => {
  return server.close();
});

describe('Analytics outstanding route', () => {
  describe('on GET', () => {
    test('should render the outstanding page', async () => {
      const response = await request(server).get('/analytics/outstanding').expect(200);

      expect(response.headers['content-type']).to.contain('text/html');
      expect(response.text).to.contain('Tasks outstanding');
    }, 15000);
  });
});
