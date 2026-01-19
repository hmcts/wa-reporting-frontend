describe('logging module', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('creates a logger with console transport', () => {
    const createLogger = jest.fn(() => ({ name: 'logger' }));
    const consoleTransport = jest.fn();

    jest.doMock('winston', () => ({
      createLogger,
      format: {
        combine: jest.fn(),
        timestamp: jest.fn(),
        json: jest.fn(),
      },
      transports: {
        Console: consoleTransport,
      },
    }));

    jest.isolateModules(() => {
      const logger = require('../../../../main/modules/logging').default;
      expect(logger).toEqual({ name: 'logger' });
    });

    expect(createLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'info',
        transports: [expect.any(Object)],
      })
    );
    expect(consoleTransport).toHaveBeenCalled();
  });
});
