import { statfsSync } from 'node:fs';
import path from 'node:path';

import { Application, Response } from 'express';
import { Client } from 'pg';
import config = require('config');

import { app as myApp } from '../app';

type HealthStatus = 'UP' | 'DOWN' | 'OUT_OF_SERVICE' | 'UNKNOWN';

type HealthComponent = {
  status: HealthStatus;
  description?: string;
  details?: Record<string, unknown>;
  components?: Record<string, HealthComponent>;
};

type HealthResponse = {
  status: HealthStatus;
  groups?: string[];
  components?: Record<string, HealthComponent>;
};

type RedisHealthClient = {
  ping: () => Promise<unknown>;
};

type DatabaseHealthConfig = {
  connectionString: string;
  schema: string;
};

const GROUPS = ['liveness', 'readiness'];
const DISK_SPACE_THRESHOLD_BYTES = 10 * 1024 * 1024;
const DEFAULT_TM_DATABASE = 'cft_task_db';
const DEFAULT_TM_PORT = '5432';
const DEFAULT_TM_SCHEMA = 'analytics';
const DEFAULT_TM_OPTIONS = 'sslmode=verify-full';
const TM_DATABASE_HEALTH_QUERY = 'SELECT 1 FROM pg_namespace WHERE nspname = $1 LIMIT 1';

function shutdownCheck(): boolean {
  return myApp.locals.shutdown;
}

function up(): HealthComponent {
  return { status: 'UP' };
}

function down(details?: Record<string, unknown>): HealthComponent {
  return details ? { status: 'DOWN', details } : { status: 'DOWN' };
}

function unknown(): HealthComponent {
  return { status: 'UNKNOWN' };
}

function readinessState(): HealthComponent {
  return shutdownCheck() ? { status: 'OUT_OF_SERVICE' } : up();
}

function overallStatus(components: Record<string, HealthComponent>): HealthStatus {
  const statuses = Object.values(components).map(component => component.status);
  if (statuses.includes('DOWN')) {
    return 'DOWN';
  }
  if (statuses.includes('OUT_OF_SERVICE')) {
    return 'OUT_OF_SERVICE';
  }
  return 'UP';
}

function responseStatus(status: HealthStatus): number {
  return status === 'UP' ? 200 : 503;
}

function diskSpaceHealth(): HealthComponent {
  const diskPath = `${path.resolve(process.cwd())}/.`;

  try {
    const stats = statfsSync(process.cwd());
    const total = stats.blocks * stats.bsize;
    const free = stats.bavail * stats.bsize;

    return {
      status: free >= DISK_SPACE_THRESHOLD_BYTES ? 'UP' : 'DOWN',
      details: {
        total,
        free,
        threshold: DISK_SPACE_THRESHOLD_BYTES,
        path: diskPath,
        exists: true,
      },
    };
  } catch {
    return down({
      threshold: DISK_SPACE_THRESHOLD_BYTES,
      path: diskPath,
      exists: false,
    });
  }
}

async function redisHealth(redisClient: RedisHealthClient): Promise<HealthComponent> {
  try {
    await redisClient.ping();
    return up();
  } catch {
    return down();
  }
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

async function databaseHealth(): Promise<HealthComponent> {
  const databaseConfig = buildTmDatabaseConnectionString();

  if (!databaseConfig) {
    return isDeployedEnvironment() ? down() : unknown();
  }

  const client = new Client({ connectionString: databaseConfig.connectionString });

  try {
    await client.connect();
    const result = await client.query(TM_DATABASE_HEALTH_QUERY, [databaseConfig.schema]);
    return result.rowCount === 1 ? up() : down();
  } catch {
    return down();
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function idamHealth(): Promise<HealthComponent> {
  const idamPublicUrl = config.get<string>('services.idam.url.public');
  const idamHealthPath = config.get<string>('services.idam.health.path');
  const idamHealthUrl = new URL(idamHealthPath, idamPublicUrl).toString();
  const deadline = config.get<number>('services.idam.health.deadline');
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), deadline);

  try {
    const response = await fetch(idamHealthUrl, { signal: abortController.signal });
    return response.ok ? up() : down();
  } catch {
    return down();
  } finally {
    clearTimeout(timeout);
  }
}

function isIdamHealthEnabled(): boolean {
  return config.get<boolean>('auth.enabled') && config.get<boolean>('services.idam.health.enabled');
}

function getRedisClient(app: Application): RedisHealthClient | undefined {
  const locals = app.locals ?? {};
  return locals.redisClient as RedisHealthClient | undefined;
}

async function aggregateComponents(app: Application): Promise<Record<string, HealthComponent>> {
  const redisClient = getRedisClient(app);
  const componentEntries: (Promise<[string, HealthComponent]> | [string, HealthComponent])[] = [
    ['diskSpace', diskSpaceHealth()],
    databaseHealth().then(component => ['db', component] as [string, HealthComponent]),
    ['livenessState', up()],
    ['ping', up()],
    ['readinessState', readinessState()],
  ];

  if (isIdamHealthEnabled()) {
    componentEntries.push(idamHealth().then(component => ['idam', component] as [string, HealthComponent]));
  }
  if (redisClient) {
    componentEntries.push(
      redisHealth(redisClient).then(component => ['redis', component] as [string, HealthComponent])
    );
  }

  return Object.fromEntries(await Promise.all(componentEntries));
}

async function readinessComponents(app: Application): Promise<Record<string, HealthComponent>> {
  const redisClient = getRedisClient(app);
  const components: Record<string, HealthComponent> = {
    readinessState: readinessState(),
  };

  if (redisClient) {
    components.redis = await redisHealth(redisClient);
  }

  return components;
}

function sendHealth(res: Response, body: HealthResponse): void {
  res.status(responseStatus(body.status)).json(body);
}

export default function (app: Application): void {
  app.get('/health', async (_req, res) => {
    const components = await aggregateComponents(app);
    sendHealth(res, {
      status: overallStatus(components),
      groups: GROUPS,
      components,
    });
  });

  app.get('/health/liveness', (_req, res) => {
    const components = {
      livenessState: up(),
    };
    sendHealth(res, {
      status: overallStatus(components),
      components,
    });
  });

  app.get('/health/readiness', async (_req, res) => {
    const components = await readinessComponents(app);
    sendHealth(res, {
      status: overallStatus(components),
      components,
    });
  });
}
