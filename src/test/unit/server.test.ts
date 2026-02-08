describe('server bootstrap ordering', () => {
  it('initialises AppInsights before loading the app module', () => {
    let enableCalled = false;
    const listen = jest.fn((_port, callback) => {
      if (callback) {
        callback();
      }
      return { close: jest.fn() };
    });
    const emit = jest.fn();

    jest.resetModules();

    jest.doMock('../../main/modules/appinsights', () => ({
      AppInsights: class {
        enable() {
          enableCalled = true;
        }
      },
    }));

    jest.doMock('@hmcts/nodejs-logging', () => ({
      Logger: {
        getLogger: () => ({
          info: jest.fn(),
          error: jest.fn(),
        }),
      },
    }));

    jest.doMock('../../main/app', () => {
      if (!enableCalled) {
        throw new Error('AppInsights was not enabled before app import');
      }
      return { app: { locals: {}, listen, emit } };
    });

    jest.isolateModules(() => {
      require('../../main/server');
    });

    expect(enableCalled).toBe(true);
    expect(listen).toHaveBeenCalled();
  });
});
