import { statfsSync } from 'node:fs';
import path from 'node:path';

import { Application, Response } from 'express';
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

const GROUPS = ['liveness', 'readiness'];
const DISK_SPACE_THRESHOLD_BYTES = 10 * 1024 * 1024;

function shutdownCheck(): boolean {
  return myApp.locals.shutdown;
}

function up(): HealthComponent {
  return { status: 'UP' };
}

function down(details?: Record<string, unknown>): HealthComponent {
  return details ? { status: 'DOWN', details } : { status: 'DOWN' };
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
