import { Application } from 'express';
import config = require('config');

import { app as myApp } from '../app';

const healthcheck = require('@hmcts/nodejs-healthcheck');
const packageJson = require('../../../package.json') as { name: string; version: string };

type HealthCheckResponse = {
  status?: number;
};

type RedisClient = {
  ping: () => Promise<unknown>;
};

function shutdownCheck(): boolean {
  return myApp.locals.shutdown;
}

function setDefaultBuildInfoEnvironment(): void {
  process.env.PACKAGES_ENVIRONMENT ??= process.env.SERVICE_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development';
  process.env.PACKAGES_PROJECT ??= process.env.SERVICE_TEAM ?? 'wa';
  process.env.PACKAGES_NAME ??= process.env.SERVICE_NAME ?? packageJson.name;
  process.env.PACKAGES_VERSION ??= packageJson.version;
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

function createRedisHealthCheck(app: Application) {
  return healthcheck.raw(() => {
    const redisClient = app.locals?.redisClient as RedisClient | undefined;

    if (!redisClient) {
      return healthcheck.down();
    }

    return redisClient
      .ping()
      .then(() => healthcheck.up())
      .catch(() => healthcheck.down());
  });
}

function hasRedisConfigured(app: Application): boolean {
  return Boolean(app.locals?.redisClient || config.get<string>('secrets.wa.wa-reporting-redis-host'));
}

function createReadinessStateHealthCheck() {
  return healthcheck.raw(() => {
    return shutdownCheck() ? healthcheck.down() : healthcheck.up();
  });
}

export default function (app: Application): void {
  setDefaultBuildInfoEnvironment();

  const readinessState = createReadinessStateHealthCheck();
  const redis = hasRedisConfigured(app) ? createRedisHealthCheck(app) : null;
  const idam =
    config.get<boolean>('auth.enabled') && config.get<boolean>('services.idam.health.enabled')
      ? createIdamHealthCheck()
      : null;

  const healthCheckConfig = {
    checks: {
      ping: healthcheck.raw(() => healthcheck.up()),
      livenessState: healthcheck.raw(() => healthcheck.up()),
      readinessState,
      ...(idam ? { idam } : {}),
      ...(redis ? { redis } : {}),
    },
    readinessChecks: {
      readinessState,
      ...(redis ? { redis } : {}),
    },
  };

  healthcheck.addTo(app, healthCheckConfig);
}
