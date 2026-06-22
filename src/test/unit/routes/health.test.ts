import type { Application } from 'express';

describe('routes/health', () => {
  const defaultConfigValues: Record<string, unknown> = {
    'services.idam.url.public': 'https://idam.test',
    'secrets.wa.wa-reporting-redis-host': '',
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  function registerHealth(configOverrides: Record<string, unknown> = {}, locals: Record<string, unknown> = {}) {
    const appState = { locals: { shutdown: false } };
    const addTo = jest.fn();
    const raw = jest.fn((fn: () => unknown) => fn);
    const web = jest.fn((_url: string) => 'web-check');
    const up = jest.fn(() => 'up');
    const down = jest.fn(() => 'down');
    const configValues = { ...defaultConfigValues, ...configOverrides };

    jest.doMock('../../../main/app', () => ({ app: appState }));
    jest.doMock('config', () => ({
      get: jest.fn((path: string) => configValues[path]),
      has: jest.fn((path: string) => Object.prototype.hasOwnProperty.call(configValues, path)),
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

  it('registers package-backed aggregate and readiness health checks', () => {
    const { app, addTo, healthCheckConfig } = registerHealth();

    expect(addTo).toHaveBeenCalledWith(app, expect.any(Object));
    expect(healthCheckConfig.checks).toEqual(
      expect.objectContaining({
        ping: expect.any(Function),
        livenessState: expect.any(Function),
        readinessState: expect.any(Function),
        idam: 'web-check',
      })
    );
    expect(healthCheckConfig.checks.db).toBeUndefined();
    expect(healthCheckConfig.readinessChecks).toEqual(
      expect.objectContaining({
        readinessState: healthCheckConfig.checks.readinessState,
      })
    );
    expect(healthCheckConfig.readinessChecks.idam).toBeUndefined();
    expect(healthCheckConfig.readinessChecks.db).toBeUndefined();
  });

  it('returns up for ping and liveness state checks', () => {
    const { healthCheckConfig } = registerHealth();

    expect(healthCheckConfig.checks.ping()).toBe('up');
    expect(healthCheckConfig.checks.livenessState()).toBe('up');
  });

  it('reports readiness state from the application shutdown flag', () => {
    const { appState, healthCheckConfig } = registerHealth();

    expect(healthCheckConfig.checks.readinessState()).toBe('up');
    expect(healthCheckConfig.readinessChecks.readinessState()).toBe('up');

    appState.locals.shutdown = true;
    expect(healthCheckConfig.checks.readinessState()).toBe('down');
    expect(healthCheckConfig.readinessChecks.readinessState()).toBe('down');
  });

  it('adds IDAM to aggregate health checks but not readiness checks', () => {
    const { healthCheckConfig, web } = registerHealth();

    expect(healthCheckConfig.checks.idam).toBe('web-check');
    expect(healthCheckConfig.readinessChecks.idam).toBeUndefined();
    expect(web).toHaveBeenCalledWith('https://idam.test/health');
  });

  it('adds Redis to aggregate and readiness checks when a Redis client is available', async () => {
    const ping = jest.fn().mockResolvedValue('pong');
    const { healthCheckConfig } = registerHealth({}, { redisClient: { ping } });

    await expect(healthCheckConfig.checks.redis()).resolves.toBe('up');
    await expect(healthCheckConfig.readinessChecks.redis()).resolves.toBe('up');
    expect(ping).toHaveBeenCalledTimes(2);
  });

  it('reports Redis down when configured but no client is available yet', () => {
    const { healthCheckConfig } = registerHealth({ 'secrets.wa.wa-reporting-redis-host': 'redis-host' });

    expect(healthCheckConfig.checks.redis()).toBe('down');
    expect(healthCheckConfig.readinessChecks.redis()).toBe('down');
  });

  it('reports Redis down when ping rejects', async () => {
    const ping = jest.fn().mockRejectedValue(new Error('redis unavailable'));
    const { healthCheckConfig } = registerHealth(
      { 'secrets.wa.wa-reporting-redis-host': 'redis-host' },
      { redisClient: { ping } }
    );

    await expect(healthCheckConfig.checks.redis()).resolves.toBe('down');
  });

  it('omits Redis when no Redis client or host is configured', () => {
    const { healthCheckConfig } = registerHealth();

    expect(healthCheckConfig.checks.redis).toBeUndefined();
    expect(healthCheckConfig.readinessChecks.redis).toBeUndefined();
  });
});
