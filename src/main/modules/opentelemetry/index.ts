import { AzureMonitorOpenTelemetryOptions, useAzureMonitor } from '@azure/monitor-opentelemetry';
import { ProxyTracerProvider, trace } from '@opentelemetry/api';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentationConfig } from '@opentelemetry/instrumentation-http';
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import config from 'config';
import { IncomingMessage } from 'node:http';
import { RequestOptions } from 'node:https';

const resolveLoggerInfo = (): ((message: string) => void) => {
  try {
    const loggingModule = require('../logging');
    const logger = loggingModule?.default ?? loggingModule;
    if (logger && typeof logger.info === 'function') {
      return (message: string) => logger.info(message);
    }
  } catch {
    // Fall back to console when the logger cannot be loaded (e.g. test mocks).
  }
  return () => undefined;
};

export const initializeTelemetry = (): void => {
  const connectionString = config.get<string>('appInsights.connectionString');
  if (!connectionString) {
    return;
  }

  const httpInstrumentationConfig: HttpInstrumentationConfig = {
    enabled: true,
    ignoreIncomingRequestHook: (request: IncomingMessage) => {
      if (request.method === 'OPTIONS') {
        return true;
      }
      if (request.url?.match(/\/assets\/|\.js|\.css/)) {
        return true;
      }
      return false;
    },
    ignoreOutgoingRequestHook: (options: RequestOptions) => options.path === '/health',
  };

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'wa-reporting-frontend',
  });

  const options: AzureMonitorOpenTelemetryOptions = {
    azureMonitorExporterOptions: {
      connectionString,
    },
    samplingRatio: 1.0,
    resource,
    instrumentationOptions: {
      http: httpInstrumentationConfig,
      azureSdk: { enabled: true },
    },
  };

  useAzureMonitor(options);

  const tracerProvider = (trace.getTracerProvider() as ProxyTracerProvider).getDelegate();
  registerInstrumentations({
    instrumentations: [new ExpressInstrumentation(), new WinstonInstrumentation()],
    tracerProvider,
  });

  resolveLoggerInfo()('OpenTelemetry initialized');
};
