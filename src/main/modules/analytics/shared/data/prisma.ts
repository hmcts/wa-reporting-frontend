import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import config from 'config';
import { Pool } from 'pg';

const { Logger } = require('@hmcts/nodejs-logging');

const logger = Logger.getLogger('db');

function getConfigValue<T>(path: string): T | undefined {
  return config.has(path) ? config.get<T>(path) : undefined;
}

function buildDatabaseUrlFromConfig(key: string): string | undefined {
  const prefix = `database.${key}`;
  const directUrl = getConfigValue<string>(`${prefix}.url`);
  if (directUrl) {
    return directUrl;
  }

  const host = getConfigValue<string>(`${prefix}.host`);
  const port = getConfigValue<number | string>(`${prefix}.port`) ?? '5432';
  const user = getConfigValue<string>(`secrets.wa.${key}-db-user`);
  const password = getConfigValue<string>(`secrets.wa.${key}-db-password`);
  const database = getConfigValue<string>(`${prefix}.db_name`);
  const schema = getConfigValue<string>(`${prefix}.schema`);
  const options = getConfigValue<string>(`${prefix}.options`);

  if (!host || !user || !database) {
    return undefined;
  }

  const auth = password ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}` : encodeURIComponent(user);
  const optionsParams = [];
  if (options) {
    optionsParams.push(options);
  }
  if (schema) {
    optionsParams.push(`options=-csearch_path=${encodeURIComponent(schema)}`);
  }

  const optsString = optionsParams.length > 0 ? `?${optionsParams.join('&')}` : '';
  return `postgresql://${auth}@${host}:${port}/${database}${optsString}`;
}

function isPrismaQueryLoggingEnabled(): boolean {
  return getConfigValue<boolean>('logging.prismaQueryTimings') ?? false;
}

export function createPrismaClient(databaseUrl?: string): PrismaClient {
  if (!databaseUrl) {
    return new PrismaClient();
  }

  const pool = new Pool({ connectionString: databaseUrl });

  if (!isPrismaQueryLoggingEnabled()) {
    return new PrismaClient({ adapter: new PrismaPg(pool) });
  }

  const client = new PrismaClient({
    adapter: new PrismaPg(pool),
    log: [{ emit: 'event', level: 'query' }],
  });

  client.$on('query', e => {
    const payload: Record<string, unknown> = {
      durationMs: e.duration,
      target: e.target,
      query: e.query,
    };
    logger.info('db.query', payload);
  });

  return client;
}

const tmDatabaseUrl = buildDatabaseUrlFromConfig('tm');
const crdDatabaseUrl = buildDatabaseUrlFromConfig('crd');
const lrdDatabaseUrl = buildDatabaseUrlFromConfig('lrd');

export const tmPrisma = createPrismaClient(tmDatabaseUrl);
export const crdPrisma = createPrismaClient(crdDatabaseUrl);
export const lrdPrisma = createPrismaClient(lrdDatabaseUrl);
