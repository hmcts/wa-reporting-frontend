import type { Application } from 'express';

describe('routes/health', () => {
  type WebCheckOptions = {
    callback: (err: Error | null, res?: { status?: number }) => string;
    timeout: number;
    deadline: number;
  };

  const buildInfoEnvKeys = ['PACKAGES_ENVIRONMENT', 'PACKAGES_PROJECT', 'PACKAGES_NAME', 'PACKAGES_VERSION'];
  const originalBuildInfoEnv = Object.fromEntries(buildInfoEnvKeys.map(key => [key, process.env[key]]));
  const originalEnv = process.env;
  const pgClientMock = {
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
  };
  const PgClientMock = jest.fn(() => pgClientMock);

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
    process.env = {
      ...originalEnv,
      REFORM_ENVIRONMENT: 'aat',
      TM_DB_HOST: 'cft-task-postgres-db-flexible-replica-aat.postgres.database.azure.com',
      TM_DB_NAME: 'cft_task_db',
      TM_DB_OPTIONS: 'sslmode=verify-full',
      TM_DB_PASSWORD: 'deployed-password',
      TM_DB_PORT: '5432',
      TM_DB_SCHEMA: 'analytics',
      TM_DB_USER: 'deployed-user',
    };
    delete process.env.TM_DB_URL;
    pgClientMock.connect.mockResolvedValue(undefined);
    pgClientMock.query.mockResolvedValue({ rowCount: 1 });
    pgClientMock.end.mockResolvedValue(undefined);
  });

  afterEach(() => {
    buildInfoEnvKeys.forEach(key => {
      const value = originalBuildInfoEnv[key];
      if (value === undefined) {
        delete process.env[key];
        return;
      }
      process.env[key] = value;
    });
    process.env = originalEnv;
  });

  function registerHealth(configOverrides: Record<string, unknown> = {}, locals: Record<string, unknown> = {}) {
    const appState = { locals: { shutdown: false, ...locals } };
    const addTo = jest.fn();
    const raw = jest.fn((fn: () => unknown) => fn);
    const web = jest.fn((_url: string, _options: WebCheckOptions) => 'web-check');
    const up = jest.fn(() => 'up');
    const down = jest.fn(() => 'down');
    const configValues = { ...defaultConfigValues, ...configOverrides };

    jest.doMock('../../../main/app', () => ({ app: appState }));
    jest.doMock('config', () => ({
      get: jest.fn((path: string) => configValues[path]),
      has: jest.fn((path: string) => Object.prototype.hasOwnProperty.call(configValues, path)),
    }));
    jest.doMock('@hmcts/nodejs-healthcheck', () => ({ addTo, raw, web, up, down }));
    jest.doMock('pg', () => ({
      Client: PgClientMock,
    }));

    const app = { locals } as Application;

    jest.isolateModules(() => {
      const registerHealthRoute = require('../../../main/routes/health').default;
      registerHealthRoute(app);
    });

    return {
      app,
      appState,
      addTo,
      raw,
      web,
      up,
      down,
      healthCheckConfig: addTo.mock.calls[0][1],
    };
  }

  it('registers health checks through the HMCTS nodejs healthcheck package', () => {
    const { app, addTo, healthCheckConfig } = registerHealth();

    expect(addTo).toHaveBeenCalledWith(app, expect.any(Object));
    expect(healthCheckConfig.checks).toEqual(
      expect.objectContaining({
        db: expect.any(Function),
        idam: 'web-check',
      })
    );
    expect(healthCheckConfig.readinessChecks).toEqual(
      expect.objectContaining({
        shutdownCheck: expect.any(Function),
      })
    );
    expect(healthCheckConfig.readinessChecks.db).toBeUndefined();
  });

  it('sets build info defaults used by the HMCTS healthcheck library', () => {
    buildInfoEnvKeys.forEach(key => delete process.env[key]);

    registerHealth();

    expect(process.env.PACKAGES_ENVIRONMENT).toBe('aat');
    expect(process.env.PACKAGES_PROJECT).toBe('wa');
    expect(process.env.PACKAGES_NAME).toBe('wa-reporting-frontend');
    expect(process.env.PACKAGES_VERSION).toBe('0.0.1');
  });

  it('adds IDAM to aggregate health checks but not readiness checks', () => {
    const { healthCheckConfig, web, up, down } = registerHealth();

    expect(healthCheckConfig.checks.idam).toBe('web-check');
    expect(healthCheckConfig.readinessChecks.idam).toBeUndefined();
    expect(web).toHaveBeenCalledWith(
      'https://idam.example/o/.well-known/openid-configuration',
      expect.objectContaining({
        timeout: 10000,
        deadline: 10000,
        callback: expect.any(Function),
      })
    );

    const [, options] = web.mock.calls[0];
    const callback = options.callback;
    expect(callback(null, { status: 200 })).toBe('up');
    expect(callback(new Error('idam down'))).toBe('down');
    expect(up).toHaveBeenCalled();
    expect(down).toHaveBeenCalled();
  });

  it('uses configured IDAM timeout when provided', () => {
    const { web } = registerHealth({ 'services.idam.health.timeout': 5000 });

    expect(web).toHaveBeenCalledWith(
      'https://idam.example/o/.well-known/openid-configuration',
      expect.objectContaining({
        timeout: 5000,
        deadline: 10000,
      })
    );
  });

  it('omits IDAM checks when auth is disabled', () => {
    const { healthCheckConfig, web } = registerHealth({ 'auth.enabled': false });

    expect(healthCheckConfig.checks.idam).toBeUndefined();
    expect(web).not.toHaveBeenCalled();
  });

  it('adds Redis to aggregate and readiness checks when a Redis client is available', () => {
    const ping = jest.fn().mockResolvedValue('pong');
    const { healthCheckConfig } = registerHealth({}, { redisClient: { ping } });

    expect(healthCheckConfig.checks.redis).toBeDefined();
    expect(healthCheckConfig.readinessChecks.redis).toBeDefined();
  });

  it('honours shutdown state in readiness checks', () => {
    const { appState, healthCheckConfig } = registerHealth();

    expect(healthCheckConfig.readinessChecks.shutdownCheck()).toBe('up');

    appState.locals.shutdown = true;
    expect(healthCheckConfig.readinessChecks.shutdownCheck()).toBe('down');
  });

  it('adds a deployed TM database check using the deployed replica connection details', async () => {
    const { healthCheckConfig } = registerHealth();

    await expect(healthCheckConfig.checks.db()).resolves.toBe('up');

    expect(PgClientMock).toHaveBeenCalledWith({
      connectionString:
        'postgresql://deployed-user:deployed-password@cft-task-postgres-db-flexible-replica-aat.postgres.database.azure.com:5432/cft_task_db?sslmode=verify-full&options=-csearch_path=analytics',
    });
    expect(pgClientMock.connect).toHaveBeenCalledTimes(1);
    expect(pgClientMock.query).toHaveBeenCalledWith('SELECT 1 FROM pg_namespace WHERE nspname = $1 LIMIT 1', [
      'analytics',
    ]);
    expect(pgClientMock.end).toHaveBeenCalledTimes(1);
  });

  it('reports the deployed TM database check down when the query rejects', async () => {
    const { healthCheckConfig } = registerHealth();
    pgClientMock.query.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(healthCheckConfig.checks.db()).resolves.toBe('down');
  });

  it('reports the deployed TM database check down when deployed configuration is missing', async () => {
    delete process.env.TM_DB_HOST;
    const { healthCheckConfig } = registerHealth();

    await expect(healthCheckConfig.checks.db()).resolves.toBe('down');

    expect(PgClientMock).not.toHaveBeenCalled();
  });

  it('omits the TM database check outside deployed runtime when deployed configuration is absent', () => {
    delete process.env.REFORM_ENVIRONMENT;
    delete process.env.TM_DB_HOST;
    const { healthCheckConfig } = registerHealth();

    expect(healthCheckConfig.checks.db).toBeUndefined();
    expect(PgClientMock).not.toHaveBeenCalled();
  });
});
