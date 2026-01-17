import { PrismaClient } from '@prisma/client';

const prismaPgMock = jest.fn().mockImplementation(pool => ({ pool }));
const poolMock = jest.fn().mockImplementation(options => ({ options }));

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: prismaPgMock,
}));

jest.mock('pg', () => ({
  Pool: poolMock,
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
  Prisma: {
    sql: jest.fn(),
    join: jest.fn(),
    raw: jest.fn(),
  },
}));

describe('analytics prisma configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  const loadModule = (configValues: Record<string, unknown>) => {
    jest.doMock('config', () => ({
      has: (path: string) => Object.prototype.hasOwnProperty.call(configValues, path),
      get: (path: string) => configValues[path],
    }));

    let exports: typeof import('../../../../../main/modules/analytics/shared/data/prisma') | undefined;
    jest.isolateModules(() => {
      jest.doMock('@prisma/client', () => ({
        PrismaClient,
        Prisma: {
          sql: jest.fn(),
          join: jest.fn(),
          raw: jest.fn(),
        },
      }));
      exports = require('../../../../../main/modules/analytics/shared/data/prisma');
    });

    return exports!;
  };

  test('uses direct URLs when configured', () => {
    loadModule({
      'database.tm.url': 'postgres://tm',
      'database.crd.url': 'postgres://crd',
      'database.lrd.url': 'postgres://lrd',
    });

    expect(poolMock).toHaveBeenNthCalledWith(1, { connectionString: 'postgres://tm' });
    expect(poolMock).toHaveBeenNthCalledWith(2, { connectionString: 'postgres://crd' });
    expect(poolMock).toHaveBeenNthCalledWith(3, { connectionString: 'postgres://lrd' });
    expect(PrismaClient).toHaveBeenNthCalledWith(1, { adapter: prismaPgMock.mock.results[0].value });
    expect(PrismaClient).toHaveBeenNthCalledWith(2, { adapter: prismaPgMock.mock.results[1].value });
    expect(PrismaClient).toHaveBeenNthCalledWith(3, { adapter: prismaPgMock.mock.results[2].value });
  });

  test('builds a URL from host credentials when direct URL is missing', () => {
    loadModule({
      'database.tm.host': 'localhost',
      'database.tm.port': 5432,
      'database.tm.user': 'user',
      'database.tm.password': 'p@ss',
      'database.tm.db_name': 'tasks',
      'database.tm.schema': 'analytics',
    });

    expect(PrismaClient).toHaveBeenNthCalledWith(1, {
      adapter: prismaPgMock.mock.results[0].value,
    });
    expect(PrismaClient).toHaveBeenNthCalledWith(2);
    expect(PrismaClient).toHaveBeenNthCalledWith(3);
    expect(poolMock).toHaveBeenCalledWith({
      connectionString: 'postgresql://user:p%40ss@localhost:5432/tasks?options=-csearch_path=analytics',
    });
  });

  test('builds a URL without password or schema when omitted', () => {
    loadModule({
      'database.tm.host': 'db.host',
      'database.tm.user': 'readonly',
      'database.tm.db_name': 'tasks',
    });

    expect(PrismaClient).toHaveBeenNthCalledWith(1, {
      adapter: prismaPgMock.mock.results[0].value,
    });
    expect(poolMock).toHaveBeenCalledWith({ connectionString: 'postgresql://readonly@db.host:5432/tasks' });
  });

  test('builds a URL with options when configured', () => {
    loadModule({
      'database.tm.host': 'db.host',
      'database.tm.user': 'readonly',
      'database.tm.db_name': 'tasks',
      'database.tm.options': 'sslmode=require',
      'database.tm.schema': 'analytics',
    });

    expect(poolMock).toHaveBeenCalledWith({
      connectionString: 'postgresql://readonly@db.host:5432/tasks?sslmode=require&options=-csearch_path=analytics',
    });
  });

  test('creates prisma clients with and without urls', () => {
    const { createPrismaClient } = loadModule({});

    jest.clearAllMocks();

    createPrismaClient('postgres://test');
    createPrismaClient();

    expect(poolMock).toHaveBeenCalledWith({ connectionString: 'postgres://test' });
    expect(PrismaClient).toHaveBeenCalledWith({ adapter: prismaPgMock.mock.results[0].value });
    expect(PrismaClient).toHaveBeenCalledWith();
  });
});
