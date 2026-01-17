import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import config from 'config';
import { Pool } from 'pg';

function getConfigValue<T>(path: string): T | undefined {
  return config.has(path) ? config.get<T>(path) : undefined;
}

function buildDatabaseUrlFromConfig(prefix: string): string | undefined {
  const directUrl = getConfigValue<string>(`${prefix}.url`);
  if (directUrl) {
    return directUrl;
  }

  const host = getConfigValue<string>(`${prefix}.host`);
  const port = getConfigValue<number | string>(`${prefix}.port`) ?? '5432';
  const user = getConfigValue<string>(`${prefix}.user`);
  const password = getConfigValue<string>(`${prefix}.password`);
  const database = getConfigValue<string>(`${prefix}.db_name`);
  const schema = getConfigValue<string>(`${prefix}.schema`);
  const options = getConfigValue<string>(`${prefix}.options`);

  if (!host || !user || !database) {
    return undefined;
  }

  console.log(`Authenticating as user ${user} to database ${database}, schema ${schema}`);
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

export function createPrismaClient(databaseUrl?: string): PrismaClient {
  if (!databaseUrl) {
    return new PrismaClient();
  }

  const pool = new Pool({ connectionString: databaseUrl });

  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

const tmDatabaseUrl = buildDatabaseUrlFromConfig('database.tm');
const crdDatabaseUrl = buildDatabaseUrlFromConfig('database.crd');
const lrdDatabaseUrl = buildDatabaseUrlFromConfig('database.lrd');

export const tmPrisma = createPrismaClient(tmDatabaseUrl);

export const crdPrisma = createPrismaClient(crdDatabaseUrl);

export const lrdPrisma = createPrismaClient(lrdDatabaseUrl);
