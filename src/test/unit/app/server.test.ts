describe('server bootstrap', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('starts the server and handles graceful shutdown', async () => {
    const moduleLoadOrder: string[] = [];
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

    const telemetryHandle = { enabled: true, shutdown: jest.fn().mockResolvedValue(undefined) };
    const initializeOpenTelemetry = jest.fn(() => {
      moduleLoadOrder.push('telemetry');
      return telemetryHandle;
    });

    jest.doMock('../../../main/app', () => {
      moduleLoadOrder.push('app');
      return { app };
    });
    jest.doMock('../../../main/modules/logging', () => ({
      Logger: { getLogger: jest.fn(() => logger) },
    }));
    jest.doMock('../../../main/modules/opentelemetry', () => ({
      initializeOpenTelemetry,
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

    expect(moduleLoadOrder).toEqual(['app', 'telemetry']);
    expect(initializeOpenTelemetry).toHaveBeenCalledTimes(1);
    expect(listen).toHaveBeenCalledWith(4100, expect.any(Function));
    expect(app.locals.shutdown).toBe(false);

    handlers.SIGTERM('SIGTERM');
    await new Promise(setImmediate);

    expect(app.locals.shutdown).toBe(true);
    expect(app.emit).toHaveBeenCalledWith('shutdown');
    expect(close).toHaveBeenCalled();
    expect(telemetryHandle.shutdown).toHaveBeenCalled();
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

    const telemetryHandle = { enabled: false, shutdown: jest.fn().mockResolvedValue(undefined) };
    const initializeOpenTelemetry = jest.fn(() => telemetryHandle);

    jest.doMock('../../../main/app', () => ({ app }));
    jest.doMock('../../../main/modules/logging', () => ({
      Logger: { getLogger: jest.fn(() => logger) },
    }));
    jest.doMock('../../../main/modules/opentelemetry', () => ({
      initializeOpenTelemetry,
    }));

    const onSpy = jest.spyOn(process, 'on').mockImplementation(() => process);

    delete process.env.PORT;

    jest.isolateModules(() => {
      require('../../../main/server');
    });

    expect(initializeOpenTelemetry).toHaveBeenCalledTimes(1);
    expect(listen).toHaveBeenCalledWith(3100, expect.any(Function));

    onSpy.mockRestore();
  });

  it('logs telemetry shutdown failures during graceful shutdown', async () => {
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
    const telemetryError = new Error('shutdown failed');
    const telemetryHandle = { enabled: true, shutdown: jest.fn().mockRejectedValue(telemetryError) };
    const initializeOpenTelemetry = jest.fn(() => telemetryHandle);

    jest.doMock('../../../main/app', () => ({ app }));
    jest.doMock('../../../main/modules/logging', () => ({
      Logger: { getLogger: jest.fn(() => logger) },
    }));
    jest.doMock('../../../main/modules/opentelemetry', () => ({
      initializeOpenTelemetry,
    }));

    const handlers: Record<string, (signal: string) => void> = {};
    const onSpy = jest.spyOn(process, 'on').mockImplementation((event, handler) => {
      if (typeof event === 'string') {
        handlers[event] = handler as (signal: string) => void;
      }
      return process;
    });

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const timeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(() => 1 as unknown as NodeJS.Timeout);

    jest.isolateModules(() => {
      require('../../../main/server');
    });

    handlers.SIGTERM('SIGTERM');
    await new Promise(setImmediate);

    expect(telemetryHandle.shutdown).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('❌ Failed to flush telemetry during shutdown', telemetryError);
    expect(exitSpy).toHaveBeenCalledWith(0);

    onSpy.mockRestore();
    exitSpy.mockRestore();
    timeoutSpy.mockRestore();
  });
});
