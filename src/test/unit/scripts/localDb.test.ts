import fs from 'fs';

type LocalDbConfig = {
  host: string;
  port: string;
  user: string;
  password: string;
  adminDatabase: string;
  databases: {
    tm: string;
    crd: string;
    lrd: string;
  };
  seed: {
    recordCount: number;
    randomSeed: number;
  };
  rootDir: string;
};

type QueryResult = {
  rows: Record<string, unknown>[];
};

type QueryEvent = {
  connectionString: string;
  sql: string;
  params: unknown[];
};

type ReportableTaskSeedRow = {
  taskId: string;
  taskName: string;
  jurisdictionLabel: string;
  caseTypeId: string;
  roleCategoryLabel: string;
  region: string;
  location: string;
  state: string;
  terminationReason: string | null;
  workType: string;
  dueOffset: number;
  completedOffset: number | null;
  assignee: string | null;
  waitTimeDays: number | null;
  isWithinSla: string | null;
};

type ClientLike = {
  connect: () => Promise<void>;
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>;
  end: () => Promise<void>;
};

type ClientConstructor = new (config: { connectionString: string }) => ClientLike;

type LocalDbScriptModule = {
  DEFAULT_ADMIN_DATABASE: string;
  DEFAULT_CRD_DATABASE: string;
  DEFAULT_HOST: string;
  DEFAULT_LRD_DATABASE: string;
  DEFAULT_PASSWORD: string;
  DEFAULT_PORT: string;
  DEFAULT_SEED_RANDOM_SEED: number;
  DEFAULT_SEED_RECORD_COUNT: number;
  DEFAULT_TM_DATABASE: string;
  DEFAULT_USER: string;
  MIN_SEED_RECORD_COUNT: number;
  buildConnectionString: (config: LocalDbConfig, database: string) => string;
  buildFlywayArgs: (config: LocalDbConfig, task?: string) => string[];
  buildFlywayJdbcUrl: (config: LocalDbConfig) => string;
  generateReportableTasks: (recordCount: number, randomSeed: number) => ReportableTaskSeedRow[];
  localDbFiles: {
    crdReferenceData: string;
    lrdReferenceData: string;
  };
  migrateLocalDatabase: (
    config?: LocalDbConfig,
    dependencies?: {
      runCommand?: jest.Mock;
      logger?: { info: jest.Mock };
    }
  ) => void;
  rebuildLocalDatabase: (
    config?: LocalDbConfig,
    dependencies?: {
      ClientCtor?: ClientConstructor;
      fileSystem?: { readFileSync: jest.Mock };
      runCommand?: jest.Mock;
      logger?: { info: jest.Mock };
      reportableTaskRows?: ReportableTaskSeedRow[];
      batchSize?: number;
    }
  ) => Promise<void>;
  refreshLocalDatabase: (
    config?: LocalDbConfig,
    dependencies?: {
      ClientCtor?: ClientConstructor;
      logger?: { info: jest.Mock };
    }
  ) => Promise<void>;
  resetLocalDatabases: (
    config?: LocalDbConfig,
    dependencies?: {
      ClientCtor?: ClientConstructor;
      fileSystem?: { readFileSync: jest.Mock };
      logger?: { info: jest.Mock };
    }
  ) => Promise<void>;
  resolveLocalDbConfig: (env?: Record<string, string | undefined>) => LocalDbConfig;
  seedReportableTasks: (
    config?: LocalDbConfig,
    dependencies?: {
      ClientCtor?: ClientConstructor;
      logger?: { info: jest.Mock };
      reportableTaskRows?: ReportableTaskSeedRow[];
      batchSize?: number;
    }
  ) => Promise<void>;
  syncLocalLocationReferenceData: (
    config?: LocalDbConfig,
    dependencies?: {
      ClientCtor?: ClientConstructor;
      logger?: { info: jest.Mock };
    }
  ) => Promise<void>;
  validateLocalDatabase: (
    config?: LocalDbConfig,
    dependencies?: {
      ClientCtor?: ClientConstructor;
      logger?: { info: jest.Mock };
    }
  ) => Promise<void>;
};

const loadLocalDbModule = (): LocalDbScriptModule => {
  let moduleExports: LocalDbScriptModule | undefined;

  jest.isolateModules(() => {
    moduleExports = require('../../../../scripts/local-db.js');
  });

  return moduleExports!;
};

const defaultQueryHandler = (sql: string): QueryResult => {
  if (sql.includes('published_snapshot_id AS snapshot_id')) {
    return { rows: [{ snapshot_id: 42 }] };
  }

  if (sql.includes('information_schema.tables')) {
    return { rows: [] };
  }

  if (sql.includes('FROM locrefdata.court_venue cv')) {
    return { rows: [] };
  }

  return { rows: [{ rows: 1 }] };
};

const createClientConstructor = (
  events: QueryEvent[] = [],
  queryHandler: (sql: string, params: unknown[]) => QueryResult = defaultQueryHandler
): ClientConstructor =>
  class FakeClient implements ClientLike {
    constructor(private readonly config: { connectionString: string }) {}

    async connect(): Promise<void> {
      return Promise.resolve();
    }

    async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
      events.push({ connectionString: this.config.connectionString, sql, params });
      return queryHandler(sql, params);
    }

    async end(): Promise<void> {
      return Promise.resolve();
    }
  };

const findQueryIndex = (events: QueryEvent[], predicate: (event: QueryEvent) => boolean): number =>
  events.findIndex(predicate);

const buildFileSystemStub = () => ({
  readFileSync: jest.fn((filePath: string) => `-- ${filePath.split('/').pop()}`),
});

const countValues = (values: string[]): Map<string, number> =>
  values.reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1), new Map<string, number>());

const sortedCounts = (values: string[]): number[] =>
  [...countValues(values).values()].sort((left, right) => right - left);

const scenarioKey = (row: ReportableTaskSeedRow): string => {
  if (row.terminationReason === 'deleted') {
    return 'deleted_cancelled';
  }

  if (row.terminationReason === 'completed') {
    return row.isWithinSla === 'Yes' ? 'completed_within_sla' : 'completed_beyond_sla';
  }

  if (row.state === 'PENDING AUTO ASSIGN') {
    return 'pending_auto_assign';
  }

  const dueWindow = row.dueOffset < 0 ? 'overdue' : row.dueOffset <= 5 ? 'due_soon' : 'due_later';
  return `${row.state.toLowerCase()}_${dueWindow}`;
};

describe('local database script', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test('resolves default local database config, seed config, and Flyway connection details', () => {
    const {
      DEFAULT_ADMIN_DATABASE,
      DEFAULT_CRD_DATABASE,
      DEFAULT_HOST,
      DEFAULT_LRD_DATABASE,
      DEFAULT_PASSWORD,
      DEFAULT_PORT,
      DEFAULT_SEED_RANDOM_SEED,
      DEFAULT_SEED_RECORD_COUNT,
      DEFAULT_TM_DATABASE,
      DEFAULT_USER,
      buildConnectionString,
      buildFlywayArgs,
      buildFlywayJdbcUrl,
      resolveLocalDbConfig,
    } = loadLocalDbModule();

    const config = resolveLocalDbConfig({});

    expect(DEFAULT_SEED_RECORD_COUNT).toBe(500000);
    expect(config).toMatchObject({
      host: DEFAULT_HOST,
      port: DEFAULT_PORT,
      user: DEFAULT_USER,
      password: DEFAULT_PASSWORD,
      adminDatabase: DEFAULT_ADMIN_DATABASE,
      databases: {
        tm: DEFAULT_TM_DATABASE,
        crd: DEFAULT_CRD_DATABASE,
        lrd: DEFAULT_LRD_DATABASE,
      },
      seed: {
        recordCount: DEFAULT_SEED_RECORD_COUNT,
        randomSeed: DEFAULT_SEED_RANDOM_SEED,
      },
    });
    expect(buildConnectionString(config, config.databases.tm)).toBe(
      'postgresql://postgres:password@localhost:5432/cft_task_db'
    );
    expect(buildFlywayJdbcUrl(config)).toBe('jdbc:postgresql://localhost:5432/cft_task_db');
    expect(buildFlywayArgs(config)).toEqual([
      '-Dflyway.url=jdbc:postgresql://localhost:5432/cft_task_db',
      '-Dflyway.user=postgres',
      '-Dflyway.password=password',
      'flywayMigrate',
    ]);
  });

  test('refuses reset commands for non-local hosts before connecting', async () => {
    const { resetLocalDatabases, resolveLocalDbConfig } = loadLocalDbModule();
    const events: QueryEvent[] = [];
    const config = resolveLocalDbConfig({ LOCAL_DB_HOST: 'analytics.example.com' });

    await expect(
      resetLocalDatabases(config, {
        ClientCtor: createClientConstructor(events),
        fileSystem: buildFileSystemStub(),
        logger: { info: jest.fn() },
      })
    ).rejects.toThrow('Refusing to run local database mutation against non-local host: analytics.example.com');

    expect(events).toHaveLength(0);
  });

  test('rejects generated seed record counts below the minimum before connecting', async () => {
    const { MIN_SEED_RECORD_COUNT, resolveLocalDbConfig, seedReportableTasks } = loadLocalDbModule();
    const events: QueryEvent[] = [];
    const config = resolveLocalDbConfig({
      LOCAL_DB_SEED_RECORD_COUNT: String(MIN_SEED_RECORD_COUNT - 1),
    });

    await expect(
      seedReportableTasks(config, {
        ClientCtor: createClientConstructor(events),
        logger: { info: jest.fn() },
      })
    ).rejects.toThrow(`LOCAL_DB_SEED_RECORD_COUNT must be at least ${MIN_SEED_RECORD_COUNT}`);

    expect(events).toHaveLength(0);
  });

  test('generates deterministic weighted source task rows with valid local dimensions and scenarios', () => {
    const { generateReportableTasks } = loadLocalDbModule();

    const rows = generateReportableTasks(5000, 12345);
    const repeatedRows = generateReportableTasks(5000, 12345);
    const assignees = rows.flatMap(row => (row.assignee ? [row.assignee] : []));
    const scenarios = new Set(rows.map(scenarioKey));

    expect(repeatedRows).toEqual(rows);
    expect(rows.every(row => /^Service (0[1-9]|10)$/.test(row.jurisdictionLabel))).toBe(true);
    expect(rows.every(row => /^Service (0[1-9]|10)$/.test(row.caseTypeId))).toBe(true);
    expect(rows.every(row => /^work_type_0[1-5]$/.test(row.workType))).toBe(true);
    expect(rows.every(row => /^[1-8]$/.test(row.region))).toBe(true);
    expect(rows.every(row => /^(10(0[1-9]|[1-9][0-9])|1100)$/.test(row.location))).toBe(true);
    expect(
      rows.every(row =>
        ['Admin', 'Casework', 'Judicial', 'Legal Operations', 'Tribunal Caseworker'].includes(row.roleCategoryLabel)
      )
    ).toBe(true);
    expect(rows.every(row => /^Generated task ([0-4][0-9][0-9]|500)$/.test(row.taskName))).toBe(true);
    expect(assignees.every(assignee => /^(cw-0[0-4][0-9]{3}|cw-05000)$/.test(assignee))).toBe(true);
    expect(rows.some(row => row.state === 'ASSIGNED' && row.waitTimeDays !== null)).toBe(true);
    expect(rows.some(row => row.state === 'UNASSIGNED')).toBe(true);
    expect(rows.some(row => row.state === 'PENDING AUTO ASSIGN')).toBe(true);
    expect(rows.some(row => row.dueOffset < 0 && row.state !== 'COMPLETED')).toBe(true);
    expect(rows.some(row => row.dueOffset > 0 && row.dueOffset <= 5)).toBe(true);
    expect(rows.some(row => row.dueOffset >= 14)).toBe(true);
    expect(rows.some(row => row.terminationReason === 'completed' && row.isWithinSla === 'Yes')).toBe(true);
    expect(rows.some(row => row.terminationReason === 'completed' && row.isWithinSla === 'No')).toBe(true);
    expect(rows.some(row => row.terminationReason === 'deleted' && row.state === 'TERMINATED')).toBe(true);
    expect(scenarios).toEqual(
      new Set([
        'assigned_due_later',
        'assigned_due_soon',
        'assigned_overdue',
        'unassigned_due_soon',
        'unassigned_overdue',
        'pending_auto_assign',
        'completed_within_sla',
        'completed_beyond_sla',
        'deleted_cancelled',
      ])
    );
  });

  test('changes generated source task data when the random seed changes', () => {
    const { generateReportableTasks } = loadLocalDbModule();
    const dimensionSignature = (row: ReportableTaskSeedRow) =>
      [
        row.jurisdictionLabel,
        row.region,
        row.location,
        row.roleCategoryLabel,
        row.workType,
        row.taskName,
        row.state,
      ].join('|');

    expect(generateReportableTasks(20, 12345).map(dimensionSignature)).not.toEqual(
      generateReportableTasks(20, 54321).map(dimensionSignature)
    );
  });

  test('generates uneven weighted distributions for local seed dimensions', () => {
    const { generateReportableTasks } = loadLocalDbModule();
    const rows = generateReportableTasks(10000, 12345);
    const assignees = rows.flatMap(row => (row.assignee ? [row.assignee] : []));
    const serviceCounts = sortedCounts(rows.map(row => row.jurisdictionLabel));
    const locationCounts = sortedCounts(rows.map(row => row.location));
    const workTypeCounts = sortedCounts(rows.map(row => row.workType));
    const taskNameCounts = sortedCounts(rows.map(row => row.taskName));
    const assigneeCounts = sortedCounts(assignees);
    const scenarioCounts = sortedCounts(rows.map(scenarioKey));
    const activeRows = rows.filter(row => !row.terminationReason).length;
    const completedRows = rows.filter(row => row.terminationReason === 'completed').length;
    const deletedRows = rows.filter(row => row.terminationReason === 'deleted').length;

    expect(serviceCounts[0]).toBeGreaterThan(serviceCounts[serviceCounts.length - 1] * 4);
    expect(locationCounts[0]).toBeGreaterThan(locationCounts[locationCounts.length - 1] * 8);
    expect(workTypeCounts[0]).toBeGreaterThan(workTypeCounts[workTypeCounts.length - 1] * 3);
    expect(taskNameCounts[0]).toBeGreaterThan(taskNameCounts[taskNameCounts.length - 1] * 20);
    expect(assigneeCounts[0]).toBeGreaterThan(assigneeCounts[assigneeCounts.length - 1] * 50);
    expect(scenarioCounts[0]).toBeGreaterThan(scenarioCounts[scenarioCounts.length - 1] * 4);
    expect(activeRows).toBeGreaterThan(completedRows);
    expect(completedRows).toBeGreaterThan(deletedRows);
  });

  test('seeds CRD reference data with 5000 generated caseworker profiles', () => {
    const { localDbFiles } = loadLocalDbModule();
    const sql = fs.readFileSync(localDbFiles.crdReferenceData, 'utf8');

    expect(sql).toContain("format('cw-%s', lpad(value::TEXT, 5, '0'))");
    expect(sql).toContain("format('caseworker.%s@example.test', lpad(value::TEXT, 5, '0'))");
    expect(sql).toContain('(((value - 1) % 8) + 1)::INTEGER AS region_id');
    expect(sql).toContain('FROM generate_series(1, 5000) AS profiles(value)');
  });

  test('seeds LRD court venue association data for local location lookup sync', () => {
    const { localDbFiles } = loadLocalDbModule();
    const sql = fs.readFileSync(localDbFiles.lrdReferenceData, 'utf8');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS locrefdata.court_type_service_assoc');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS locrefdata.service_to_ccd_case_type_assoc');
    expect(sql).toContain('court_type_id');
    expect(sql).toContain("format('Service %s', lpad(value::TEXT, 2, '0')) AS ccd_case_type");
    expect(sql).toContain("'local_court' AS court_type_id");
  });

  test('truncates and inserts generated source task rows in deterministic batches', async () => {
    const { generateReportableTasks, resolveLocalDbConfig, seedReportableTasks } = loadLocalDbModule();
    const events: QueryEvent[] = [];
    const config = resolveLocalDbConfig({});
    const rows = generateReportableTasks(20, 12345);

    await seedReportableTasks(config, {
      ClientCtor: createClientConstructor(events),
      logger: { info: jest.fn() },
      reportableTaskRows: rows,
      batchSize: 8,
    });

    const truncateIndex = findQueryIndex(events, event => event.sql === 'TRUNCATE cft_task_db.reportable_task');
    const insertEvents = events.filter(event => event.sql.includes('INSERT INTO cft_task_db.reportable_task'));

    expect(truncateIndex).toBe(0);
    expect(insertEvents).toHaveLength(3);
    expect(insertEvents.map(event => event.params.length)).toEqual([216, 216, 108]);
    expect(insertEvents[0].params[0]).toBe(rows[0].taskId);
    expect(insertEvents[1].params[0]).toBe(rows[8].taskId);
    expect(insertEvents[2].params[0]).toBe(rows[16].taskId);
  });

  test('runs the local refresh procedure as a standalone diagnostic step', async () => {
    const { refreshLocalDatabase, resolveLocalDbConfig } = loadLocalDbModule();
    const events: QueryEvent[] = [];

    await refreshLocalDatabase(resolveLocalDbConfig({}), {
      ClientCtor: createClientConstructor(events),
      logger: { info: jest.fn() },
    });

    const syncStateIndex = findQueryIndex(events, event =>
      event.sql.includes('INSERT INTO analytics.location_reference_sync_state')
    );
    const refreshIndex = findQueryIndex(events, event => event.sql === 'CALL analytics.run_snapshot_refresh_batch()');

    expect(syncStateIndex).toBeGreaterThanOrEqual(0);
    expect(refreshIndex).toBeGreaterThan(syncStateIndex);
  });

  test('syncs local location lookup rows before snapshot refresh can use them', async () => {
    const { resolveLocalDbConfig, syncLocalLocationReferenceData } = loadLocalDbModule();
    const events: QueryEvent[] = [];

    await syncLocalLocationReferenceData(resolveLocalDbConfig({}), {
      ClientCtor: createClientConstructor(events, sql => {
        if (sql.includes('information_schema.tables')) {
          return {
            rows: [{ table_name: 'court_type_service_assoc' }, { table_name: 'service_to_ccd_case_type_assoc' }],
          };
        }

        if (sql.includes('service_to_ccd_case_type_assoc assoc')) {
          return {
            rows: [
              {
                epimms_id: '100',
                ccd_case_type: 'CivilCaseType',
                service_code: 'AAA',
                court_type_id: 'civil',
                site_name: 'Leeds Crown Court',
                region_id: '1',
              },
            ],
          };
        }

        if (sql.includes('FROM locrefdata.court_venue cv')) {
          return {
            rows: [{ epimms_id: '200', site_name: 'York Crown Court', region_id: '2' }],
          };
        }

        return { rows: [{ rows: 1 }] };
      }),
      logger: { info: jest.fn() },
    });

    const caseTypeInsert = events.find(event =>
      event.sql.includes('INSERT INTO analytics.court_venue_case_type_lookup')
    );
    const epimmsInsert = events.find(event => event.sql.includes('INSERT INTO analytics.court_venue_epimms_lookup'));
    const syncStateUpsert = events.find(event =>
      event.sql.includes('INSERT INTO analytics.location_reference_sync_state')
    );

    expect(caseTypeInsert?.params).toEqual(['100', 'CivilCaseType', 'AAA', 'civil', 'Leeds Crown Court', '1']);
    expect(epimmsInsert?.params).toEqual(['200', 'York Crown Court', '2']);
    expect(syncStateUpsert?.params).toEqual([1, 1]);
  });

  test('validates the dynamically published snapshot rather than hard-coding snapshot 1', async () => {
    const { resolveLocalDbConfig, validateLocalDatabase } = loadLocalDbModule();
    const events: QueryEvent[] = [];
    const publishedSnapshotId = 73;

    await validateLocalDatabase(resolveLocalDbConfig({}), {
      ClientCtor: createClientConstructor(events, sql => {
        if (sql.includes('published_snapshot_id AS snapshot_id')) {
          return { rows: [{ snapshot_id: publishedSnapshotId }] };
        }

        return { rows: [{ rows: 1 }] };
      }),
      logger: { info: jest.fn() },
    });

    const tmEvents = events.filter(event => event.connectionString.endsWith('/cft_task_db'));

    expect(tmEvents[0].sql).toContain('published_snapshot_id AS snapshot_id');
    expect(tmEvents.slice(1).map(event => event.params[0])).toEqual([
      publishedSnapshotId,
      publishedSnapshotId,
      publishedSnapshotId,
      publishedSnapshotId,
      publishedSnapshotId,
    ]);
    expect(tmEvents.slice(1).every(event => !event.sql.includes('snapshot_id = 1'))).toBe(true);
  });

  test('runs rebuild in reset, Flyway, reference seed, source generation, refresh, then validate order', async () => {
    const { generateReportableTasks, rebuildLocalDatabase, resolveLocalDbConfig } = loadLocalDbModule();
    const events: QueryEvent[] = [];
    const commandEvents: string[] = [];
    const config = resolveLocalDbConfig({});
    const runCommand = jest.fn((_command: string, args: string[]) => {
      commandEvents.push(args[args.length - 1]);
      return { status: 0 };
    });

    await rebuildLocalDatabase(config, {
      ClientCtor: createClientConstructor(events),
      fileSystem: buildFileSystemStub(),
      runCommand,
      logger: { info: jest.fn() },
      reportableTaskRows: generateReportableTasks(20, 12345),
      batchSize: 20,
    });

    const dropTmDatabaseIndex = findQueryIndex(
      events,
      event => event.sql === 'DROP DATABASE IF EXISTS "cft_task_db" WITH (FORCE)'
    );
    const preFlywayIndex = findQueryIndex(events, event => event.sql === '-- tm-pre-flyway-source.sql');
    const tmReferenceSeedIndex = findQueryIndex(events, event => event.sql === '-- tm-reference-data.sql');
    const crdSeedIndex = findQueryIndex(events, event => event.sql === '-- crd-reference-data.sql');
    const lrdSeedIndex = findQueryIndex(events, event => event.sql === '-- lrd-reference-data.sql');
    const truncateSourceIndex = findQueryIndex(events, event => event.sql === 'TRUNCATE cft_task_db.reportable_task');
    const insertSourceIndex = findQueryIndex(events, event =>
      event.sql.includes('INSERT INTO cft_task_db.reportable_task')
    );
    const locationSyncIndex = findQueryIndex(
      events,
      event => event.sql === 'DELETE FROM analytics.court_venue_case_type_lookup'
    );
    const refreshIndex = findQueryIndex(events, event => event.sql === 'CALL analytics.run_snapshot_refresh_batch()');
    const validationIndex = findQueryIndex(events, event => event.sql.includes('published_snapshot_id AS snapshot_id'));

    expect(dropTmDatabaseIndex).toBeGreaterThanOrEqual(0);
    expect(preFlywayIndex).toBeGreaterThan(dropTmDatabaseIndex);
    expect(commandEvents).toEqual(['flywayMigrate']);
    expect(tmReferenceSeedIndex).toBeGreaterThan(preFlywayIndex);
    expect(crdSeedIndex).toBeGreaterThan(tmReferenceSeedIndex);
    expect(lrdSeedIndex).toBeGreaterThan(crdSeedIndex);
    expect(truncateSourceIndex).toBeGreaterThan(lrdSeedIndex);
    expect(insertSourceIndex).toBeGreaterThan(truncateSourceIndex);
    expect(locationSyncIndex).toBeGreaterThan(insertSourceIndex);
    expect(refreshIndex).toBeGreaterThan(locationSyncIndex);
    expect(validationIndex).toBeGreaterThan(refreshIndex);
  });

  test('invokes the Flyway wrapper with local TM database arguments', () => {
    const { migrateLocalDatabase, resolveLocalDbConfig } = loadLocalDbModule();
    const runCommand = jest.fn().mockReturnValue({ status: 0 });
    const config = resolveLocalDbConfig({ LOCAL_DB_PORT: '5544' });

    migrateLocalDatabase(config, {
      runCommand,
      logger: { info: jest.fn() },
    });

    expect(String(runCommand.mock.calls[0][0])).toContain('/db/flyway/gradlew');
    expect(runCommand.mock.calls[0][1]).toEqual([
      '-Dflyway.url=jdbc:postgresql://localhost:5544/cft_task_db',
      '-Dflyway.user=postgres',
      '-Dflyway.password=password',
      'flywayMigrate',
    ]);
    expect(runCommand.mock.calls[0][2]).toMatchObject({
      cwd: expect.stringContaining('/db/flyway'),
      stdio: 'inherit',
    });
  });
});
