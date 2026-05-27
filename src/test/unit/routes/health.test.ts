import type { Application } from 'express';

describe('routes/health', () => {
  type WebCheckOptions = {
    callback: (err: Error | null, res?: { status?: number }) => string;
    timeout: number;
    deadline: number;
  };

  const buildInfoEnvKeys = ['PACKAGES_ENVIRONMENT', 'PACKAGES_PROJECT', 'PACKAGES_NAME', 'PACKAGES_VERSION'];
  const originalBuildInfoEnv = Object.fromEntries(buildInfoEnvKeys.map(key => [key, process.env[key]]));

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
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
  });

  const defaultConfigValues: Record<string, unknown> = {
    'auth.enabled': true,
    'services.idam.health.enabled': true,
    'services.idam.health.path': '/o/.well-known/openid-configuration',
    'services.idam.health.timeout': 5000,
    'services.idam.health.deadline': 10000,
    'services.idam.url.public': 'https://idam.example',
  };

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
    }));
    jest.doMock('@hmcts/nodejs-healthcheck', () => ({ addTo, raw, web, up, down }));

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

  it('registers health checks and honours shutdown flag', () => {
    const { app, appState, addTo, healthCheckConfig } = registerHealth();

    expect(addTo).toHaveBeenCalledWith(app, expect.any(Object));
    expect(healthCheckConfig.readinessChecks.shutdownCheck()).toBe('up');

    appState.locals.shutdown = true;
    expect(healthCheckConfig.readinessChecks.shutdownCheck()).toBe('down');
  });

  it('sets build info defaults used by the HMCTS healthcheck library', () => {
    buildInfoEnvKeys.forEach(key => delete process.env[key]);

    registerHealth();

    expect(process.env.PACKAGES_ENVIRONMENT).toBe(process.env.NODE_ENV ?? 'development');
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
        timeout: 5000,
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

  it('omits IDAM checks when auth is disabled', () => {
    const { healthCheckConfig, web } = registerHealth({ 'auth.enabled': false });

    expect(healthCheckConfig.checks.idam).toBeUndefined();
    expect(web).not.toHaveBeenCalled();
  });

  it('adds redis checks when redis client is available', () => {
    const ping = jest.fn().mockResolvedValue('pong');
    const { healthCheckConfig } = registerHealth({}, { redisClient: { ping } });

    expect(healthCheckConfig.checks.redis).toBeDefined();
    expect(healthCheckConfig.readinessChecks.redis).toBeDefined();
  });
});
