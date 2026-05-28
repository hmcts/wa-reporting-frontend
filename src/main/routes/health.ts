import { Application } from 'express';
import { Client } from 'pg';
import config = require('config');

import { app as myApp } from '../app';

const healthcheck = require('@hmcts/nodejs-healthcheck');
const packageJson = require('../../../package.json') as { name: string; version: string };

type HealthCheckResponse = {
  status?: number;
  body?: {
    status?: string;
  };
};

type DatabaseHealthConfig = {
  connectionString: string;
  schema: string;
};

const DEFAULT_TM_DATABASE = 'cft_task_db';
const DEFAULT_TM_PORT = '5432';
const DEFAULT_TM_SCHEMA = 'analytics';
const DEFAULT_TM_OPTIONS = 'sslmode=verify-full';
const TM_DATABASE_HEALTH_QUERY = 'SELECT 1 FROM pg_namespace WHERE nspname = $1 LIMIT 1';

function shutdownCheck(): boolean {
  return myApp.locals.shutdown;
}

function setDefaultBuildInfoEnvironment(): void {
  process.env.PACKAGES_ENVIRONMENT ??= process.env.REFORM_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development';
  process.env.PACKAGES_PROJECT ??= process.env.REFORM_TEAM ?? 'wa';
  process.env.PACKAGES_NAME ??= process.env.REFORM_SERVICE_NAME ?? packageJson.name;
  process.env.PACKAGES_VERSION ??= packageJson.version;
}

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  return values.find(value => value !== undefined && value.trim() !== '')?.trim();
}

function normaliseDatabaseOptions(options: string | undefined): string {
  return firstNonEmpty(options)?.replace(/^\?+/, '') ?? '';
}

function isDeployedEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(firstNonEmpty(env.REFORM_ENVIRONMENT));
}

function buildTmDatabaseConnectionString(env: NodeJS.ProcessEnv = process.env): DatabaseHealthConfig | undefined {
  const schema = firstNonEmpty(env.TM_DB_SCHEMA) ?? DEFAULT_TM_SCHEMA;
  const directUrl = firstNonEmpty(env.TM_DB_URL);

  if (directUrl) {
    return { connectionString: directUrl, schema };
  }

  const host = firstNonEmpty(env.TM_DB_HOST);
  const port = firstNonEmpty(env.TM_DB_PORT) ?? DEFAULT_TM_PORT;
  const user = firstNonEmpty(env.TM_DB_USER);
  const password = env.TM_DB_PASSWORD;
  const database = firstNonEmpty(env.TM_DB_NAME) ?? DEFAULT_TM_DATABASE;
  const options = normaliseDatabaseOptions(env.TM_DB_OPTIONS ?? DEFAULT_TM_OPTIONS);

  if (!host || !user) {
    return undefined;
  }

  const auth = password ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}` : encodeURIComponent(user);
  const connectionString = `postgresql://${auth}@${host}:${port}/${database}`;
  const searchPathOption = `options=-csearch_path=${encodeURIComponent(schema)}`;
  const connectionOptions = options ? `${options}&${searchPathOption}` : searchPathOption;

  return {
    connectionString: `${connectionString}?${connectionOptions}`,
    schema,
  };
}

function shouldRegisterDatabaseHealthCheck(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    Boolean(firstNonEmpty(env.TM_DB_URL) || (firstNonEmpty(env.TM_DB_HOST) && firstNonEmpty(env.TM_DB_USER))) ||
    isDeployedEnvironment(env)
  );
}

async function tmDatabaseHealth() {
  const databaseConfig = buildTmDatabaseConnectionString();

  if (!databaseConfig) {
    return healthcheck.down();
  }

  const client = new Client({ connectionString: databaseConfig.connectionString });

  try {
    await client.connect();
    const result = await client.query(TM_DATABASE_HEALTH_QUERY, [databaseConfig.schema]);
    return result.rowCount === 1 ? healthcheck.up() : healthcheck.down();
  } catch {
    return healthcheck.down();
  } finally {
    await client.end().catch(() => undefined);
  }
}

function createIdamHealthCheck() {
  const idamPublicUrl = config.get<string>('services.idam.url.public');
  const idamHealthPath = config.get<string>('services.idam.health.path');
  const idamHealthUrl = new URL(idamHealthPath, idamPublicUrl).toString();
  const deadline = config.get<number>('services.idam.health.deadline');
  const timeout = config.has('services.idam.health.timeout')
    ? config.get<number>('services.idam.health.timeout')
    : deadline;

  return healthcheck.web(idamHealthUrl, {
    callback: (err: Error | null, res?: HealthCheckResponse) => {
      const healthy = !err && res?.status === 200;
      return healthy ? healthcheck.up() : healthcheck.down();
    },
    timeout,
    deadline,
  });
}

export default function (app: Application): void {
  setDefaultBuildInfoEnvironment();

  const locals = app.locals ?? {};
  const redisClient = locals.redisClient as { ping: () => Promise<unknown> } | undefined;
  const redis = redisClient
    ? healthcheck.raw(() => redisClient.ping().then(healthcheck.up).catch(healthcheck.down))
    : null;
  const idam =
    config.get<boolean>('auth.enabled') && config.get<boolean>('services.idam.health.enabled')
      ? createIdamHealthCheck()
      : null;
  const db = shouldRegisterDatabaseHealthCheck() ? healthcheck.raw(tmDatabaseHealth) : null;

  const healthCheckConfig = {
    checks: {
      ...(idam ? { idam } : {}),
      ...(db ? { db } : {}),
      ...(redis ? { redis } : {}),
    },
    readinessChecks: {
      shutdownCheck: healthcheck.raw(() => {
        return shutdownCheck() ? healthcheck.down() : healthcheck.up();
      }),
      ...(redis ? { redis } : {}),
    },
  };

  healthcheck.addTo(app, healthCheckConfig);
}
