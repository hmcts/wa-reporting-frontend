import type { Application } from 'express';

describe('AppSession module', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('configures redis-backed sessions when redis is available', () => {
    const configValues: Record<string, unknown> = {
      'session.secret': 'secret',
      'session.appCookie.name': 'app-cookie',
      'session.redis.host': 'redis-host',
      'session.redis.port': 6379,
      'session.redis.key': 'redis-key',
    };

    const sessionMiddleware = jest.fn(() => 'session-middleware');
    const redisStore = jest.fn().mockImplementation(() => ({ store: 'redis' }));
    const redisClient = { connect: jest.fn() };
    const createClient = jest.fn(() => redisClient);

    jest.doMock('config', () => ({
      get: jest.fn((key: string) => configValues[key]),
    }));
    jest.doMock('express-session', () => sessionMiddleware);
    jest.doMock('connect-redis', () => ({ RedisStore: redisStore }));
    jest.doMock('redis', () => ({ createClient }));

    const app = { use: jest.fn(), locals: {} } as unknown as Application;

    jest.isolateModules(() => {
      const { AppSession } = require('../../../../main/modules/session');
      new AppSession().enableFor(app);
    });

    expect(createClient).toHaveBeenCalledWith({
      password: 'redis-key',
      socket: { host: 'redis-host', port: 6379, tls: true },
    });
    expect(redisClient.connect).toHaveBeenCalled();
    expect(app.locals.appRedisClient).toBeDefined();
    expect(sessionMiddleware).toHaveBeenCalledWith(expect.objectContaining({ store: { store: 'redis' } }));
    expect(app.use).toHaveBeenCalledWith('session-middleware');
  });

  it('configures redis without tls when access key is not provided', () => {
    const configValues: Record<string, unknown> = {
      'session.secret': 'secret',
      'session.appCookie.name': 'app-cookie',
      'session.redis.host': 'redis-host',
      'session.redis.port': 6379,
      'session.redis.key': '',
    };

    const sessionMiddleware = jest.fn(() => 'session-middleware');
    const redisStore = jest.fn().mockImplementation(() => ({ store: 'redis' }));
    const redisClient = { connect: jest.fn() };
    const createClient = jest.fn(() => redisClient);

    jest.doMock('config', () => ({
      get: jest.fn((key: string) => configValues[key]),
    }));
    jest.doMock('express-session', () => sessionMiddleware);
    jest.doMock('connect-redis', () => ({ RedisStore: redisStore }));
    jest.doMock('redis', () => ({ createClient }));

    const app = { use: jest.fn(), locals: {} } as unknown as Application;

    jest.isolateModules(() => {
      const { AppSession } = require('../../../../main/modules/session');
      new AppSession().enableFor(app);
    });

    expect(createClient).toHaveBeenCalledWith({ socket: { host: 'redis-host', port: 6379 } });
    expect(redisClient.connect).toHaveBeenCalled();
    expect(app.locals.appRedisClient).toBeDefined();
    expect(sessionMiddleware).toHaveBeenCalledWith(expect.objectContaining({ store: { store: 'redis' } }));
    expect(app.use).toHaveBeenCalledWith('session-middleware');
  });

  it('falls back to file store when redis is missing', () => {
    const configValues: Record<string, unknown> = {
      'session.secret': 'secret',
      'session.appCookie.name': 'app-cookie',
      'session.redis.host': undefined,
      'session.redis.port': undefined,
      'session.redis.key': undefined,
    };

    const sessionMiddleware = jest.fn(() => 'session-middleware');
    const fileStore = jest.fn().mockImplementation(() => ({ store: 'file' }));
    const fileStoreFactory = jest.fn(() => fileStore);

    jest.doMock('config', () => ({
      get: jest.fn((key: string) => configValues[key]),
    }));
    jest.doMock('express-session', () => sessionMiddleware);
    jest.doMock('session-file-store', () => fileStoreFactory);

    const app = { use: jest.fn(), locals: {} } as unknown as Application;

    jest.isolateModules(() => {
      const { AppSession } = require('../../../../main/modules/session');
      new AppSession().enableFor(app);
    });

    expect(fileStoreFactory).toHaveBeenCalled();
    expect(fileStore).toHaveBeenCalledWith({ path: '/tmp' });
    expect(sessionMiddleware).toHaveBeenCalledWith(expect.objectContaining({ store: { store: 'file' } }));
    expect(app.use).toHaveBeenCalledWith('session-middleware');
  });
});
