describe('OpenTelemetry module', () => {
  const useAzureMonitor = jest.fn();
  const registerInstrumentations = jest.fn();
  const getDelegate = jest.fn();
  const getTracerProvider = jest.fn(() => ({ getDelegate }));
  const resourceFromAttributes = jest.fn();
  const ExpressInstrumentation = jest.fn().mockImplementation(() => ({ name: 'express' }));
  const WinstonInstrumentation = jest.fn().mockImplementation(() => ({ name: 'winston' }));

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete (globalThis as { __otelInitialized?: boolean }).__otelInitialized;

    jest.doMock('@azure/monitor-opentelemetry', () => ({
      useAzureMonitor,
    }));

    jest.doMock('@opentelemetry/api', () => ({
      trace: { getTracerProvider },
      ProxyTracerProvider: class {},
    }));

    jest.doMock('@opentelemetry/instrumentation', () => ({
      registerInstrumentations,
    }));

    jest.doMock('@opentelemetry/instrumentation-express', () => ({
      ExpressInstrumentation,
    }));

    jest.doMock('@opentelemetry/instrumentation-winston', () => ({
      WinstonInstrumentation,
    }));

    jest.doMock('@opentelemetry/resources', () => ({
      resourceFromAttributes,
    }));

    jest.doMock('@opentelemetry/semantic-conventions', () => ({
      ATTR_SERVICE_NAME: 'service.name',
    }));
  });

  it('does nothing when connection string is missing', () => {
    jest.doMock('config', () => ({
      get: jest.fn(() => undefined),
    }));

    const { initializeTelemetry } = require('../../../../main/modules/opentelemetry');

    const result = initializeTelemetry();

    expect(useAzureMonitor).not.toHaveBeenCalled();
    expect(registerInstrumentations).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('initialises OpenTelemetry when connection string is set', () => {
    jest.doMock('config', () => ({
      get: jest.fn(() => 'conn'),
    }));

    resourceFromAttributes.mockImplementation((attributes: Record<string, string>) => ({ attributes }));

    const { initializeTelemetry } = require('../../../../main/modules/opentelemetry');

    const result = initializeTelemetry();

    const options = useAzureMonitor.mock.calls[0][0];
    const httpOptions = options.instrumentationOptions.http;

    expect(httpOptions.ignoreIncomingRequestHook({ method: 'OPTIONS' })).toBe(true);
    expect(httpOptions.ignoreIncomingRequestHook({ method: 'GET', url: '/assets/app.css' })).toBe(true);
    expect(httpOptions.ignoreIncomingRequestHook({ method: 'GET', url: '/foo' })).toBe(false);
    expect(httpOptions.ignoreOutgoingRequestHook({ path: '/health' })).toBe(true);
    expect(httpOptions.ignoreOutgoingRequestHook({ path: '/info' })).toBe(false);

    expect(useAzureMonitor).toHaveBeenCalledWith(
      expect.objectContaining({
        azureMonitorExporterOptions: { connectionString: 'conn' },
        samplingRatio: 1.0,
        resource: expect.objectContaining({
          attributes: { 'service.name': 'wa-reporting-frontend' },
        }),
      })
    );
    expect(registerInstrumentations).toHaveBeenCalledWith(
      expect.objectContaining({
        instrumentations: [expect.objectContaining({ name: 'express' }), expect.objectContaining({ name: 'winston' })],
      })
    );
    expect(getTracerProvider).toHaveBeenCalled();
    expect(getDelegate).toHaveBeenCalled();
    expect(result).toBe(true);
  });
});
