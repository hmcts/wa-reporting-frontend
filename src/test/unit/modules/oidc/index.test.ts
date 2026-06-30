import type { Application, Request, Response } from 'express';

import { WA_REPORTING_AUTHORIZATION_SESSION_KEY } from '../../../../main/modules/oidc/roleAssignmentAccess';

type AuthOptions = {
  issuerBaseURL: string;
  baseURL: string;
  clientID: string;
  secret: string;
  clientSecret: string;
  authorizationParams: {
    response_type: string;
    scope: string;
  };
  session: {
    name: string;
    store: unknown;
    rollingDuration: number;
    cookie: {
      httpOnly: boolean;
    };
    rolling: boolean;
  };
  afterCallback: (
    req: Request,
    res: Response,
    session: { id_token?: string; access_token?: string }
  ) => Promise<unknown> | unknown;
};

const fixedNow = new Date('2026-06-28T12:00:00.000Z');

const expectForbiddenHttpError = async (action: () => unknown | Promise<unknown>): Promise<void> => {
  let thrownError: unknown;

  try {
    await action();
  } catch (error) {
    thrownError = error;
  }

  expect((thrownError as { constructor?: { name?: string } }).constructor?.name).toBe('HTTPError');
  expect((thrownError as { status?: number }).status).toBe(403);
};

const buildOidc = (overrides: Record<string, unknown> = {}) => {
  const configValues: Record<string, unknown> = {
    'services.idam.clientID': 'client-id',
    'secrets.wa.wa-reporting-frontend-client-secret': 'client-secret',
    'services.idam.scope': 'openid profile',
    'services.idam.url.wa': 'http://wa',
    'services.idam.url.public': 'http://idam',
    'services.roleAssignment.url': 'http://ras',
    'services.s2s.url': 'http://s2s',
    'secrets.wa.wa-reporting-frontend-session-secret': 'wa-reporting-frontend-session-secret',
    'secrets.wa.wa-reporting-frontend-s2s-secret': 's2s-secret',
    'RBAC.access': 'role-access',
    'RBAC.roleAssignmentRoleNames': 'task-supervisor',
    'session.cookie.name': 'session-cookie',
    'secrets.wa.wa-reporting-redis-host': 'redis-host',
    'secrets.wa.wa-reporting-redis-port': 6379,
    'secrets.wa.wa-reporting-redis-access-key': 'redis-pass',
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
  const roleAssignmentGetAssignmentsForActor = jest.fn();
  const roleAssignmentClient = jest.fn().mockImplementation(() => ({
    getAssignmentsForActor: roleAssignmentGetAssignmentsForActor,
  }));
  const s2sTokenClient = jest.fn().mockImplementation(() => ({ getToken: jest.fn() }));
  const loggerWarn = jest.fn();

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

  jest.doMock('../../../../main/modules/logging', () => ({
    Logger: { getLogger: jest.fn(() => ({ info: jest.fn(), warn: loggerWarn, error: jest.fn() })) },
  }));

  jest.doMock('../../../../main/modules/role-assignment/roleAssignmentClient', () => ({
    RoleAssignmentClient: roleAssignmentClient,
  }));

  jest.doMock('../../../../main/modules/s2s/s2sTokenClient', () => ({
    S2sTokenClient: s2sTokenClient,
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
    roleAssignmentClient,
    roleAssignmentGetAssignmentsForActor,
    s2sTokenClient,
    loggerWarn,
    authOptions: () => authOptions,
  };
};

describe('OidcMiddleware', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(fixedNow);
    jest.resetModules();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('configures auth middleware, role assignment clients, and uses redis when configured', () => {
    const { OidcMiddleware, authOptions, createClient, redisClient, roleAssignmentClient, s2sTokenClient } =
      buildOidc();
    const app = { use: jest.fn(), locals: {} } as unknown as Application;

    const instance = new OidcMiddleware();
    instance.enableFor(app);

    const useMock = app.use as jest.Mock;
    const options = authOptions() as AuthOptions;
    expect(options.issuerBaseURL).toBe('http://idam/o');
    expect(options.baseURL).toBe('http://wa');
    expect(options.clientID).toBe('client-id');
    expect(options.secret).toBe('wa-reporting-frontend-session-secret');
    expect(options.clientSecret).toBe('client-secret');
    expect(options.authorizationParams.scope).toBe('openid profile');
    expect(options.session.name).toBe('session-cookie');
    expect(options.session.store).toEqual({ store: 'redis' });
    expect(options.session.rollingDuration).toBe(60 * 60);
    expect(options.session.cookie.httpOnly).toBe(true);
    expect(options.session.rolling).toBe(true);
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
    expect(s2sTokenClient).toHaveBeenCalledWith('http://s2s', 's2s-secret');
    expect(roleAssignmentClient).toHaveBeenCalledWith('http://ras', expect.any(Object));
  });

  it('falls back to file store when redis is not configured', () => {
    const { OidcMiddleware, authOptions, fileStore } = buildOidc({
      'secrets.wa.wa-reporting-redis-host': undefined,
    });
    const app = { use: jest.fn(), locals: {} } as unknown as Application;

    const instance = new OidcMiddleware();
    instance.enableFor(app);

    const options = authOptions() as AuthOptions;
    expect(options.session.store).toEqual({ store: 'file' });
    expect(fileStore).toHaveBeenCalledWith({ path: '/tmp' });
  });

  it('afterCallback throws for missing token or non-200 response', async () => {
    expect.hasAssertions();

    const { OidcMiddleware, authOptions } = buildOidc();
    const app = { use: jest.fn(), locals: {} } as unknown as Application;
    const instance = new OidcMiddleware();
    instance.enableFor(app);

    const afterCallback = (authOptions() as AuthOptions).afterCallback;

    const res = { statusCode: 403 } as Response;
    await expectForbiddenHttpError(() => afterCallback({} as Request, res, {}));

    const okRes = { statusCode: 200 } as Response;
    await expectForbiddenHttpError(() => afterCallback({} as Request, okRes, {}));
  });

  it('afterCallback rethrows decode errors', async () => {
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

    await expect(afterCallback({} as Request, res, session)).rejects.toThrow('bad token');
  });

  it('afterCallback rejects when IDAM role is missing and no active role assignment matches', async () => {
    expect.hasAssertions();

    const { OidcMiddleware, jwtDecode, authOptions, roleAssignmentGetAssignmentsForActor } = buildOidc();
    const app = { use: jest.fn(), locals: {} } as unknown as Application;
    const instance = new OidcMiddleware();
    instance.enableFor(app);

    const afterCallback = (authOptions() as AuthOptions).afterCallback;

    jwtDecode.mockReturnValue({ uid: 'u1', email: 'user@hmcts.net', roles: ['role-other'] });
    roleAssignmentGetAssignmentsForActor.mockResolvedValue([
      { roleName: 'task-supervisor', beginTime: '2026-06-28T12:00:01Z', endTime: null },
      { roleName: 'role-access', beginTime: null, endTime: null },
    ]);

    const res = { statusCode: 200 } as Response;
    const session = { id_token: 'token', access_token: 'access-token' };

    await expectForbiddenHttpError(() => afterCallback({} as Request, res, session));
    expect(roleAssignmentGetAssignmentsForActor).toHaveBeenCalledWith('u1', 'access-token');
  });

  it('afterCallback rejects when a RAS lookup is needed but the access token is missing', async () => {
    expect.hasAssertions();

    const { OidcMiddleware, jwtDecode, authOptions, roleAssignmentGetAssignmentsForActor } = buildOidc();
    const app = { use: jest.fn(), locals: {} } as unknown as Application;
    const instance = new OidcMiddleware();
    instance.enableFor(app);

    const afterCallback = (authOptions() as AuthOptions).afterCallback;

    jwtDecode.mockReturnValue({ uid: 'u1', email: 'user@hmcts.net', roles: ['role-other'] });

    const res = { statusCode: 200 } as Response;
    const session = { id_token: 'token' };

    await expectForbiddenHttpError(() => afterCallback({} as Request, res, session));
    expect(roleAssignmentGetAssignmentsForActor).not.toHaveBeenCalled();
  });

  it('afterCallback fails closed when RAS lookup fails', async () => {
    expect.hasAssertions();

    const { OidcMiddleware, jwtDecode, authOptions, roleAssignmentGetAssignmentsForActor, loggerWarn } = buildOidc();
    const app = { use: jest.fn(), locals: {} } as unknown as Application;
    const instance = new OidcMiddleware();
    instance.enableFor(app);

    const afterCallback = (authOptions() as AuthOptions).afterCallback;

    jwtDecode.mockReturnValue({ uid: 'u1', email: 'user@hmcts.net', roles: ['role-other'] });
    roleAssignmentGetAssignmentsForActor.mockRejectedValue(
      Object.assign(new Error('ras failed'), {
        code: 'ERR_BAD_RESPONSE',
        response: { status: 500 },
        config: {
          headers: {
            Authorization: 'Bearer access-token',
            ServiceAuthorization: 'Bearer service-token',
          },
        },
      })
    );

    const res = { statusCode: 200 } as Response;
    const session = { id_token: 'token', access_token: 'access-token' };

    await expectForbiddenHttpError(() => afterCallback({} as Request, res, session));
    expect(loggerWarn).toHaveBeenCalledWith('Role assignment authorization failed', {
      name: 'Error',
      message: 'ras failed',
      code: 'ERR_BAD_RESPONSE',
      status: 500,
    });
    expect(JSON.stringify(loggerWarn.mock.calls)).not.toContain('Bearer');
  });

  it('afterCallback fails closed when the RAS response is malformed', async () => {
    expect.hasAssertions();

    const { OidcMiddleware, jwtDecode, authOptions, roleAssignmentGetAssignmentsForActor, loggerWarn } = buildOidc();
    const app = { use: jest.fn(), locals: {} } as unknown as Application;
    const instance = new OidcMiddleware();
    instance.enableFor(app);

    const afterCallback = (authOptions() as AuthOptions).afterCallback;

    jwtDecode.mockReturnValue({ uid: 'u1', email: 'user@hmcts.net', roles: ['role-other'] });
    roleAssignmentGetAssignmentsForActor.mockRejectedValue(new Error('Role assignment response was not valid'));

    const res = { statusCode: 200 } as Response;
    const session = { id_token: 'token', access_token: 'access-token' };

    await expectForbiddenHttpError(() => afterCallback({} as Request, res, session));
    expect(loggerWarn).toHaveBeenCalledWith('Role assignment authorization failed', {
      name: 'Error',
      message: 'Role assignment response was not valid',
    });
  });

  it('afterCallback safely logs non-error RAS lookup failures', async () => {
    expect.hasAssertions();

    const { OidcMiddleware, jwtDecode, authOptions, roleAssignmentGetAssignmentsForActor, loggerWarn } = buildOidc();
    const app = { use: jest.fn(), locals: {} } as unknown as Application;
    const instance = new OidcMiddleware();
    instance.enableFor(app);

    const afterCallback = (authOptions() as AuthOptions).afterCallback;

    jwtDecode.mockReturnValue({ uid: 'u1', email: 'user@hmcts.net', roles: ['role-other'] });
    roleAssignmentGetAssignmentsForActor.mockRejectedValue(null);

    const res = { statusCode: 200 } as Response;
    const session = { id_token: 'token', access_token: 'access-token' };

    await expectForbiddenHttpError(() => afterCallback({} as Request, res, session));
    expect(loggerWarn).toHaveBeenCalledWith('Role assignment authorization failed', { message: 'null' });
  });

  it('afterCallback returns enriched session for users with the IDAM access role without calling RAS', async () => {
    const { OidcMiddleware, jwtDecode, authOptions, roleAssignmentGetAssignmentsForActor } = buildOidc();
    const app = { use: jest.fn(), locals: {} } as unknown as Application;
    const instance = new OidcMiddleware();
    instance.enableFor(app);

    const afterCallback = (authOptions() as AuthOptions).afterCallback;

    jwtDecode.mockReturnValue({ uid: 'u1', email: 'user@hmcts.net', roles: ['role-access'] });

    const res = { statusCode: 200 } as Response;
    const session = { id_token: 'token' };

    const result = (await afterCallback({} as Request, res, session)) as {
      user: { id: string; email: string; roles: string[] };
      [WA_REPORTING_AUTHORIZATION_SESSION_KEY]: { source: string; checkedAt: string };
    };

    expect(result.user).toEqual({ id: 'u1', email: 'user@hmcts.net', roles: ['role-access'] });
    expect(result[WA_REPORTING_AUTHORIZATION_SESSION_KEY]).toEqual({
      source: 'idam',
      checkedAt: fixedNow.toISOString(),
    });
    expect(roleAssignmentGetAssignmentsForActor).not.toHaveBeenCalled();
  });

  it('afterCallback returns enriched session for users with an active configured role assignment', async () => {
    const { OidcMiddleware, jwtDecode, authOptions, roleAssignmentGetAssignmentsForActor } = buildOidc({
      'RBAC.roleAssignmentRoleNames': 'task-supervisor,other-access-role',
    });
    const app = { use: jest.fn(), locals: {} } as unknown as Application;
    const instance = new OidcMiddleware();
    instance.enableFor(app);

    const afterCallback = (authOptions() as AuthOptions).afterCallback;

    jwtDecode.mockReturnValue({ uid: 'u1', email: 'user@hmcts.net', roles: ['role-other'] });
    roleAssignmentGetAssignmentsForActor.mockResolvedValue([
      { roleName: 'other-access-role', beginTime: '2026-06-28T11:59:59Z', endTime: null },
    ]);

    const res = { statusCode: 200 } as Response;
    const session = { id_token: 'token', access_token: 'access-token' };

    const result = (await afterCallback({} as Request, res, session)) as {
      user: { id: string; email: string; roles: string[] };
      [WA_REPORTING_AUTHORIZATION_SESSION_KEY]: { source: string; roleName: string };
    };

    expect(result.user).toEqual({ id: 'u1', email: 'user@hmcts.net', roles: ['role-other'] });
    expect(result[WA_REPORTING_AUTHORIZATION_SESSION_KEY]).toEqual({
      source: 'role-assignment',
      roleName: 'other-access-role',
      checkedAt: fixedNow.toISOString(),
    });
    expect(roleAssignmentGetAssignmentsForActor).toHaveBeenCalledWith('u1', 'access-token');
  });

  it('afterCallback can use RAS authorization when the ID token has no roles claim', async () => {
    const { OidcMiddleware, jwtDecode, authOptions, roleAssignmentGetAssignmentsForActor } = buildOidc();
    const app = { use: jest.fn(), locals: {} } as unknown as Application;
    const instance = new OidcMiddleware();
    instance.enableFor(app);

    const afterCallback = (authOptions() as AuthOptions).afterCallback;

    jwtDecode.mockReturnValue({ uid: 'u1', email: 'user@hmcts.net' });
    roleAssignmentGetAssignmentsForActor.mockResolvedValue([
      { roleName: 'task-supervisor', beginTime: '2026-06-28T11:59:59Z', endTime: null },
    ]);

    const res = { statusCode: 200 } as Response;
    const session = { id_token: 'token', access_token: 'access-token' };

    const result = (await afterCallback({} as Request, res, session)) as {
      user: { id: string; email: string; roles: string[] };
      [WA_REPORTING_AUTHORIZATION_SESSION_KEY]: { source: string; roleName: string };
    };

    expect(result.user).toEqual({ id: 'u1', email: 'user@hmcts.net', roles: [] });
    expect(result[WA_REPORTING_AUTHORIZATION_SESSION_KEY]).toEqual({
      source: 'role-assignment',
      roleName: 'task-supervisor',
      checkedAt: fixedNow.toISOString(),
    });
  });

  it('rejects unauthenticated or unauthorized requests in the guard', async () => {
    expect.hasAssertions();

    const { OidcMiddleware } = buildOidc();
    const app = { use: jest.fn(), locals: {} } as unknown as Application;
    const instance = new OidcMiddleware();
    instance.enableFor(app);

    const guard = (app.use as jest.Mock).mock.calls[1][0] as (req: Request, res: Response, next: () => void) => void;

    const unauthenticatedReq = { oidc: { isAuthenticated: () => false, user: { roles: ['role-access'] } } } as Request;
    await expectForbiddenHttpError(() => guard(unauthenticatedReq, {} as Response, jest.fn()));

    await expectForbiddenHttpError(() => guard({} as Request, {} as Response, jest.fn()));

    const missingUserReq = { oidc: { isAuthenticated: () => true } } as Request;
    await expectForbiddenHttpError(() => guard(missingUserReq, {} as Response, jest.fn()));

    const unauthorizedReq = { oidc: { isAuthenticated: () => true, user: { roles: ['role-other'] } } } as Request;
    await expectForbiddenHttpError(() => guard(unauthorizedReq, {} as Response, jest.fn()));
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

  it('allows authenticated requests with a role assignment session marker in the guard', () => {
    const { OidcMiddleware } = buildOidc();
    const app = { use: jest.fn(), locals: {} } as unknown as Application;
    const instance = new OidcMiddleware();
    instance.enableFor(app);

    const guard = (app.use as jest.Mock).mock.calls[1][0] as (req: Request, res: Response, next: () => void) => void;
    const next = jest.fn();

    const req = {
      oidc: { isAuthenticated: () => true, user: { roles: ['role-other'] } },
      'session-cookie': {
        [WA_REPORTING_AUTHORIZATION_SESSION_KEY]: {
          source: 'role-assignment',
          roleName: 'task-supervisor',
          checkedAt: '2026-06-28T12:00:00.000Z',
        },
      },
    } as unknown as Request;
    guard(req, {} as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('rejects authenticated requests with malformed role assignment session markers in the guard', async () => {
    expect.hasAssertions();

    const { OidcMiddleware } = buildOidc();
    const app = { use: jest.fn(), locals: {} } as unknown as Application;
    const instance = new OidcMiddleware();
    instance.enableFor(app);

    const guard = (app.use as jest.Mock).mock.calls[1][0] as (req: Request, res: Response, next: () => void) => void;

    const malformedMarkers = [
      { source: 'role-assignment', checkedAt: fixedNow.toISOString() },
      { source: 'role-assignment', roleName: '', checkedAt: fixedNow.toISOString() },
      { source: 'role-assignment', roleName: 'task-supervisor', checkedAt: 'not-a-date' },
      { source: 'idam', roleName: 'task-supervisor', checkedAt: fixedNow.toISOString() },
      'role-assignment',
    ];

    for (const marker of malformedMarkers) {
      const req = {
        oidc: { isAuthenticated: () => true, user: { roles: ['role-other'] } },
        'session-cookie': {
          [WA_REPORTING_AUTHORIZATION_SESSION_KEY]: marker,
        },
      } as unknown as Request;
      await expectForbiddenHttpError(() => guard(req, {} as Response, jest.fn()));
    }
  });
});
