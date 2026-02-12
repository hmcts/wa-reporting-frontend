import type { Application } from 'express';

describe('routes/index', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('registers analytics router on base path', () => {
    const createAnalyticsRouter = jest.fn(() => 'router');
    const app = { use: jest.fn() } as unknown as Application;

    jest.doMock('../../../main/modules/analytics', () => ({
      createAnalyticsRouter,
    }));

    jest.isolateModules(() => {
      const registerRoutes = require('../../../main/routes/index').default;
      registerRoutes(app);
    });

    expect(createAnalyticsRouter).toHaveBeenCalledTimes(1);
    expect(app.use).toHaveBeenCalledWith('/', 'router');
  });
});
