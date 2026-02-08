import type { Application } from 'express';

describe('routes/health', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('registers health checks and honours shutdown flag', () => {
    const appState = { locals: { shutdown: false } };
    const addTo = jest.fn();
    const raw = jest.fn((fn: () => unknown) => fn);
    const up = jest.fn(() => 'up');
    const down = jest.fn(() => 'down');

    jest.doMock('../../../main/app', () => ({ app: appState }));
    jest.doMock('@hmcts/nodejs-healthcheck', () => ({ addTo, raw, up, down }));

    const app = { locals: {} } as Application;

    jest.isolateModules(() => {
      const registerHealth = require('../../../main/routes/health').default;
      registerHealth(app);
    });

    expect(addTo).toHaveBeenCalledWith(app, expect.any(Object));

    const config = addTo.mock.calls[0][1];

    expect(config.readinessChecks.shutdownCheck()).toBe('up');

    appState.locals.shutdown = true;
    expect(config.readinessChecks.shutdownCheck()).toBe('down');
  });

  it('adds redis checks when redis client is available', () => {
    const ping = jest.fn().mockResolvedValue('pong');
    const appState = { locals: { shutdown: false, redisClient: { ping } } };
    const addTo = jest.fn();
    const raw = jest.fn((fn: () => unknown) => fn);
    const up = jest.fn(() => 'up');
    const down = jest.fn(() => 'down');

    jest.doMock('../../../main/app', () => ({ app: appState }));
    jest.doMock('@hmcts/nodejs-healthcheck', () => ({ addTo, raw, up, down }));

    const app = { locals: { redisClient: { ping } } } as unknown as Application;

    jest.isolateModules(() => {
      const registerHealth = require('../../../main/routes/health').default;
      registerHealth(app);
    });

    const config = addTo.mock.calls[0][1];

    expect(config.checks.redis).toBeDefined();
    expect(config.readinessChecks.redis).toBeDefined();
  });
});
