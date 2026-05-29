import { Application } from 'express';
import config = require('config');

import { app as myApp } from '../app';

const healthcheck = require('@hmcts/nodejs-healthcheck');

type RedisClient = {
  ping: () => Promise<unknown>;
};

function shutdownCheck(): boolean {
  return myApp.locals.shutdown;
}

function createIdamHealthCheck() {
  const idamHealthUrl = config.get<string>('services.idam.health.url');
  const deadline = config.get<number>('services.idam.health.deadline');

  return healthcheck.web(idamHealthUrl, {
    timeout: deadline,
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
  const readinessState = createReadinessStateHealthCheck();
  const redis = hasRedisConfigured(app) ? createRedisHealthCheck(app) : null;
  const idam = createIdamHealthCheck();

  const healthCheckConfig = {
    checks: {
      ping: healthcheck.raw(() => healthcheck.up()),
      livenessState: healthcheck.raw(() => healthcheck.up()),
      readinessState,
      idam,
      ...(redis ? { redis } : {}),
    },
    readinessChecks: {
      readinessState,
      ...(redis ? { redis } : {}),
    },
  };

  healthcheck.addTo(app, healthCheckConfig);
}
