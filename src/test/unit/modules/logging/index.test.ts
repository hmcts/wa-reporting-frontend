describe('logging module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.LOG_LEVEL;
    delete process.env.JSON_PRINT;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('creates a logger with default info level and console transport', () => {
    const createLogger = jest.fn(() => ({ name: 'logger' }));
    const consoleTransport = jest.fn();

    const combine = jest.fn();
    const timestamp = jest.fn();
    const json = jest.fn();
    const printf = jest.fn(formatter => {
      formatter({ level: 'info', message: 'message', label: 'app', timestamp: 'now' });
      formatter({ level: 'info', message: { test: true }, label: 'app', timestamp: 'now', extra: 'value' });
      return 'printf-format';
    });

    jest.doMock('winston', () => ({
      createLogger,
      format: { combine, timestamp, json, printf },
      transports: { Console: consoleTransport },
    }));

    jest.isolateModules(() => {
      const { Logger } = require('../../../../main/modules/logging');
      Logger.getLogger('app');
    });

    expect(createLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'info',
        defaultMeta: { label: 'app' },
        transports: [expect.any(Object)],
      })
    );
    expect(consoleTransport).toHaveBeenCalled();
  });

  it('respects LOG_LEVEL and JSON_PRINT when provided', () => {
    process.env.LOG_LEVEL = 'warn';
    process.env.JSON_PRINT = 'true';

    const createLogger = jest.fn(() => ({ name: 'logger' }));
    const consoleTransport = jest.fn();

    const combine = jest.fn();
    const timestamp = jest.fn();
    const json = jest.fn();
    const printf = jest.fn();

    jest.doMock('winston', () => ({
      createLogger,
      format: { combine, timestamp, json, printf },
      transports: { Console: consoleTransport },
    }));

    jest.isolateModules(() => {
      const { Logger } = require('../../../../main/modules/logging');
      Logger.getLogger('app');
    });

    expect(createLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warn',
      })
    );
    expect(json).toHaveBeenCalled();
  });

  it('returns the cached logger for the same name', () => {
    const createLogger = jest.fn(() => ({ name: 'logger' }));
    const consoleTransport = jest.fn();

    const combine = jest.fn();
    const timestamp = jest.fn();
    const json = jest.fn();
    const printf = jest.fn();

    jest.doMock('winston', () => ({
      createLogger,
      format: { combine, timestamp, json, printf },
      transports: { Console: consoleTransport },
    }));

    jest.isolateModules(() => {
      const { Logger } = require('../../../../main/modules/logging');
      const first = Logger.getLogger('app');
      const second = Logger.getLogger('app');
      expect(first).toBe(second);
    });

    expect(createLogger).toHaveBeenCalledTimes(1);
  });
});
