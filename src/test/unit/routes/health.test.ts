import type { Application } from 'express';

describe('routes/health', () => {
  type RouteHandler = (_req: unknown, res: MockResponse) => Promise<void> | void;
  type MockResponse = {
    status: jest.Mock;
    json: jest.Mock;
  };

  const originalFetch = global.fetch;

  const defaultConfigValues: Record<string, unknown> = {
    'auth.enabled': true,
    'services.idam.health.enabled': true,
    'services.idam.health.path': '/o/.well-known/openid-configuration',
    'services.idam.health.deadline': 10000,
    'services.idam.url.public': 'https://idam.example',
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function registerHealth(configOverrides: Record<string, unknown> = {}, locals: Record<string, unknown> = {}) {
    const appState = { locals: { shutdown: false } };
    const configValues = { ...defaultConfigValues, ...configOverrides };

    jest.doMock('../../../main/app', () => ({ app: appState }));
    jest.doMock('config', () => ({
      get: jest.fn((path: string) => configValues[path]),
    }));

    const app = {
      locals,
      get: jest.fn(),
    } as unknown as Application & { get: jest.Mock };

    jest.isolateModules(() => {
      const registerHealthRoute = require('../../../main/routes/health').default;
      registerHealthRoute(app);
    });

    const handlers = Object.fromEntries(app.get.mock.calls.map(([path, handler]) => [path, handler])) as Record<
      string,
      RouteHandler
    >;

    return {
      app,
      appState,
      handlers,
      fetchMock: global.fetch as jest.Mock,
    };
  }

  function createResponse(): MockResponse {
    const res = {
      status: jest.fn(),
      json: jest.fn(),
    };
    res.status.mockReturnValue(res);
    return res;
  }

  it('registers aggregate, liveness and readiness endpoints', () => {
    const { app } = registerHealth();

    expect(app.get).toHaveBeenCalledWith('/health', expect.any(Function));
    expect(app.get).toHaveBeenCalledWith('/health/liveness', expect.any(Function));
    expect(app.get).toHaveBeenCalledWith('/health/readiness', expect.any(Function));
  });

  it('returns aggregate health in actuator-style component format', async () => {
    const { handlers, fetchMock } = registerHealth();
    const res = createResponse();

    await handlers['/health']({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'UP',
        groups: ['liveness', 'readiness'],
        components: expect.objectContaining({
          diskSpace: expect.objectContaining({
            status: 'UP',
            details: expect.objectContaining({
              total: expect.any(Number),
              free: expect.any(Number),
              threshold: 10485760,
              path: expect.any(String),
              exists: true,
            }),
          }),
          idam: { status: 'UP' },
          livenessState: { status: 'UP' },
          ping: { status: 'UP' },
          readinessState: { status: 'UP' },
        }),
      })
    );
    expect(res.json.mock.calls[0][0]).not.toHaveProperty('buildInfo');
    expect(res.json.mock.calls[0][0].components).not.toHaveProperty('db');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://idam.example/o/.well-known/openid-configuration',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('reports aggregate health down when IDAM is down', async () => {
    const { handlers } = registerHealth();
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });
    const res = createResponse();

    await handlers['/health']({}, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'DOWN',
        components: expect.objectContaining({
          idam: { status: 'DOWN' },
        }),
      })
    );
  });

  it('omits IDAM when authentication is disabled', async () => {
    const { handlers, fetchMock } = registerHealth({ 'auth.enabled': false });
    const res = createResponse();

    await handlers['/health']({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].components).not.toHaveProperty('idam');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('includes Redis in aggregate and readiness health when a Redis client exists', async () => {
    const redisClient = { ping: jest.fn().mockResolvedValue('PONG') };
    const { handlers } = registerHealth({}, { redisClient });
    const aggregateRes = createResponse();
    const readinessRes = createResponse();

    await handlers['/health']({}, aggregateRes);
    await handlers['/health/readiness']({}, readinessRes);

    expect(aggregateRes.json.mock.calls[0][0].components.redis).toEqual({ status: 'UP' });
    expect(readinessRes.json).toHaveBeenCalledWith({
      status: 'UP',
      components: {
        readinessState: { status: 'UP' },
        redis: { status: 'UP' },
      },
    });
    expect(redisClient.ping).toHaveBeenCalledTimes(2);
  });

  it('reports readiness out of service when shutdown has started', async () => {
    const { appState, handlers } = registerHealth();
    const res = createResponse();

    appState.locals.shutdown = true;
    await handlers['/health/readiness']({}, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      status: 'OUT_OF_SERVICE',
      components: {
        readinessState: { status: 'OUT_OF_SERVICE' },
      },
    });
  });
});
