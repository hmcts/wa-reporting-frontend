const connectMock = jest.fn();
const queryMock = jest.fn();
const endMock = jest.fn();
const clientConstructorMock = jest.fn();

jest.mock('pg', () => ({
  escapeIdentifier: jest.requireActual('pg').escapeIdentifier,
  Client: function (...args: unknown[]) {
    return clientConstructorMock(...args);
  },
}));

type ScriptModule = {
  DEFAULT_DB_READER_USERNAME: string;
  buildConnectionString: (env?: Record<string, string | undefined>) => string | undefined;
  bootstrapTmSchemaPermissions: (
    config?: {
      connectionString?: string;
      dbReaderUsername: string;
    },
    dependencies?: {
      ClientCtor?: new (config: { connectionString: string }) => {
        connect: () => Promise<void>;
        query: (sql: string, values?: unknown[]) => Promise<unknown>;
        end: () => Promise<void>;
      };
      logger?: {
        info: jest.Mock;
        warn: jest.Mock;
      };
    }
  ) => Promise<void>;
  normaliseOptions: (options?: string) => string;
  validateIdentifier: (identifier: string) => void;
  resolveBootstrapConfig: (env?: Record<string, string | undefined>) => {
    connectionString?: string;
    dbReaderUsername: string;
  };
  runFromEnvironment: (
    env?: Record<string, string | undefined>,
    dependencies?: {
      logger?: {
        info: jest.Mock;
        warn: jest.Mock;
      };
    }
  ) => Promise<void>;
};

const loadBootstrapTmSchemaPermissionsModule = (): ScriptModule => {
  let moduleExports: ScriptModule | undefined;

  jest.isolateModules(() => {
    moduleExports = require('../../../../scripts/bootstrap-tm-schema-permissions.js');
  });

  return moduleExports!;
};

const EXPECTED_DURABLE_TABLES = [
  'snapshot_batches',
  'snapshot_state',
  'court_venue_case_type_lookup',
  'court_venue_epimms_lookup',
  'location_reference_sync_state',
  'snapshot_open_task_rows',
  'snapshot_completed_task_rows',
  'snapshot_user_completed_facts',
  'snapshot_user_completed_daily_totals',
  'snapshot_user_completed_slicer_daily_facts',
  'snapshot_completed_dashboard_facts',
  'snapshot_completed_daily_metrics_facts',
  'snapshot_completed_region_location_facts',
  'snapshot_outstanding_due_status_daily_facts',
  'snapshot_outstanding_created_assignment_daily_facts',
  'snapshot_open_due_daily_facts',
  'snapshot_task_event_daily_facts',
  'snapshot_task_event_service_daily_facts',
  'snapshot_wait_time_by_assigned_date',
  'snapshot_overview_filter_facts',
  'snapshot_outstanding_filter_facts',
  'snapshot_completed_filter_facts',
  'snapshot_user_filter_facts',
];

type PreflightRow = {
  has_schema_usage: boolean;
  missing_tables: string[];
  tables_without_select: string[];
};

const currentPermissions: PreflightRow = {
  has_schema_usage: true,
  missing_tables: [],
  tables_without_select: [],
};

const preflightResult = (overrides: Partial<PreflightRow> = {}) => ({
  rows: [{ ...currentPermissions, ...overrides }],
});

const isPreflightQuery = (sql: string) => sql.includes('WITH required_tables AS');

const mockPreflightRows = (...rows: PreflightRow[]): void => {
  const remainingRows = [...rows];
  queryMock.mockImplementation((sql: string) => {
    if (isPreflightQuery(sql)) {
      return Promise.resolve({ rows: [remainingRows.shift()] });
    }

    return Promise.resolve(undefined);
  });
};

describe('bootstrap-tm-schema-permissions script', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    connectMock.mockResolvedValue(undefined);
    queryMock.mockResolvedValue(undefined);
    endMock.mockResolvedValue(undefined);
    clientConstructorMock.mockReturnValue({
      connect: connectMock,
      query: queryMock,
      end: endMock,
    });
  });

  test('resolves the default reader role name and TM env fallback connection string', () => {
    const { DEFAULT_DB_READER_USERNAME, resolveBootstrapConfig } = loadBootstrapTmSchemaPermissionsModule();

    expect(
      resolveBootstrapConfig({
        TM_DB_HOST: 'tm.db.host',
        TM_DB_PORT: '5433',
        TM_DB_USER: 'bootstrap-user',
        TM_DB_PASSWORD: 's3cret',
        TM_DB_NAME: 'analytics_db',
        TM_DB_OPTIONS: '?sslmode=require',
      })
    ).toEqual({
      connectionString: 'postgresql://bootstrap-user:s3cret@tm.db.host:5433/analytics_db?sslmode=require',
      dbReaderUsername: DEFAULT_DB_READER_USERNAME,
    });
  });

  test('prefers an explicit bootstrap URL and supports password-less connection strings', () => {
    const { buildConnectionString } = loadBootstrapTmSchemaPermissionsModule();

    expect(
      buildConnectionString({
        TM_SCHEMA_PERMISSIONS_BOOTSTRAP_URL: 'postgresql://override.example/cft_task_db?sslmode=require',
        TM_DB_HOST: 'ignored.host',
      })
    ).toBe('postgresql://override.example/cft_task_db?sslmode=require');

    expect(
      buildConnectionString({
        TM_SCHEMA_PERMISSIONS_BOOTSTRAP_HOST: 'tm.db.host',
        TM_SCHEMA_PERMISSIONS_BOOTSTRAP_USER: 'readonly',
        TM_SCHEMA_PERMISSIONS_BOOTSTRAP_OPTIONS: '',
      })
    ).toBe('postgresql://readonly@tm.db.host:5432/cft_task_db');
  });

  test('validates role identifiers before passing them to pg escaping', () => {
    const { validateIdentifier } = loadBootstrapTmSchemaPermissionsModule();

    expect(validateIdentifier('DTS JIT Access wa DB Reader SC')).toBeUndefined();
    expect(validateIdentifier('Reader "SC"')).toBeUndefined();
    expect(() => validateIdentifier('   ')).toThrow(
      'TM schema permissions bootstrap requires a non-empty dbReaderUsername'
    );
  });

  test('normalises option environment inputs', () => {
    const { normaliseOptions } = loadBootstrapTmSchemaPermissionsModule();

    expect(normaliseOptions()).toBe('');
    expect(normaliseOptions(' ?sslmode=require')).toBe('sslmode=require');
  });

  test('supports default process environment resolution paths used by the CLI entrypoint', async () => {
    const previousEnvironment = process.env;
    const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    process.env = {
      ...previousEnvironment,
      TM_DB_HOST: 'tm.db.host',
      TM_DB_USER: 'bootstrap-user',
      TM_DB_NAME: 'analytics_db',
      TM_DB_OPTIONS: '',
    };

    try {
      mockPreflightRows(currentPermissions, currentPermissions);
      const {
        DEFAULT_DB_READER_USERNAME,
        bootstrapTmSchemaPermissions,
        buildConnectionString,
        resolveBootstrapConfig,
        runFromEnvironment,
      } = loadBootstrapTmSchemaPermissionsModule();

      expect(buildConnectionString()).toBe('postgresql://bootstrap-user@tm.db.host:5432/analytics_db');
      expect(resolveBootstrapConfig()).toEqual({
        connectionString: 'postgresql://bootstrap-user@tm.db.host:5432/analytics_db',
        dbReaderUsername: DEFAULT_DB_READER_USERNAME,
      });

      await expect(runFromEnvironment()).resolves.toBeUndefined();

      expect(connectMock).toHaveBeenCalledTimes(1);
      await expect(
        bootstrapTmSchemaPermissions({
          connectionString: 'postgresql://bootstrap-user@tm.db.host:5432/analytics_db',
          dbReaderUsername: DEFAULT_DB_READER_USERNAME,
        })
      ).resolves.toBeUndefined();
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        'TM analytics durable table permissions already granted; skipping bootstrap',
        {
          dbReaderUsername: DEFAULT_DB_READER_USERNAME,
        }
      );
    } finally {
      process.env = previousEnvironment;
      consoleInfoSpy.mockRestore();
    }
  });

  test('skips the transaction and grants when durable permissions are already current', async () => {
    const logger = { info: jest.fn(), warn: jest.fn() };
    mockPreflightRows(currentPermissions);
    const { bootstrapTmSchemaPermissions } = loadBootstrapTmSchemaPermissionsModule();

    await bootstrapTmSchemaPermissions(
      {
        connectionString: 'postgresql://bootstrap-user:s3cret@tm.db.host:5432/cft_task_db?sslmode=require',
        dbReaderUsername: 'DTS JIT Access wa DB Reader SC',
      },
      { logger }
    );

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('WITH required_tables AS'), [
      'DTS JIT Access wa DB Reader SC',
      EXPECTED_DURABLE_TABLES,
      'analytics',
    ]);
    expect(EXPECTED_DURABLE_TABLES).toHaveLength(23);
    expect(EXPECTED_DURABLE_TABLES.some(tableName => /_p_\d+$/.test(tableName))).toBe(false);
    expect(queryMock).not.toHaveBeenCalledWith('BEGIN');
    expect(queryMock.mock.calls.some(([sql]) => String(sql).startsWith('GRANT '))).toBe(false);
    expect(logger.info).toHaveBeenCalledWith(
      'TM analytics durable table permissions already granted; skipping bootstrap',
      {
        dbReaderUsername: 'DTS JIT Access wa DB Reader SC',
      }
    );
    expect(endMock).toHaveBeenCalledTimes(1);
  });

  test('repairs missing schema and durable table permissions inside a serialised transaction', async () => {
    const logger = { info: jest.fn(), warn: jest.fn() };
    const missingPermissions: PreflightRow = {
      has_schema_usage: false,
      missing_tables: [],
      tables_without_select: ['snapshot_batches', 'snapshot_state'],
    };
    mockPreflightRows(missingPermissions, missingPermissions);
    const { bootstrapTmSchemaPermissions } = loadBootstrapTmSchemaPermissionsModule();

    await bootstrapTmSchemaPermissions(
      {
        connectionString: 'postgresql://bootstrap-user:s3cret@tm.db.host:5432/cft_task_db?sslmode=require',
        dbReaderUsername: 'DTS JIT Access wa DB Reader SC',
      },
      { logger }
    );

    expect(clientConstructorMock).toHaveBeenCalledWith({
      connectionString: 'postgresql://bootstrap-user:s3cret@tm.db.host:5432/cft_task_db?sslmode=require',
    });
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(queryMock).toHaveBeenCalledTimes(9);
    expect(queryMock).toHaveBeenNthCalledWith(1, expect.stringContaining('WITH required_tables AS'), [
      'DTS JIT Access wa DB Reader SC',
      EXPECTED_DURABLE_TABLES,
      'analytics',
    ]);
    expect(queryMock).toHaveBeenNthCalledWith(2, 'BEGIN');
    expect(queryMock).toHaveBeenNthCalledWith(3, "SET LOCAL lock_timeout = '30min'");
    expect(queryMock).toHaveBeenNthCalledWith(4, 'SELECT pg_advisory_xact_lock(hashtext($1))', [
      'analytics_run_snapshot_refresh_batch_lock',
    ]);
    expect(queryMock).toHaveBeenNthCalledWith(5, 'SELECT pg_advisory_xact_lock($1, $2)', [0x746d, 0x7065726d]);
    expect(queryMock).toHaveBeenNthCalledWith(6, expect.stringContaining('WITH required_tables AS'), [
      'DTS JIT Access wa DB Reader SC',
      EXPECTED_DURABLE_TABLES,
      'analytics',
    ]);
    expect(queryMock).toHaveBeenNthCalledWith(
      7,
      'GRANT USAGE ON SCHEMA "analytics" TO "DTS JIT Access wa DB Reader SC"'
    );
    expect(queryMock).toHaveBeenNthCalledWith(
      8,
      'GRANT SELECT ON TABLE "analytics"."snapshot_batches", "analytics"."snapshot_state" TO "DTS JIT Access wa DB Reader SC"'
    );
    expect(queryMock).toHaveBeenNthCalledWith(9, 'COMMIT');
    expect(logger.info).toHaveBeenCalledWith(
      'Granted TM analytics durable table permissions to configured DB reader role',
      {
        dbReaderUsername: 'DTS JIT Access wa DB Reader SC',
      }
    );
    expect(endMock).toHaveBeenCalledTimes(1);
  });

  test('commits without grants when a concurrent bootstrap repairs permissions first', async () => {
    const logger = { info: jest.fn(), warn: jest.fn() };
    mockPreflightRows(
      {
        ...currentPermissions,
        tables_without_select: ['snapshot_state'],
      },
      currentPermissions
    );
    const { bootstrapTmSchemaPermissions } = loadBootstrapTmSchemaPermissionsModule();

    await bootstrapTmSchemaPermissions(
      {
        connectionString: 'postgresql://bootstrap-user@tm.db.host:5432/cft_task_db',
        dbReaderUsername: 'DTS JIT Access wa DB Reader SC',
      },
      { logger }
    );

    expect(queryMock).toHaveBeenCalledTimes(7);
    expect(queryMock).toHaveBeenNthCalledWith(7, 'COMMIT');
    expect(queryMock.mock.calls.some(([sql]) => String(sql).startsWith('GRANT '))).toBe(false);
    expect(logger.info).toHaveBeenCalledWith(
      'TM analytics durable table permissions already granted; skipping bootstrap',
      {
        dbReaderUsername: 'DTS JIT Access wa DB Reader SC',
      }
    );
  });

  test('grants only missing table permissions and escapes the configured reader role', async () => {
    const logger = { info: jest.fn(), warn: jest.fn() };
    const missingTablePermission: PreflightRow = {
      ...currentPermissions,
      tables_without_select: ['snapshot_state'],
    };
    mockPreflightRows(missingTablePermission, missingTablePermission);
    const { bootstrapTmSchemaPermissions } = loadBootstrapTmSchemaPermissionsModule();

    await bootstrapTmSchemaPermissions(
      {
        connectionString: 'postgresql://bootstrap-user@tm.db.host:5432/cft_task_db',
        dbReaderUsername: 'Reader "SC"',
      },
      { logger }
    );

    expect(queryMock).not.toHaveBeenCalledWith(expect.stringContaining('GRANT USAGE ON SCHEMA'));
    expect(queryMock).toHaveBeenCalledWith('GRANT SELECT ON TABLE "analytics"."snapshot_state" TO "Reader ""SC"""');
    expect(queryMock.mock.calls.some(([sql]) => String(sql).includes('_p_'))).toBe(false);
  });

  test('grants only missing schema usage when durable table permissions are current', async () => {
    const logger = { info: jest.fn(), warn: jest.fn() };
    const missingSchemaUsage: PreflightRow = {
      ...currentPermissions,
      has_schema_usage: false,
    };
    mockPreflightRows(missingSchemaUsage, missingSchemaUsage);
    const { bootstrapTmSchemaPermissions } = loadBootstrapTmSchemaPermissionsModule();

    await bootstrapTmSchemaPermissions(
      {
        connectionString: 'postgresql://bootstrap-user@tm.db.host:5432/cft_task_db',
        dbReaderUsername: 'DTS JIT Access wa DB Reader SC',
      },
      { logger }
    );

    expect(queryMock).toHaveBeenCalledWith('GRANT USAGE ON SCHEMA "analytics" TO "DTS JIT Access wa DB Reader SC"');
    expect(queryMock.mock.calls.some(([sql]) => String(sql).startsWith('GRANT SELECT'))).toBe(false);
  });

  test('fails fast without a resolvable connection string', async () => {
    const { runFromEnvironment } = loadBootstrapTmSchemaPermissionsModule();

    await expect(runFromEnvironment({})).rejects.toThrow(
      'Unable to resolve TM schema permissions bootstrap database URL'
    );

    expect(clientConstructorMock).not.toHaveBeenCalled();
  });

  test('fails before starting a transaction when a durable analytics table is missing', async () => {
    mockPreflightRows({
      ...currentPermissions,
      missing_tables: ['snapshot_state'],
    });
    const { bootstrapTmSchemaPermissions } = loadBootstrapTmSchemaPermissionsModule();

    await expect(
      bootstrapTmSchemaPermissions({
        connectionString: 'postgresql://bootstrap-user@tm.db.host:5432/cft_task_db',
        dbReaderUsername: 'DTS JIT Access wa DB Reader SC',
      })
    ).rejects.toThrow('TM schema permissions bootstrap is missing required durable analytics tables: snapshot_state');

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock).not.toHaveBeenCalledWith('BEGIN');
    expect(queryMock).not.toHaveBeenCalledWith('ROLLBACK');
    expect(endMock).toHaveBeenCalledTimes(1);
  });

  test('closes the client without rolling back when the preflight query fails', async () => {
    const preflightError = new Error('preflight failed');
    queryMock.mockRejectedValueOnce(preflightError);
    const { bootstrapTmSchemaPermissions } = loadBootstrapTmSchemaPermissionsModule();

    await expect(
      bootstrapTmSchemaPermissions({
        connectionString: 'postgresql://bootstrap-user@tm.db.host:5432/cft_task_db',
        dbReaderUsername: 'DTS JIT Access wa DB Reader SC',
      })
    ).rejects.toThrow('preflight failed');

    expect(queryMock).not.toHaveBeenCalledWith('ROLLBACK');
    expect(endMock).toHaveBeenCalledTimes(1);
  });

  test('fails when the preflight query returns no permissions result', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const { bootstrapTmSchemaPermissions } = loadBootstrapTmSchemaPermissionsModule();

    await expect(
      bootstrapTmSchemaPermissions({
        connectionString: 'postgresql://bootstrap-user@tm.db.host:5432/cft_task_db',
        dbReaderUsername: 'DTS JIT Access wa DB Reader SC',
      })
    ).rejects.toThrow('TM schema permissions preflight did not return a permissions result');

    expect(queryMock).not.toHaveBeenCalledWith('ROLLBACK');
    expect(endMock).toHaveBeenCalledTimes(1);
  });

  test('rejects unexpected physical partition names and rolls back the repair transaction', async () => {
    const unexpectedPartition: PreflightRow = {
      ...currentPermissions,
      tables_without_select: ['snapshot_state_p_42'],
    };
    mockPreflightRows(unexpectedPartition, unexpectedPartition);
    const { bootstrapTmSchemaPermissions } = loadBootstrapTmSchemaPermissionsModule();

    await expect(
      bootstrapTmSchemaPermissions({
        connectionString: 'postgresql://bootstrap-user@tm.db.host:5432/cft_task_db',
        dbReaderUsername: 'DTS JIT Access wa DB Reader SC',
      })
    ).rejects.toThrow('TM schema permissions preflight returned unexpected analytics tables: snapshot_state_p_42');

    expect(queryMock).toHaveBeenLastCalledWith('ROLLBACK');
    expect(queryMock.mock.calls.some(([sql]) => String(sql).startsWith('GRANT SELECT'))).toBe(false);
  });

  test('rolls back and warns when a grant fails and the rollback also fails', async () => {
    const logger = { info: jest.fn(), warn: jest.fn() };
    const { bootstrapTmSchemaPermissions } = loadBootstrapTmSchemaPermissionsModule();
    const grantError = new Error('grant failed');
    const rollbackError = new Error('rollback failed');
    const missingPermissions: PreflightRow = {
      has_schema_usage: false,
      missing_tables: [],
      tables_without_select: ['snapshot_state'],
    };
    queryMock.mockImplementation((sql: string) => {
      if (isPreflightQuery(sql)) {
        return Promise.resolve(preflightResult(missingPermissions));
      }
      if (sql.startsWith('GRANT USAGE ON SCHEMA')) {
        return Promise.reject(grantError);
      }
      if (sql === 'ROLLBACK') {
        return Promise.reject(rollbackError);
      }

      return Promise.resolve(undefined);
    });

    await expect(
      bootstrapTmSchemaPermissions(
        {
          connectionString: 'postgresql://bootstrap-user:s3cret@tm.db.host:5432/cft_task_db?sslmode=require',
          dbReaderUsername: 'Reader "SC"',
        },
        { logger }
      )
    ).rejects.toThrow('grant failed');

    expect(queryMock).toHaveBeenNthCalledWith(2, 'BEGIN');
    expect(queryMock).toHaveBeenNthCalledWith(3, "SET LOCAL lock_timeout = '30min'");
    expect(queryMock).toHaveBeenNthCalledWith(4, 'SELECT pg_advisory_xact_lock(hashtext($1))', [
      'analytics_run_snapshot_refresh_batch_lock',
    ]);
    expect(queryMock).toHaveBeenNthCalledWith(5, 'SELECT pg_advisory_xact_lock($1, $2)', [0x746d, 0x7065726d]);
    expect(queryMock).toHaveBeenNthCalledWith(7, 'GRANT USAGE ON SCHEMA "analytics" TO "Reader ""SC"""');
    expect(queryMock).toHaveBeenNthCalledWith(8, 'ROLLBACK');
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to roll back TM schema permissions bootstrap transaction',
      rollbackError
    );
    expect(endMock).toHaveBeenCalledTimes(1);
  });
});
