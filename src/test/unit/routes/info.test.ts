import type { Router } from 'express';

describe('routes/info', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('registers the info handler with build metadata', () => {
    const handler = jest.fn();
    const infoRequestHandler = jest.fn(() => handler);

    jest.doMock('@hmcts/info-provider', () => ({
      infoRequestHandler,
    }));

    jest.doMock('os', () => ({
      hostname: jest.fn(() => 'host-name'),
    }));

    const app = { get: jest.fn() } as unknown as Router;

    jest.isolateModules(() => {
      const registerInfo = require('../../../main/routes/info').default;
      registerInfo(app);
    });

    expect(infoRequestHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        extraBuildInfo: expect.objectContaining({
          host: 'host-name',
          name: 'wa-reporting-frontend',
          uptime: expect.any(Number),
        }),
        info: {},
      })
    );

    expect(app.get).toHaveBeenCalledWith('/info', handler);
  });
});
