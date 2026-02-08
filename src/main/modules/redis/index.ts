import config from 'config';
import { Application } from 'express';
import { createClient } from 'redis';

const { Logger } = require('@hmcts/nodejs-logging');

const logger = Logger.getLogger('redis');

type RedisClient = ReturnType<typeof createClient>;

export function getRedisClient(app: Application): RedisClient | null {
  const redisHost: string | undefined = config.get('session.redis.host');

  if (!redisHost) {
    return null;
  }

  if (app.locals.redisClient) {
    return app.locals.redisClient as RedisClient;
  }

  const redisPort: number | undefined = config.get('session.redis.port');
  const redisPass: string | undefined = config.get('session.redis.key');

  const client = createClient({
    ...(redisPass ? { password: redisPass } : {}),
    socket: {
      host: redisHost,
      port: redisPort,
      ...(redisPass ? { tls: true } : {}),
      connectTimeout: 5000,
      reconnectStrategy: (retries: number) => {
        const delayMs = Math.min(retries * 100, 3000);
        logger.warn('redis.reconnect', { retries, delayMs });
        return delayMs;
      },
    },
  });

  client.on('connect', () => logger.info('redis.connect'));
  client.on('ready', () => logger.info('redis.ready'));
  client.on('reconnecting', () => logger.warn('redis.reconnecting'));
  client.on('end', () => logger.warn('redis.end'));
  client.on('error', (error: Error) => logger.error('redis.error', error));

  const connectPromise = client.connect();

  app.locals.redisClient = client;
  app.locals.appRedisClient = client;
  app.locals.redisConnectPromise = connectPromise;

  return client;
}
