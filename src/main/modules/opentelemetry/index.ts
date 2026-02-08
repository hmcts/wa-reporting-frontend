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

export const initializeTelemetry = (): boolean => {
  const connectionString = config.get<string>('appInsights.connectionString');
  if (!connectionString) {
    return false;
  }
  const globalState = globalThis as { __otelInitialized?: boolean };
  if (globalState.__otelInitialized) {
    return false;
  }
  globalState.__otelInitialized = true;

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

  return true;
};
