import type { Application } from 'express';

describe('redis module', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('returns null when redis host is not configured', () => {
    const configValues: Record<string, unknown> = {
      'secrets.wa.wa-reporting-redis-host': undefined,
    };

    jest.doMock('config', () => ({
      get: jest.fn((key: string) => configValues[key]),
    }));

    const createClient = jest.fn();
    jest.doMock('redis', () => ({ createClient }));
    jest.doMock('@hmcts/nodejs-logging', () => ({
      Logger: { getLogger: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })) },
    }));

    const app = { locals: {} } as unknown as Application;

    jest.isolateModules(() => {
      const { getRedisClient } = require('../../../../main/modules/redis');
      const client = getRedisClient(app);
      expect(client).toBeNull();
    });

    expect(createClient).not.toHaveBeenCalled();
  });

  it('creates and caches a redis client when host is configured', () => {
    const configValues: Record<string, unknown> = {
      'secrets.wa.wa-reporting-redis-host': 'redis-host',
      'secrets.wa.wa-reporting-redis-port': 6379,
      'secrets.wa.wa-reporting-redis-access-key': 'redis-key',
    };

    const connect = jest.fn().mockResolvedValue(undefined);
    const on = jest.fn();
    const redisClient = { connect, on };
    const createClient = jest.fn(() => redisClient);

    jest.doMock('config', () => ({
      get: jest.fn((key: string) => configValues[key]),
    }));
    jest.doMock('redis', () => ({ createClient }));
    jest.doMock('@hmcts/nodejs-logging', () => ({
      Logger: { getLogger: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })) },
    }));

    const app = { locals: {} } as unknown as Application;

    jest.isolateModules(() => {
      const { getRedisClient } = require('../../../../main/modules/redis');
      const client = getRedisClient(app);

      expect(client).toBe(redisClient);
    });

    expect(createClient).toHaveBeenCalledWith({
      password: 'redis-key',
      socket: {
        host: 'redis-host',
        port: 6379,
        tls: true,
        connectTimeout: 5000,
        reconnectStrategy: expect.any(Function),
      },
    });
    expect(connect).toHaveBeenCalled();
    expect(app.locals.redisClient).toBe(redisClient);
    expect(app.locals.appRedisClient).toBe(redisClient);
    expect(app.locals.redisConnectPromise).toBeDefined();
  });

  it('does not set tls when redis key is missing', () => {
    const configValues: Record<string, unknown> = {
      'secrets.wa.wa-reporting-redis-host': 'redis-host',
      'secrets.wa.wa-reporting-redis-port': 6379,
      'secrets.wa.wa-reporting-redis-access-key': '',
    };

    const connect = jest.fn().mockResolvedValue(undefined);
    const on = jest.fn();
    const redisClient = { connect, on };
    const createClient = jest.fn(() => redisClient);

    jest.doMock('config', () => ({
      get: jest.fn((key: string) => configValues[key]),
    }));
    jest.doMock('redis', () => ({ createClient }));
    jest.doMock('@hmcts/nodejs-logging', () => ({
      Logger: { getLogger: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })) },
    }));

    const app = { locals: {} } as unknown as Application;

    jest.isolateModules(() => {
      const { getRedisClient } = require('../../../../main/modules/redis');
      getRedisClient(app);
    });

    expect(createClient).toHaveBeenCalledWith({
      socket: {
        host: 'redis-host',
        port: 6379,
        connectTimeout: 5000,
        reconnectStrategy: expect.any(Function),
      },
    });
  });

  it('reuses an existing redis client stored on app locals', () => {
    const configValues: Record<string, unknown> = {
      'secrets.wa.wa-reporting-redis-host': 'redis-host',
    };

    jest.doMock('config', () => ({
      get: jest.fn((key: string) => configValues[key]),
    }));

    const createClient = jest.fn();
    jest.doMock('redis', () => ({ createClient }));
    jest.doMock('@hmcts/nodejs-logging', () => ({
      Logger: { getLogger: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })) },
    }));

    const existingClient = { connect: jest.fn(), on: jest.fn() };
    const app = { locals: { redisClient: existingClient } } as unknown as Application;

    jest.isolateModules(() => {
      const { getRedisClient } = require('../../../../main/modules/redis');
      const client = getRedisClient(app);
      expect(client).toBe(existingClient);
    });

    expect(createClient).not.toHaveBeenCalled();
  });
});
