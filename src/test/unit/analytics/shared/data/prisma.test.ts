import { PrismaClient } from '@prisma/client';

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

    expect(PrismaClient).toHaveBeenNthCalledWith(1, { datasources: { db: { url: 'postgres://tm' } } });
    expect(PrismaClient).toHaveBeenNthCalledWith(2, { datasources: { db: { url: 'postgres://crd' } } });
    expect(PrismaClient).toHaveBeenNthCalledWith(3, { datasources: { db: { url: 'postgres://lrd' } } });
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
      datasources: { db: { url: 'postgresql://user:p%40ss@localhost:5432/tasks?schema=analytics' } },
    });
    expect(PrismaClient).toHaveBeenNthCalledWith(2, undefined);
    expect(PrismaClient).toHaveBeenNthCalledWith(3, undefined);
  });

  test('builds a URL without password or schema when omitted', () => {
    loadModule({
      'database.tm.host': 'db.host',
      'database.tm.user': 'readonly',
      'database.tm.db_name': 'tasks',
    });

    expect(PrismaClient).toHaveBeenNthCalledWith(1, {
      datasources: { db: { url: 'postgresql://readonly@db.host:5432/tasks' } },
    });
  });

  test('creates prisma clients with and without urls', () => {
    const { createPrismaClient } = loadModule({});

    createPrismaClient('postgres://test');
    createPrismaClient();

    expect(PrismaClient).toHaveBeenCalledWith({ datasources: { db: { url: 'postgres://test' } } });
    expect(PrismaClient).toHaveBeenCalledWith(undefined);
  });
});
