import { Application } from 'express';

import { app as myApp } from '../app';

const healthcheck = require('@hmcts/nodejs-healthcheck');

function shutdownCheck(): boolean {
  return myApp.locals.shutdown;
}

export default function (app: Application): void {
  const locals = app.locals ?? {};
  const redisClient = locals.redisClient as { ping: () => Promise<unknown> } | undefined;
  const redis = redisClient
    ? healthcheck.raw(() => redisClient.ping().then(healthcheck.up).catch(healthcheck.down))
    : null;

  const healthCheckConfig = {
    checks: {
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
