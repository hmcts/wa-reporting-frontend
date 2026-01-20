describe('server bootstrap', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('starts the server and handles graceful shutdown', () => {
    const close = jest.fn((cb: () => void) => cb());
    const listen = jest.fn((port: number, cb: () => void) => {
      cb();
      return { close };
    });

    const app: { locals: { shutdown?: boolean }; listen: typeof listen; emit: jest.Mock } = {
      locals: {},
      listen,
      emit: jest.fn(),
    };

    const logger = { info: jest.fn(), error: jest.fn() };

    jest.doMock('../../../main/app', () => ({ app }));
    jest.doMock('@hmcts/nodejs-logging', () => ({
      Logger: { getLogger: jest.fn(() => logger) },
    }));

    const handlers: Record<string, (signal: string) => void> = {};
    const onSpy = jest.spyOn(process, 'on').mockImplementation((event, handler) => {
      if (typeof event === 'string') {
        handlers[event] = handler as (signal: string) => void;
      }
      return process;
    });

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const timeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((cb: () => void) => {
      cb();
      return 1 as unknown as NodeJS.Timeout;
    });

    process.env.PORT = '4100';

    jest.isolateModules(() => {
      require('../../../main/server');
    });

    expect(listen).toHaveBeenCalledWith(4100, expect.any(Function));
    expect(app.locals.shutdown).toBe(false);

    handlers.SIGTERM('SIGTERM');

    expect(app.locals.shutdown).toBe(true);
    expect(app.emit).toHaveBeenCalledWith('shutdown');
    expect(close).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(exitSpy).toHaveBeenCalledWith(1);

    onSpy.mockRestore();
    exitSpy.mockRestore();
    timeoutSpy.mockRestore();
  });

  it('uses the default port when PORT is not set', () => {
    const listen = jest.fn((port: number, cb: () => void) => {
      cb();
      return { close: jest.fn() };
    });

    const app: { locals: { shutdown?: boolean }; listen: typeof listen; emit: jest.Mock } = {
      locals: {},
      listen,
      emit: jest.fn(),
    };

    const logger = { info: jest.fn(), error: jest.fn() };

    jest.doMock('../../../main/app', () => ({ app }));
    jest.doMock('@hmcts/nodejs-logging', () => ({
      Logger: { getLogger: jest.fn(() => logger) },
    }));

    const onSpy = jest.spyOn(process, 'on').mockImplementation(() => process);

    delete process.env.PORT;

    jest.isolateModules(() => {
      require('../../../main/server');
    });

    expect(listen).toHaveBeenCalledWith(3100, expect.any(Function));

    onSpy.mockRestore();
  });
});
