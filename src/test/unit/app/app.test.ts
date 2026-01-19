import path from 'path';

import type { Express, Request, Response } from 'express';
const buildAppModule = (options: {
  env?: string;
  rebrandEnabled: boolean;
  routePaths?: string[];
  routeMocks?: Record<string, jest.Mock>;
}) => {
  const { env, rebrandEnabled, routePaths = [], routeMocks = {} } = options;

  if (env === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = env;
  }

  const setupDev = jest.fn();
  const enableFor = jest.fn();
  const enable = jest.fn();

  jest.doMock('config', () => ({
    get: jest.fn((key: string) => {
      if (key === 'govukFrontend.rebrandEnabled') {
        return rebrandEnabled;
      }
      if (key === 'security') {
        return { enabled: true };
      }
      return undefined;
    }),
  }));

  jest.doMock('glob', () => ({
    glob: {
      sync: jest.fn().mockReturnValue(routePaths),
    },
  }));

  routePaths.forEach(routePath => {
    const routeDefault = routeMocks[routePath] ?? jest.fn();
    jest.doMock(routePath, () => ({ default: routeDefault }), { virtual: true });
  });

  const logger = { error: jest.fn(), info: jest.fn() };

  jest.doMock('@hmcts/nodejs-logging', () => ({
    Logger: {
      getLogger: jest.fn(() => logger),
    },
  }));

  jest.doMock('../../../main/modules/appinsights', () => ({
    AppInsights: jest.fn().mockImplementation(() => ({ enable })),
  }));

  jest.doMock('../../../main/modules/helmet', () => ({
    Helmet: jest.fn().mockImplementation(() => ({ enableFor })),
  }));

  jest.doMock('../../../main/modules/nunjucks', () => ({
    Nunjucks: jest.fn().mockImplementation(() => ({ enableFor })),
  }));

  jest.doMock('../../../main/modules/properties-volume', () => ({
    PropertiesVolume: jest.fn().mockImplementation(() => ({ enableFor })),
  }));

  jest.doMock('../../../main/development', () => ({
    setupDev,
  }));

  let app: Express | undefined;

  jest.isolateModules(() => {
    app = require('../../../main/app').app;
  });

  if (!app) {
    throw new Error('App not initialised');
  }

  return {
    app,
    setupDev,
    enable,
    enableFor,
    logger,
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

  it('initialises middleware, locals, and dev setup in development mode', () => {
    const { app, setupDev, enable, enableFor } = buildAppModule({ env: 'development', rebrandEnabled: true });

    expect(app.locals.ENV).toBe('development');
    expect(enableFor).toHaveBeenCalled();
    expect(enable).toHaveBeenCalled();
    expect(setupDev).toHaveBeenCalledWith(app, true);
  });

  it('uses production mode setup when NODE_ENV is not development', () => {
    const { app, setupDev } = buildAppModule({ env: 'production', rebrandEnabled: false });

    expect(app.locals.ENV).toBe('production');
    expect(setupDev).toHaveBeenCalledWith(app, false);
  });

  it('falls back to the default favicon when the rebrand favicon is missing', () => {
    const { app } = buildAppModule({ env: 'development', rebrandEnabled: true });

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

  it('defaults NODE_ENV to development when unset', () => {
    const { app, setupDev } = buildAppModule({ rebrandEnabled: false });

    expect(app.locals.ENV).toBe('development');
    expect(setupDev).toHaveBeenCalledWith(app, true);
  });

  it('does not fall back to the favicon when already using the default path', () => {
    const { app } = buildAppModule({ env: 'development', rebrandEnabled: false });
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

  it('registers routes from glob and enables cache-control headers', () => {
    const fakeRoutePath = path.join(process.cwd(), 'src/main/routes/__fake__.ts');
    const routeHandler = jest.fn();
    const { app } = buildAppModule({
      env: 'development',
      rebrandEnabled: false,
      routePaths: [fakeRoutePath],
      routeMocks: { [fakeRoutePath]: routeHandler },
    });

    expect(routeHandler).toHaveBeenCalledWith(app);

    const handler = getCacheControlHandler(app);
    const setHeader = jest.fn();
    const next = jest.fn();
    handler({} as Request, { setHeader } as unknown as Response, next);

    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache, max-age=0, must-revalidate, no-store');
    expect(next).toHaveBeenCalled();
  });

  it('renders not found for unmatched routes', () => {
    const { app } = buildAppModule({ env: 'development', rebrandEnabled: false });
    const handler = getNotFoundHandler(app);

    const status = jest.fn().mockReturnThis();
    const render = jest.fn();
    const req = {} as Request;
    const res = { status, render } as unknown as Response;

    handler(req, res);

    expect(status).toHaveBeenCalledWith(404);
    expect(render).toHaveBeenCalledWith('not-found');
  });

  it('renders error details in development mode', () => {
    const { app } = buildAppModule({ env: 'development', rebrandEnabled: false });
    const handler = getErrorHandler(app);

    const err = { message: 'boom', status: 500, stack: 'trace' };
    const status = jest.fn().mockReturnThis();
    const render = jest.fn();
    const res = { locals: {}, status, render } as unknown as Response;

    handler(err, {} as Request, res, jest.fn());

    expect(res.locals.message).toBe('boom');
    expect(res.locals.error).toBe(err);
    expect(status).toHaveBeenCalledWith(500);
    expect(render).toHaveBeenCalledWith('error');
  });

  it('suppresses error details outside development mode', () => {
    const { app } = buildAppModule({ env: 'production', rebrandEnabled: false });
    const handler = getErrorHandler(app);

    const err = { message: 'boom', status: 400, stack: 'trace' };
    const status = jest.fn().mockReturnThis();
    const render = jest.fn();
    const res = { locals: {}, status, render } as unknown as Response;

    handler(err, {} as Request, res, jest.fn());

    expect(res.locals.message).toBe('boom');
    expect(res.locals.error).toEqual({});
    expect(status).toHaveBeenCalledWith(400);
    expect(render).toHaveBeenCalledWith('error');
  });

  it('defaults error status to 500 when missing', () => {
    const { app } = buildAppModule({ env: 'production', rebrandEnabled: false });
    const handler = getErrorHandler(app);

    const err = { message: 'boom', stack: 'trace' };
    const status = jest.fn().mockReturnThis();
    const render = jest.fn();
    const res = { locals: {}, status, render } as unknown as Response;

    handler(err, {} as Request, res, jest.fn());

    expect(status).toHaveBeenCalledWith(500);
  });

  it('logs the raw error when no stack is provided', () => {
    const { app, logger } = buildAppModule({ env: 'production', rebrandEnabled: false });
    const handler = getErrorHandler(app);

    const err = { message: 'boom', status: 500 };
    const status = jest.fn().mockReturnThis();
    const render = jest.fn();
    const res = { locals: {}, status, render } as unknown as Response;

    handler(err, {} as Request, res, jest.fn());

    expect(logger.error).toHaveBeenCalledWith('[object Object]');
  });
});
