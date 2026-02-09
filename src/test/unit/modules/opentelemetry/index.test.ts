describe('opentelemetry module', () => {
  const originalEnv = process.env;

  const mockExpressInstrumentation = (expressCtor = jest.fn(() => ({ name: 'express' }))) => {
    jest.doMock('@opentelemetry/instrumentation-express', () => ({
      ExpressInstrumentation: expressCtor,
      ExpressLayerType: { MIDDLEWARE: 'middleware', ROUTER: 'router', REQUEST_HANDLER: 'request_handler' },
    }));
    return expressCtor;
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    delete process.env.OTEL_SERVICE_NAME;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns a disabled handle when connection string is missing', async () => {
    const useAzureMonitor = jest.fn();
    const shutdownAzureMonitor = jest.fn().mockResolvedValue(undefined);

    jest.doMock('config', () => ({
      has: jest.fn(() => false),
      get: jest.fn(),
    }));

    jest.doMock('@azure/monitor-opentelemetry', () => ({
      useAzureMonitor,
      shutdownAzureMonitor,
    }));

    const registerInstrumentations = jest.fn();
    jest.doMock('@opentelemetry/instrumentation', () => ({
      registerInstrumentations,
    }));

    mockExpressInstrumentation(jest.fn());

    const loadModule = () => {
      let exports: typeof import('../../../../main/modules/opentelemetry') | undefined;
      jest.isolateModules(() => {
        exports = require('../../../../main/modules/opentelemetry');
      });
      return exports!;
    };

    const { initializeOpenTelemetry } = loadModule();
    const handle = initializeOpenTelemetry();
    expect(handle.enabled).toBe(false);
    await handle.shutdown();

    expect(useAzureMonitor).not.toHaveBeenCalled();
    expect(registerInstrumentations).not.toHaveBeenCalled();
    expect(shutdownAzureMonitor).not.toHaveBeenCalled();
  });

  it('returns a disabled handle when connection string is non-string', async () => {
    const useAzureMonitor = jest.fn();

    jest.doMock('config', () => ({
      has: jest.fn(() => true),
      get: jest.fn(() => false),
    }));

    jest.doMock('@azure/monitor-opentelemetry', () => ({
      useAzureMonitor,
      shutdownAzureMonitor: jest.fn().mockResolvedValue(undefined),
    }));

    jest.doMock('@opentelemetry/instrumentation', () => ({
      registerInstrumentations: jest.fn(),
    }));

    mockExpressInstrumentation(jest.fn());

    const loadModule = () => {
      let exports: typeof import('../../../../main/modules/opentelemetry') | undefined;
      jest.isolateModules(() => {
        exports = require('../../../../main/modules/opentelemetry');
      });
      return exports!;
    };

    const { initializeOpenTelemetry } = loadModule();
    const handle = initializeOpenTelemetry();

    expect(handle.enabled).toBe(false);
    await handle.shutdown();
    expect(useAzureMonitor).not.toHaveBeenCalled();
  });

  it('returns a disabled handle when connection string is empty', async () => {
    const useAzureMonitor = jest.fn();

    jest.doMock('config', () => ({
      has: jest.fn(() => true),
      get: jest.fn(() => '   '),
    }));

    jest.doMock('@azure/monitor-opentelemetry', () => ({
      useAzureMonitor,
      shutdownAzureMonitor: jest.fn().mockResolvedValue(undefined),
    }));

    jest.doMock('@opentelemetry/instrumentation', () => ({
      registerInstrumentations: jest.fn(),
    }));

    mockExpressInstrumentation(jest.fn());

    const loadModule = () => {
      let exports: typeof import('../../../../main/modules/opentelemetry') | undefined;
      jest.isolateModules(() => {
        exports = require('../../../../main/modules/opentelemetry');
      });
      return exports!;
    };

    const { initializeOpenTelemetry } = loadModule();
    const handle = initializeOpenTelemetry();

    expect(handle.enabled).toBe(false);
    await handle.shutdown();
    expect(useAzureMonitor).not.toHaveBeenCalled();
  });

  it('initialises Azure Monitor when a connection string is present', async () => {
    const useAzureMonitor = jest.fn();
    const shutdownAzureMonitor = jest.fn().mockResolvedValue(undefined);

    jest.doMock('config', () => ({
      has: jest.fn(() => true),
      get: jest.fn(() => 'InstrumentationKey=example'),
    }));

    jest.doMock('@azure/monitor-opentelemetry', () => ({
      useAzureMonitor,
      shutdownAzureMonitor,
    }));

    const registerInstrumentations = jest.fn();
    jest.doMock('@opentelemetry/instrumentation', () => ({
      registerInstrumentations,
    }));

    const expressCtor = mockExpressInstrumentation();

    const loadModule = () => {
      let exports: typeof import('../../../../main/modules/opentelemetry') | undefined;
      jest.isolateModules(() => {
        exports = require('../../../../main/modules/opentelemetry');
      });
      return exports!;
    };

    const { initializeOpenTelemetry } = loadModule();
    const handle = initializeOpenTelemetry();
    expect(handle.enabled).toBe(true);
    expect(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING).toBe('InstrumentationKey=example');
    expect(process.env.OTEL_SERVICE_NAME).toBe('wa-reporting-frontend');

    expect(useAzureMonitor).toHaveBeenCalledWith(
      expect.objectContaining({
        azureMonitorExporterOptions: { connectionString: 'InstrumentationKey=example' },
        samplingRatio: 1,
        instrumentationOptions: {
          http: { enabled: true },
          postgreSql: { enabled: true, requireParentSpan: true },
          redis: { enabled: true },
          redis4: { enabled: true },
          winston: { enabled: true },
        },
      })
    );

    expect(registerInstrumentations).toHaveBeenCalledWith(
      expect.objectContaining({
        instrumentations: [expect.any(Object)],
      })
    );
    expect(expressCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        ignoreLayersType: ['middleware', 'router'],
      })
    );

    await handle.shutdown();
    expect(shutdownAzureMonitor).toHaveBeenCalled();
  });

  it('prefers the environment connection string over config', () => {
    const useAzureMonitor = jest.fn();
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = 'InstrumentationKey=from-env';

    jest.doMock('config', () => ({
      has: jest.fn(() => true),
      get: jest.fn(() => 'InstrumentationKey=from-config'),
    }));

    jest.doMock('@azure/monitor-opentelemetry', () => ({
      useAzureMonitor,
      shutdownAzureMonitor: jest.fn().mockResolvedValue(undefined),
    }));

    jest.doMock('@opentelemetry/instrumentation', () => ({
      registerInstrumentations: jest.fn(),
    }));

    mockExpressInstrumentation();

    const loadModule = () => {
      let exports: typeof import('../../../../main/modules/opentelemetry') | undefined;
      jest.isolateModules(() => {
        exports = require('../../../../main/modules/opentelemetry');
      });
      return exports!;
    };

    const { initializeOpenTelemetry } = loadModule();
    initializeOpenTelemetry();

    expect(useAzureMonitor).toHaveBeenCalledWith(
      expect.objectContaining({
        azureMonitorExporterOptions: { connectionString: 'InstrumentationKey=from-env' },
      })
    );
  });

  it('returns the cached handle when initialised more than once', () => {
    const useAzureMonitor = jest.fn();

    jest.doMock('config', () => ({
      has: jest.fn(() => true),
      get: jest.fn(() => 'InstrumentationKey=example'),
    }));

    jest.doMock('@azure/monitor-opentelemetry', () => ({
      useAzureMonitor,
      shutdownAzureMonitor: jest.fn().mockResolvedValue(undefined),
    }));

    jest.doMock('@opentelemetry/instrumentation', () => ({
      registerInstrumentations: jest.fn(),
    }));

    mockExpressInstrumentation();

    const loadModule = () => {
      let exports: typeof import('../../../../main/modules/opentelemetry') | undefined;
      jest.isolateModules(() => {
        exports = require('../../../../main/modules/opentelemetry');
      });
      return exports!;
    };

    const { initializeOpenTelemetry } = loadModule();
    const first = initializeOpenTelemetry();
    const second = initializeOpenTelemetry();

    expect(first).toBe(second);
    expect(useAzureMonitor).toHaveBeenCalledTimes(1);
  });

  it('falls back to HTTP spans when Express instrumentation fails', () => {
    const useAzureMonitor = jest.fn();
    const shutdownAzureMonitor = jest.fn().mockResolvedValue(undefined);
    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

    jest.doMock('config', () => ({
      has: jest.fn(() => true),
      get: jest.fn(() => 'InstrumentationKey=example'),
    }));

    jest.doMock('@azure/monitor-opentelemetry', () => ({
      useAzureMonitor,
      shutdownAzureMonitor,
    }));

    const registerInstrumentations = jest.fn();
    jest.doMock('@opentelemetry/instrumentation', () => ({
      registerInstrumentations,
    }));

    const expressCtor = jest.fn(() => {
      throw new Error('instrumentation error');
    });
    mockExpressInstrumentation(expressCtor);

    const loadModule = () => {
      let exports: typeof import('../../../../main/modules/opentelemetry') | undefined;
      jest.isolateModules(() => {
        exports = require('../../../../main/modules/opentelemetry');
      });
      return exports!;
    };

    const { initializeOpenTelemetry } = loadModule();
    const handle = initializeOpenTelemetry();

    expect(handle.enabled).toBe(true);
    expect(stderrSpy).toHaveBeenCalled();
    stderrSpy.mockRestore();
  });

  it('formats non-error instrumentation failures', () => {
    const useAzureMonitor = jest.fn();
    const shutdownAzureMonitor = jest.fn().mockResolvedValue(undefined);
    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

    jest.doMock('config', () => ({
      has: jest.fn(() => true),
      get: jest.fn(() => 'InstrumentationKey=example'),
    }));

    jest.doMock('@azure/monitor-opentelemetry', () => ({
      useAzureMonitor,
      shutdownAzureMonitor,
    }));

    jest.doMock('@opentelemetry/instrumentation', () => ({
      registerInstrumentations: jest.fn(),
    }));

    const expressCtor = jest.fn(() => {
      throw 'instrumentation error';
    });
    mockExpressInstrumentation(expressCtor);

    const loadModule = () => {
      let exports: typeof import('../../../../main/modules/opentelemetry') | undefined;
      jest.isolateModules(() => {
        exports = require('../../../../main/modules/opentelemetry');
      });
      return exports!;
    };

    const { initializeOpenTelemetry } = loadModule();
    const handle = initializeOpenTelemetry();

    expect(handle.enabled).toBe(true);
    expect(stderrSpy).toHaveBeenCalled();
    stderrSpy.mockRestore();
  });

  it('formats errors without a stack trace', () => {
    const useAzureMonitor = jest.fn();
    const shutdownAzureMonitor = jest.fn().mockResolvedValue(undefined);
    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

    jest.doMock('config', () => ({
      has: jest.fn(() => true),
      get: jest.fn(() => 'InstrumentationKey=example'),
    }));

    jest.doMock('@azure/monitor-opentelemetry', () => ({
      useAzureMonitor,
      shutdownAzureMonitor,
    }));

    jest.doMock('@opentelemetry/instrumentation', () => ({
      registerInstrumentations: jest.fn(),
    }));

    const expressCtor = jest.fn(() => {
      const error = new Error('no stack');
      error.stack = undefined;
      throw error;
    });
    mockExpressInstrumentation(expressCtor);

    const loadModule = () => {
      let exports: typeof import('../../../../main/modules/opentelemetry') | undefined;
      jest.isolateModules(() => {
        exports = require('../../../../main/modules/opentelemetry');
      });
      return exports!;
    };

    const { initializeOpenTelemetry } = loadModule();
    const handle = initializeOpenTelemetry();

    expect(handle.enabled).toBe(true);
    expect(stderrSpy).toHaveBeenCalled();
    stderrSpy.mockRestore();
  });
});
