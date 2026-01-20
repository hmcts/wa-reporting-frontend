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

    const app = {} as Application;

    jest.isolateModules(() => {
      const registerHealth = require('../../../main/routes/health').default;
      registerHealth(app);
    });

    expect(addTo).toHaveBeenCalledWith(app, expect.any(Object));

    const config = addTo.mock.calls[0][1];

    expect(config.checks.sampleCheck()).toBe('up');
    expect(config.readinessChecks.shutdownCheck()).toBe('up');

    appState.locals.shutdown = true;
    expect(config.readinessChecks.shutdownCheck()).toBe('down');
  });
});
