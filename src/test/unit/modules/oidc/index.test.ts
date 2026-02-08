import type { Application, Request, Response } from 'express';

type AuthOptions = {
  baseURL: string;
  clientID: string;
  session: { store: unknown };
  afterCallback: (req: Request, res: Response, session: { id_token?: string }) => unknown;
};

const buildOidc = (overrides: Record<string, unknown> = {}) => {
  const configValues: Record<string, unknown> = {
    'services.idam.clientID': 'client-id',
    'services.idam.clientSecret': 'client-secret',
    'services.idam.scope': 'openid profile',
    'services.idam.url.wa': 'http://wa',
    'services.idam.url.public': 'http://idam',
    'session.secret': 'session-secret',
    'RBAC.access': 'role-access',
    'session.cookie.name': 'session-cookie',
    'session.redis.host': 'redis-host',
    'session.redis.port': 6379,
    'session.redis.key': 'redis-pass',
    ...overrides,
  };

  let authOptions: AuthOptions | undefined;
  const auth = jest.fn((options: AuthOptions) => {
    authOptions = options;
    return 'auth-middleware';
  });
  const jwtDecode = jest.fn();
  const redisStore = jest.fn().mockImplementation(() => ({ store: 'redis' }));
  const redisClient = { connect: jest.fn(), on: jest.fn() };
  const createClient = jest.fn(() => redisClient);
  const fileStore = jest.fn().mockImplementation(() => ({ store: 'file' }));
  const fileStoreFactory = jest.fn(() => fileStore);

  jest.doMock('config', () => ({
    get: jest.fn((key: string) => configValues[key]),
  }));

  jest.doMock('express-openid-connect', () => ({
    auth,
  }));

  jest.doMock('connect-redis', () => ({
    RedisStore: redisStore,
  }));

  jest.doMock('redis', () => ({
    createClient,
  }));

  jest.doMock('@hmcts/nodejs-logging', () => ({
    Logger: { getLogger: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })) },
  }));

  jest.doMock('session-file-store', () => fileStoreFactory);
  jest.doMock('express-session', () => jest.fn());
  jest.doMock('jwt-decode', () => ({ jwtDecode }));

  type OidcInstance = {
    enableFor: (app: Application) => void;
    getSessionStore?: (app: Application) => unknown;
  };
  type OidcConstructor = new () => OidcInstance;

  let OidcMiddleware: OidcConstructor | undefined;

  jest.isolateModules(() => {
    OidcMiddleware = require('../../../../main/modules/oidc').OidcMiddleware;
  });

  if (!OidcMiddleware) {
    throw new Error('OidcMiddleware not initialised');
  }

  return {
    OidcMiddleware,
    auth,
    jwtDecode,
    redisStore,
    redisClient,
    createClient,
    fileStore,
    fileStoreFactory,
    configValues,
    authOptions: () => authOptions,
  };
};

describe('OidcMiddleware', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('configures auth middleware and uses redis when configured', () => {
    const { OidcMiddleware, authOptions, createClient, redisClient } = buildOidc();
    const app = { use: jest.fn(), locals: {} } as unknown as Application;

    const instance = new OidcMiddleware();
    instance.enableFor(app);

    const useMock = app.use as jest.Mock;
    const options = authOptions() as AuthOptions;
    expect(options.baseURL).toBe('http://wa');
    expect(options.clientID).toBe('client-id');
    expect(options.session.store).toEqual({ store: 'redis' });
    expect(useMock).toHaveBeenCalledTimes(2);
    expect(useMock).toHaveBeenNthCalledWith(1, 'auth-middleware');
    expect(typeof useMock.mock.calls[1][0]).toBe('function');
    expect(app.locals.redisClient).toBeDefined();
    expect(createClient).toHaveBeenCalledWith({
      password: 'redis-pass',
      socket: {
        host: 'redis-host',
        port: 6379,
        tls: true,
        connectTimeout: 5000,
        reconnectStrategy: expect.any(Function),
      },
    });
    expect(redisClient.connect).toHaveBeenCalled();
  });

  it('falls back to file store when redis is not configured', () => {
    const { OidcMiddleware, fileStore } = buildOidc({ 'session.redis.host': undefined });
    const app = { use: jest.fn(), locals: {} } as unknown as Application;

    const instance = new OidcMiddleware();
    const store = instance.getSessionStore?.(app);

    expect(store).toEqual({ store: 'file' });
    expect(fileStore).toHaveBeenCalledWith({ path: '/tmp' });
  });

  it('afterCallback throws for missing token or non-200 response', () => {
    const { OidcMiddleware, authOptions } = buildOidc();
    const app = { use: jest.fn(), locals: {} } as unknown as Application;
    const instance = new OidcMiddleware();
    instance.enableFor(app);

    const afterCallback = (authOptions() as AuthOptions).afterCallback;

    const res = { statusCode: 403 } as Response;
    expect(() => afterCallback({} as Request, res, {})).toThrow();

    const okRes = { statusCode: 200 } as Response;
    expect(() => afterCallback({} as Request, okRes, {})).toThrow();
  });

  it('afterCallback rethrows decode errors', () => {
    const { OidcMiddleware, jwtDecode, authOptions } = buildOidc();
    const app = { use: jest.fn(), locals: {} } as unknown as Application;
    const instance = new OidcMiddleware();
    instance.enableFor(app);

    const afterCallback = (authOptions() as AuthOptions).afterCallback;

    jwtDecode.mockImplementation(() => {
      throw new Error('bad token');
    });

    const res = { statusCode: 200 } as Response;
    const session = { id_token: 'token' };

    expect(() => afterCallback({} as Request, res, session)).toThrow('bad token');
  });

  it('afterCallback rejects when access role is missing', () => {
    const { OidcMiddleware, jwtDecode, authOptions } = buildOidc();
    const app = { use: jest.fn(), locals: {} } as unknown as Application;
    const instance = new OidcMiddleware();
    instance.enableFor(app);

    const afterCallback = (authOptions() as AuthOptions).afterCallback;

    jwtDecode.mockReturnValue({ uid: 'u1', email: 'user@hmcts.net', roles: ['role-other'] });

    const res = { statusCode: 200 } as Response;
    const session = { id_token: 'token' };

    expect(() => afterCallback({} as Request, res, session)).toThrow();
  });

  it('afterCallback returns enriched session for valid users', () => {
    const { OidcMiddleware, jwtDecode, authOptions } = buildOidc();
    const app = { use: jest.fn(), locals: {} } as unknown as Application;
    const instance = new OidcMiddleware();
    instance.enableFor(app);

    const afterCallback = (authOptions() as AuthOptions).afterCallback;

    jwtDecode.mockReturnValue({ uid: 'u1', email: 'user@hmcts.net', roles: ['role-access'] });

    const res = { statusCode: 200 } as Response;
    const session = { id_token: 'token' };

    const result = afterCallback({} as Request, res, session) as {
      user: { id: string; email: string; roles: string[] };
    };

    expect(result.user).toEqual({ id: 'u1', email: 'user@hmcts.net', roles: ['role-access'] });
  });

  it('rejects unauthenticated or unauthorized requests in the guard', () => {
    const { OidcMiddleware } = buildOidc();
    const app = { use: jest.fn(), locals: {} } as unknown as Application;
    const instance = new OidcMiddleware();
    instance.enableFor(app);

    const guard = (app.use as jest.Mock).mock.calls[1][0] as (req: Request, res: Response, next: () => void) => void;

    const unauthenticatedReq = { oidc: { isAuthenticated: () => false, user: { roles: ['role-access'] } } } as Request;
    expect(() => guard(unauthenticatedReq, {} as Response, jest.fn())).toThrow();

    const unauthorizedReq = { oidc: { isAuthenticated: () => true, user: { roles: ['role-other'] } } } as Request;
    expect(() => guard(unauthorizedReq, {} as Response, jest.fn())).toThrow();
  });

  it('allows authenticated requests with the access role in the guard', () => {
    const { OidcMiddleware } = buildOidc();
    const app = { use: jest.fn(), locals: {} } as unknown as Application;
    const instance = new OidcMiddleware();
    instance.enableFor(app);

    const guard = (app.use as jest.Mock).mock.calls[1][0] as (req: Request, res: Response, next: () => void) => void;
    const next = jest.fn();

    const req = { oidc: { isAuthenticated: () => true, user: { roles: ['role-access'] } } } as Request;
    guard(req, {} as Response, next);

    expect(next).toHaveBeenCalled();
  });
});
