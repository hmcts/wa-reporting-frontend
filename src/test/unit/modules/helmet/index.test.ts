import type { Express } from 'express';

describe('Helmet module', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('adds unsafe-eval in development mode', () => {
    const app = { use: jest.fn() } as unknown as Express;
    const helmetMock = jest.fn((options: Record<string, unknown>) => {
      void options;
      return 'helmet-middleware';
    });

    jest.doMock('helmet', () => helmetMock);

    jest.isolateModules(() => {
      const { Helmet } = require('../../../../main/modules/helmet');
      new Helmet(true).enableFor(app);
    });

    expect(helmetMock).toHaveBeenCalled();
    const config = helmetMock.mock.calls[0]?.[0];
    if (!config) {
      throw new Error('Helmet configuration not captured');
    }
    const typedConfig = config as {
      contentSecurityPolicy: { directives: { scriptSrc: string[] } };
    };
    expect(typedConfig.contentSecurityPolicy.directives.scriptSrc).toContain("'unsafe-eval'");
    expect(app.use).toHaveBeenCalledWith('helmet-middleware');
  });

  it('omits unsafe-eval outside development mode', () => {
    const app = { use: jest.fn() } as unknown as Express;
    const helmetMock = jest.fn((options: Record<string, unknown>) => {
      void options;
      return 'helmet-middleware';
    });

    jest.doMock('helmet', () => helmetMock);

    jest.isolateModules(() => {
      const { Helmet } = require('../../../../main/modules/helmet');
      new Helmet(false).enableFor(app);
    });

    expect(helmetMock).toHaveBeenCalled();
    const config = helmetMock.mock.calls[0]?.[0];
    if (!config) {
      throw new Error('Helmet configuration not captured');
    }
    const typedConfig = config as {
      contentSecurityPolicy: { directives: { scriptSrc: string[] } };
    };
    expect(typedConfig.contentSecurityPolicy.directives.scriptSrc).not.toContain("'unsafe-eval'");
    expect(app.use).toHaveBeenCalledWith('helmet-middleware');
  });
});
