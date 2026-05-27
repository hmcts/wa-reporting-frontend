import { Application } from 'express';
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

function shutdownCheck(): boolean {
  return myApp.locals.shutdown;
}

function setDefaultBuildInfoEnvironment(): void {
  process.env.PACKAGES_ENVIRONMENT ??= process.env.REFORM_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development';
  process.env.PACKAGES_PROJECT ??= process.env.REFORM_TEAM ?? 'wa';
  process.env.PACKAGES_NAME ??= process.env.REFORM_SERVICE_NAME ?? packageJson.name;
  process.env.PACKAGES_VERSION ??= packageJson.version;
}

function createIdamHealthCheck() {
  const idamPublicUrl = config.get<string>('services.idam.url.public');
  const idamHealthPath = config.get<string>('services.idam.health.path');
  const idamHealthUrl = new URL(idamHealthPath, idamPublicUrl).toString();
  const timeout = config.get<number>('services.idam.health.timeout');
  const deadline = config.get<number>('services.idam.health.deadline');

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

  const healthCheckConfig = {
    checks: {
      ...(idam ? { idam } : {}),
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
