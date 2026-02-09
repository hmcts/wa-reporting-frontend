import path from 'path';

import type { Express, Request, Response } from 'express';
const buildAppModule = async (options: {
  env?: string;
  rebrandEnabled: boolean;
  authEnabled?: boolean;
  routePaths?: string[];
  routeMocks?: Record<string, jest.Mock>;
}) => {
  const { env, rebrandEnabled, authEnabled = true, routePaths = [], routeMocks = {} } = options;

  if (env === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = env;
  }

  const setupDev = jest.fn();
  const enableFor = jest.fn();
  const appSessionEnableFor = jest.fn();
  const oidcEnableFor = jest.fn();
  const healthRoute = jest.fn();
  const infoRoute = jest.fn();

  const configGet = jest.fn((key: string) => {
    if (key === 'govukFrontend.rebrandEnabled') {
      return rebrandEnabled;
    }
    if (key === 'auth.enabled') {
      return authEnabled;
    }
    if (key === 'security') {
      return { enabled: true };
    }
    return undefined;
  });

  jest.doMock('config', () => ({
    get: configGet,
  }));

  jest.doMock('glob', () => ({
    glob: jest.fn().mockResolvedValue(routePaths),
  }));

  routePaths.forEach(routePath => {
    const routeDefault = routeMocks[routePath] ?? jest.fn();
    jest.doMock(routePath, () => ({ default: routeDefault }), { virtual: true });
  });

  const logger = { error: jest.fn(), info: jest.fn() };

  jest.doMock('../../../main/modules/logging', () => ({
    Logger: {
      getLogger: jest.fn(() => logger),
    },
  }));

  jest.doMock('../../../main/modules/helmet', () => ({
    Helmet: jest.fn().mockImplementation(() => ({ enableFor })),
  }));

  jest.doMock('../../../main/modules/nunjucks', () => ({
    Nunjucks: jest.fn().mockImplementation(() => ({ enableFor })),
  }));

  jest.doMock('../../../main/modules/session', () => ({
    AppSession: jest.fn().mockImplementation(() => ({ enableFor: appSessionEnableFor })),
  }));

  jest.doMock('../../../main/modules/oidc', () => ({
    OidcMiddleware: jest.fn().mockImplementation(() => ({ enableFor: oidcEnableFor })),
  }));

  jest.doMock('../../../main/modules/properties-volume', () => ({
    PropertiesVolume: jest.fn().mockImplementation(() => ({ enableFor })),
  }));

  jest.doMock('../../../main/routes/health', () => ({
    __esModule: true,
    default: healthRoute,
  }));

  jest.doMock('../../../main/routes/info', () => ({
    __esModule: true,
    default: infoRoute,
  }));

  jest.doMock('../../../main/development', () => ({
    setupDev,
  }));

  let app: Express | undefined;
  let bootstrap: (() => Promise<void>) | undefined;

  jest.isolateModules(() => {
    const appModule = require('../../../main/app');
    app = appModule.app;
    bootstrap = appModule.bootstrap;
  });

  if (!app || !bootstrap) {
    throw new Error('App not initialised');
  }

  await bootstrap();

  return {
    app,
    setupDev,
    enableFor,
    logger,
    appSessionEnableFor,
    oidcEnableFor,
    healthRoute,
    infoRoute,
    configGet,
  };
};

type RouterLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: { handle: (...args: unknown[]) => unknown }[];
  };
  handle?: (...args: unknown[]) => unknown;
};

type RouterStack = RouterLayer[];

const resolveRouterStack = (app: Express): RouterStack => {
  const expressApp = app as Express & { _router?: { stack: RouterStack }; router?: { stack: RouterStack } };
  if (!expressApp._router && !expressApp.router) {
    app.use((_req, _res, next) => next());
  }
  const router = expressApp._router ?? expressApp.router;
  if (!router) {
    throw new Error('Router not initialised');
  }
  return router.stack;
};

const getRouteHandler = (app: Express, routePath: string, method: 'get' | 'post' = 'get') => {
  const stack = resolveRouterStack(app);
  const layer = stack.find(
    (entry: RouterLayer) => entry.route && entry.route.path === routePath && entry.route.methods[method]
  );
  return layer?.route?.stack[layer.route.stack.length - 1].handle as (req: Request, res: Response) => unknown;
};

const getErrorHandler = (app: Express) => {
  const stack = resolveRouterStack(app);
  return stack.find((entry: RouterLayer) => entry.handle && entry.handle.length === 4)?.handle as (
    err: { message: string; status?: number; stack?: string },
    req: Request,
    res: Response,
    next: () => void
  ) => unknown;
};

const getNotFoundHandler = (app: Express) => {
  const stack = resolveRouterStack(app);
  const errorIndex = stack.findIndex((entry: RouterLayer) => entry.handle && entry.handle.length === 4);
  return stack[errorIndex - 1].handle as (req: Request, res: Response) => unknown;
};

const getCacheControlHandler = (app: Express) => {
  const stack = resolveRouterStack(app);
  return stack.find(layer => layer.handle && layer.handle.toString().includes('Cache-Control'))?.handle as (
    req: Request,
    res: Response,
    next: () => void
  ) => unknown;
};

describe('app bootstrap', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('initialises middleware, locals, and dev setup in development mode', async () => {
    const { app, setupDev, enableFor, appSessionEnableFor, oidcEnableFor, healthRoute, infoRoute } =
      await buildAppModule({ env: 'development', rebrandEnabled: true });

    expect(app.locals.ENV).toBe('development');
    expect(enableFor).toHaveBeenCalled();
    expect(appSessionEnableFor).toHaveBeenCalledWith(app);
    expect(oidcEnableFor).toHaveBeenCalledWith(app);
    expect(healthRoute).toHaveBeenCalledWith(app);
    expect(infoRoute).toHaveBeenCalledWith(app);
    expect(setupDev).toHaveBeenCalledWith(app, true);
  });

  it('uses production mode setup when NODE_ENV is not development', async () => {
    const { app, setupDev, appSessionEnableFor, oidcEnableFor } = await buildAppModule({
      env: 'production',
      rebrandEnabled: false,
    });

    expect(app.locals.ENV).toBe('production');
    expect(appSessionEnableFor).toHaveBeenCalledWith(app);
    expect(oidcEnableFor).toHaveBeenCalledWith(app);
    expect(setupDev).toHaveBeenCalledWith(app, false);
  });

  it('skips OIDC when auth is disabled', async () => {
    const { oidcEnableFor } = await buildAppModule({
      env: 'development',
      rebrandEnabled: false,
      authEnabled: false,
    });

    expect(oidcEnableFor).not.toHaveBeenCalled();
  });

  it('falls back to the default favicon when the rebrand favicon is missing', async () => {
    const { app } = await buildAppModule({ env: 'development', rebrandEnabled: true });

    const handler = getRouteHandler(app, '/favicon.ico');
    const sendFile = jest
      .fn()
      .mockImplementationOnce((_: string, cb: (err?: Error) => void) => cb(new Error('missing')))
      .mockImplementationOnce((_: string, cb?: (err?: Error) => void) => cb?.());

    const req = {} as Request;
    const res = { sendFile } as unknown as Response;

    handler(req, res);

    expect(sendFile).toHaveBeenCalledTimes(2);
    expect(sendFile.mock.calls[0][0]).toContain('rebrand');
    expect(sendFile.mock.calls[1][0]).toContain('images/favicon.ico');
  });

  it('defaults NODE_ENV to development when unset', async () => {
    const { app, setupDev } = await buildAppModule({ rebrandEnabled: false });

    expect(app.locals.ENV).toBe('development');
    expect(setupDev).toHaveBeenCalledWith(app, true);
  });

  it('does not fall back to the favicon when already using the default path', async () => {
    const { app } = await buildAppModule({ env: 'development', rebrandEnabled: false });
    const handler = getRouteHandler(app, '/favicon.ico');
    const sendFile = jest
      .fn()
      .mockImplementationOnce((_: string, cb: (err?: Error) => void) => cb(new Error('missing')));
    const req = {} as Request;
    const res = { sendFile } as unknown as Response;

    handler(req, res);

    expect(sendFile).toHaveBeenCalledTimes(1);
    expect(sendFile.mock.calls[0][0]).toContain('images/favicon.ico');
  });

  it('registers routes from glob and enables cache-control headers', async () => {
    const fakeRoutePath = path.join(process.cwd(), 'src/main/routes/__fake__.ts');
    const routeHandler = jest.fn();
    const { app, healthRoute, infoRoute, oidcEnableFor } = await buildAppModule({
      env: 'development',
      rebrandEnabled: false,
      routePaths: [fakeRoutePath],
      routeMocks: { [fakeRoutePath]: routeHandler },
    });

    expect(routeHandler).toHaveBeenCalledWith(app);
    expect(healthRoute.mock.invocationCallOrder[0]).toBeLessThan(oidcEnableFor.mock.invocationCallOrder[0]);
    expect(infoRoute.mock.invocationCallOrder[0]).toBeLessThan(oidcEnableFor.mock.invocationCallOrder[0]);

    const handler = getCacheControlHandler(app);
    const setHeader = jest.fn();
    const next = jest.fn();
    handler({} as Request, { setHeader } as unknown as Response, next);

    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache, max-age=0, must-revalidate, no-store');
    expect(next).toHaveBeenCalled();
  });

  it('renders not found for unmatched routes', async () => {
    const { app } = await buildAppModule({ env: 'development', rebrandEnabled: false });
    const handler = getNotFoundHandler(app);

    const status = jest.fn().mockReturnThis();
    const render = jest.fn();
    const req = {} as Request;
    const res = { status, render } as unknown as Response;

    handler(req, res);

    expect(status).toHaveBeenCalledWith(404);
    expect(render).toHaveBeenCalledWith('not-found');
  });

  it('renders error details in development mode', async () => {
    const { app } = await buildAppModule({ env: 'development', rebrandEnabled: false });
    const handler = getErrorHandler(app);

    const err = { message: 'boom', status: 500, stack: 'trace' };
    const status = jest.fn().mockReturnThis();
    const render = jest.fn();
    const res = { locals: {}, status, render } as unknown as Response;

    handler(err, {} as Request, res, jest.fn());

    expect(res.locals.message).toBe('boom');
    expect(res.locals.error).toBe(err);
    expect(status).toHaveBeenCalledWith(500);
    expect(render).toHaveBeenCalledWith('error', {
      title: 'Sorry, there is a problem with the service',
      suggestions: ['Please try again later.'],
    });
  });

  it('suppresses error details outside development mode', async () => {
    const { app } = await buildAppModule({ env: 'production', rebrandEnabled: false });
    const handler = getErrorHandler(app);

    const err = { message: 'boom', status: 400, stack: 'trace' };
    const status = jest.fn().mockReturnThis();
    const render = jest.fn();
    const res = { locals: {}, status, render } as unknown as Response;

    handler(err, {} as Request, res, jest.fn());

    expect(res.locals.message).toBe('boom');
    expect(res.locals.error).toEqual({});
    expect(status).toHaveBeenCalledWith(400);
    expect(render).toHaveBeenCalledWith('error', {
      title: 'Sorry, there is a problem with the service',
      suggestions: ['Please try again later.'],
    });
  });

  it('defaults error status to 500 when missing', async () => {
    const { app } = await buildAppModule({ env: 'production', rebrandEnabled: false });
    const handler = getErrorHandler(app);

    const err = { message: 'boom', stack: 'trace' };
    const status = jest.fn().mockReturnThis();
    const render = jest.fn();
    const res = { locals: {}, status, render } as unknown as Response;

    handler(err, {} as Request, res, jest.fn());

    expect(status).toHaveBeenCalledWith(500);
  });

  it('logs the raw error when no stack is provided', async () => {
    const { app, logger } = await buildAppModule({ env: 'production', rebrandEnabled: false });
    const handler = getErrorHandler(app);

    const err = { message: 'boom', status: 500 };
    const status = jest.fn().mockReturnThis();
    const render = jest.fn();
    const res = { locals: {}, status, render } as unknown as Response;

    handler(err, {} as Request, res, jest.fn());

    expect(logger.error).toHaveBeenCalledWith('[object Object]');
  });

  it('renders a forbidden summary without logging an error', async () => {
    const { app, logger } = await buildAppModule({ env: 'production', rebrandEnabled: false });
    const handler = getErrorHandler(app);

    const err = { message: 'nope', status: 403 };
    const status = jest.fn().mockReturnThis();
    const render = jest.fn();
    const res = { locals: {}, status, render } as unknown as Response;

    handler(err, {} as Request, res, jest.fn());

    expect(status).toHaveBeenCalledWith(403);
    expect(render).toHaveBeenCalledWith('error', {
      title: 'Sorry, access to this resource is forbidden',
      suggestions: [
        'Please ensure you have the correct permissions to access this resource.',
        'Contact a system administrator if you should have access to this resource.',
      ],
      signOutUrl: '/logout',
    });
    expect(logger.error).not.toHaveBeenCalled();
  });
});
