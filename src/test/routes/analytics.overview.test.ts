import { Server } from 'http';

import { expect } from '@jest/globals';
import request from 'supertest';

import { app } from '../../main/app';

let server: Server;

beforeAll(() => {
  server = app.listen(0, '127.0.0.1');
});

afterAll(() => {
  return server.close();
});

describe('Analytics overview route', () => {
  describe('on GET', () => {
    test('should render the overview page', async () => {
      const response = await request(server).get('/analytics/overview').expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('Service performance overview');
      expect(response.text).toContain('data-module="moj-sortable-table"');
      expect(response.text).toContain('data-total-row="true"');
    });
  });
});
