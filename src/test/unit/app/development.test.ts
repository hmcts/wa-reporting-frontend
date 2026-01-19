import type { Express } from 'express';

describe('development setup', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('registers webpack dev middleware in development mode', () => {
    const use = jest.fn();
    const app = { use } as unknown as Express;

    const webpackDev = jest.fn(() => 'middleware');
    const webpack = jest.fn(() => 'compiler');

    jest.doMock('webpack-dev-middleware', () => webpackDev);
    jest.doMock('webpack', () => webpack);
    jest.doMock('../../../../webpack.config', () => ({ mode: 'development' }));

    jest.isolateModules(() => {
      const { setupDev } = require('../../../main/development');
      setupDev(app, true);
    });

    expect(webpack).toHaveBeenCalledWith({ mode: 'development' });
    expect(webpackDev).toHaveBeenCalledWith('compiler', { publicPath: '/' });
    expect(use).toHaveBeenCalledWith('middleware');
  });

  it('does nothing when development mode is disabled', () => {
    const use = jest.fn();
    const app = { use } as unknown as Express;

    jest.isolateModules(() => {
      const { setupDev } = require('../../../main/development');
      setupDev(app, false);
    });

    expect(use).not.toHaveBeenCalled();
  });
});
