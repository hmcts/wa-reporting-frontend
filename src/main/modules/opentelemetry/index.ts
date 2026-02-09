import config from 'config';

import {
  type AzureMonitorOpenTelemetryOptions,
  shutdownAzureMonitor,
  useAzureMonitor,
} from '@azure/monitor-opentelemetry';
import { type InstrumentationConfig, registerInstrumentations } from '@opentelemetry/instrumentation';
import { ExpressInstrumentation, ExpressLayerType } from '@opentelemetry/instrumentation-express';

export type OpenTelemetryHandle = {
  enabled: boolean;
  shutdown: () => Promise<void>;
};

let handle: OpenTelemetryHandle | null = null;

const readConnectionString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const getConnectionString = (): string | undefined => {
  const fromEnv = readConnectionString(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING);
  if (fromEnv) {
    return fromEnv;
  }

  if (!config.has('secrets.wa.app-insights-connection-string')) {
    return undefined;
  }
  const value = config.get<string | boolean>('secrets.wa.app-insights-connection-string');
  return readConnectionString(value);
};

const tryRegisterExpressInstrumentation = (): void => {
  try {
    registerInstrumentations({
      instrumentations: [
        new ExpressInstrumentation({
          ignoreLayersType: [ExpressLayerType.MIDDLEWARE, ExpressLayerType.ROUTER],
        }),
      ],
    });
  } catch (error) {
    // Express instrumentation is optional; fall back to HTTP spans if it fails.
    const message = error instanceof Error ? error.stack || error.message : String(error);
    process.stderr.write(`OpenTelemetry Express instrumentation disabled: ${message}\n`);
  }
};

export const initializeOpenTelemetry = (): OpenTelemetryHandle => {
  if (handle) {
    return handle;
  }

  const connectionString = getConnectionString();
  if (!connectionString) {
    handle = {
      enabled: false,
      shutdown: async () => Promise.resolve(),
    };
    return handle;
  }

  process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = connectionString;
  process.env.OTEL_SERVICE_NAME = 'wa-reporting-frontend';

  const options: AzureMonitorOpenTelemetryOptions = {
    azureMonitorExporterOptions: { connectionString },
    samplingRatio: 1,
    instrumentationOptions: {
      http: { enabled: true },
      postgreSql: { enabled: true, requireParentSpan: true } as InstrumentationConfig,
      redis: { enabled: false },
      winston: { enabled: true },
    },
  };

  useAzureMonitor(options);
  tryRegisterExpressInstrumentation();

  handle = {
    enabled: true,
    shutdown: async () => shutdownAzureMonitor(),
  };

  return handle;
};
