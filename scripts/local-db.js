const { Client, escapeIdentifier } = require('pg');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const LOCAL_DB_FILES_DIR = path.join(ROOT_DIR, 'db', 'local');
const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = '5432';
const DEFAULT_USER = 'postgres';
const DEFAULT_PASSWORD = 'password';
const DEFAULT_ADMIN_DATABASE = 'postgres';
const DEFAULT_TM_DATABASE = 'cft_task_db';
const DEFAULT_CRD_DATABASE = 'dbrdcaseworker';
const DEFAULT_LRD_DATABASE = 'dbrdlocationref';
const DEFAULT_SEED_RECORD_COUNT = 500000;
const DEFAULT_SEED_RANDOM_SEED = 12345;
const MIN_SEED_RECORD_COUNT = 20;
const REPORTABLE_TASK_INSERT_BATCH_SIZE = 2000;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const localDbFiles = {
  tmPreFlyway: path.join(LOCAL_DB_FILES_DIR, 'tm-pre-flyway-source.sql'),
  tmReferenceData: path.join(LOCAL_DB_FILES_DIR, 'tm-reference-data.sql'),
  crdReferenceData: path.join(LOCAL_DB_FILES_DIR, 'crd-reference-data.sql'),
  lrdReferenceData: path.join(LOCAL_DB_FILES_DIR, 'lrd-reference-data.sql'),
};

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

const parseIntegerConfig = (env, key, defaultValue) => {
  const rawValue = env[key];
  if (rawValue === undefined || rawValue === '') {
    return defaultValue;
  }

  const value = Number(String(rawValue).trim());
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${key} must be an integer`);
  }

  return value;
};

const resolveLocalDbConfig = (env = process.env) => ({
  host: env.LOCAL_DB_HOST || DEFAULT_HOST,
  port: env.LOCAL_DB_PORT || DEFAULT_PORT,
  user: env.LOCAL_DB_USER || DEFAULT_USER,
  password: env.LOCAL_DB_PASSWORD === undefined ? DEFAULT_PASSWORD : env.LOCAL_DB_PASSWORD,
  adminDatabase: env.LOCAL_DB_ADMIN_DATABASE || DEFAULT_ADMIN_DATABASE,
  databases: {
    tm: env.LOCAL_DB_TM_DATABASE || DEFAULT_TM_DATABASE,
    crd: env.LOCAL_DB_CRD_DATABASE || DEFAULT_CRD_DATABASE,
    lrd: env.LOCAL_DB_LRD_DATABASE || DEFAULT_LRD_DATABASE,
  },
  seed: {
    recordCount: parseIntegerConfig(env, 'LOCAL_DB_SEED_RECORD_COUNT', DEFAULT_SEED_RECORD_COUNT),
    randomSeed: parseIntegerConfig(env, 'LOCAL_DB_SEED_RANDOM_SEED', DEFAULT_SEED_RANDOM_SEED),
  },
  rootDir: ROOT_DIR,
});

const assertLocalHost = host => {
  if (!LOCAL_HOSTS.has(String(host).trim().toLowerCase())) {
    throw new Error(`Refusing to run local database mutation against non-local host: ${host}`);
  }
};

const buildConnectionString = (config, database) => {
  const user = encodeURIComponent(config.user);
  const auth = config.password ? `${user}:${encodeURIComponent(config.password)}` : user;
  return `postgresql://${auth}@${config.host}:${config.port}/${database}`;
};

const buildFlywayJdbcUrl = config => `jdbc:postgresql://${config.host}:${config.port}/${config.databases.tm}`;

const buildFlywayArgs = (config, task = 'flywayMigrate') => [
  `-Dflyway.url=${buildFlywayJdbcUrl(config)}`,
  `-Dflyway.user=${config.user}`,
  `-Dflyway.password=${config.password}`,
  task,
];

const createClient = (config, database, ClientCtor = Client) =>
  new ClientCtor({ connectionString: buildConnectionString(config, database) });

const assertSeedConfig = seedConfig => {
  if (seedConfig.recordCount < MIN_SEED_RECORD_COUNT) {
    throw new Error(`LOCAL_DB_SEED_RECORD_COUNT must be at least ${MIN_SEED_RECORD_COUNT}`);
  }
};

const createSeededRandom = randomSeed => {
  let state = randomSeed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const randomInt = (random, min, max) => Math.floor(random() * (max - min + 1)) + min;
const padNumber = (value, length = 2) => String(value).padStart(length, '0');

const shuffleValues = (values, random) => {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(random, 0, index);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
};

const createWeightedSelector = entries => {
  let totalWeight = 0;
  const cumulativeEntries = entries.map(entry => {
    totalWeight += entry.weight;
    return {
      value: entry.value,
      cumulativeWeight: totalWeight,
    };
  });

  return {
    entries: cumulativeEntries,
    totalWeight,
  };
};

const selectWeighted = (selector, random) => {
  const threshold = random() * selector.totalWeight;
  return selector.entries.find(candidate => threshold < candidate.cumulativeWeight).value;
};

const createRankWeightedSelector = (values, weights, random) =>
  createWeightedSelector(
    shuffleValues(values, random).map((value, index) => ({
      value,
      weight: weights[index],
    }))
  );

const createPopularityWeights = (count, exponent) =>
  Array.from({ length: count }, (_value, index) => 1 / Math.pow(index + 1, exponent));

const createPopularityWeightedSelector = (values, exponent, random) =>
  createRankWeightedSelector(values, createPopularityWeights(values.length, exponent), random);

const services = Array.from({ length: 10 }, (_value, index) => {
  const label = `Service ${padNumber(index + 1)}`;
  return { jurisdictionLabel: label, caseTypeId: label, caseTypeLabel: label };
});

const locations = Array.from({ length: 100 }, (_value, index) => ({
  region: String((index % 8) + 1),
  location: String(1001 + index),
}));

const regionIds = Array.from({ length: 8 }, (_value, index) => String(index + 1));
const workTypes = Array.from({ length: 5 }, (_value, index) => `work_type_${padNumber(index + 1)}`);
const assignees = Array.from({ length: 5000 }, (_value, index) => `cw-${padNumber(index + 1, 5)}`);
const taskNames = Array.from({ length: 500 }, (_value, index) => `Generated task ${padNumber(index + 1, 3)}`);
const priorities = [1500, 3500, 4500, 6000];
const serviceWeights = [24, 18, 14, 11, 9, 8, 6, 5, 3, 2];
const regionWeights = [28, 20, 15, 11, 9, 7, 6, 4];
const workTypeWeights = [35, 25, 18, 14, 8];
const priorityWeights = [45, 30, 20, 5];
const assigneePopularityExponent = 0.75;
const locationPopularityExponent = 0.5;
const taskNamePopularityExponent = 0.65;
const roleCategoryWeights = [
  { value: 'Casework', weight: 35 },
  { value: 'Admin', weight: 30 },
  { value: 'Legal Operations', weight: 15 },
  { value: 'Tribunal Caseworker', weight: 12 },
  { value: 'Judicial', weight: 8 },
];
const scenarioWeights = [
  { value: 'assigned_due_later', weight: 22 },
  { value: 'assigned_due_soon', weight: 16 },
  { value: 'assigned_overdue', weight: 12 },
  { value: 'unassigned_due_soon', weight: 14 },
  { value: 'unassigned_overdue', weight: 10 },
  { value: 'pending_auto_assign', weight: 8 },
  { value: 'completed_within_sla', weight: 10 },
  { value: 'completed_beyond_sla', weight: 5 },
  { value: 'deleted_cancelled', weight: 3 },
];

const createLocationSelectors = random =>
  new Map(
    regionIds.map(regionId => [
      regionId,
      createPopularityWeightedSelector(
        locations.filter(location => location.region === regionId),
        locationPopularityExponent,
        random
      ),
    ])
  );

const createSeedContext = random => ({
  assignees: createPopularityWeightedSelector(assignees, assigneePopularityExponent, random),
  locationsByRegion: createLocationSelectors(random),
  priorities: createRankWeightedSelector(priorities, priorityWeights, random),
  regions: createRankWeightedSelector(regionIds, regionWeights, random),
  roleCategories: createWeightedSelector(roleCategoryWeights),
  scenarios: createWeightedSelector(scenarioWeights),
  services: createRankWeightedSelector(services, serviceWeights, random),
  taskNames: createPopularityWeightedSelector(taskNames, taskNamePopularityExponent, random),
  workTypes: createRankWeightedSelector(workTypes, workTypeWeights, random),
});

const positiveDuration = (startOffset, endOffset) => Math.max(0.5, endOffset - startOffset);

const createBaseReportableTask = (index, random, seedContext) => {
  const region = selectWeighted(seedContext.regions, random);
  const service = selectWeighted(seedContext.services, random);
  const venue = selectWeighted(seedContext.locationsByRegion.get(region), random);
  const workType = selectWeighted(seedContext.workTypes, random);
  const taskName = selectWeighted(seedContext.taskNames, random);
  const roleCategoryLabel = selectWeighted(seedContext.roleCategories, random);

  return {
    taskId: `local-task-${String(index + 1).padStart(6, '0')}`,
    updateId: index + 1,
    taskName,
    jurisdictionLabel: service.jurisdictionLabel,
    caseTypeId: service.caseTypeId,
    caseTypeLabel: service.caseTypeLabel,
    roleCategoryLabel,
    caseId: `LOCAL-CASE-${String(index + 1).padStart(6, '0')}`,
    region: venue.region,
    location: venue.location,
    state: 'UNASSIGNED',
    terminationReason: null,
    terminationProcessLabel: null,
    outcome: null,
    workType,
    isWithinSla: null,
    createdOffset: -randomInt(random, 10, 60),
    dueOffset: randomInt(random, 1, 20),
    completedOffset: null,
    dueDateToCompletedDiffDays: null,
    firstAssignedOffset: null,
    majorPriority: selectWeighted(seedContext.priorities, random),
    assignee: null,
    waitTimeDays: null,
    handlingTimeDays: null,
    processingTimeDays: null,
    numberOfReassignments: randomInt(random, 0, 3),
  };
};

const selectAssignee = (random, seedContext) => selectWeighted(seedContext.assignees, random);

const applyAssignedScenario = (row, random, dueOffset, seedContext) => {
  const firstAssignedOffset = row.createdOffset + randomInt(random, 1, 4);

  return {
    ...row,
    state: 'ASSIGNED',
    dueOffset,
    firstAssignedOffset,
    assignee: selectAssignee(random, seedContext),
    waitTimeDays: positiveDuration(row.createdOffset, firstAssignedOffset),
  };
};

const applyCompletedScenario = (row, random, isWithinSla, seedContext) => {
  const createdOffset = -randomInt(random, 30, 90);
  const dueOffset = -randomInt(random, 5, 15);
  const completedOffset = isWithinSla ? dueOffset - randomInt(random, 0, 2) : dueOffset + randomInt(random, 1, 5);
  const firstAssignedOffset = createdOffset + randomInt(random, 1, 5);

  return {
    ...row,
    state: 'COMPLETED',
    terminationReason: 'completed',
    terminationProcessLabel: isWithinSla ? 'Auto completed' : 'Manual completion',
    outcome: isWithinSla ? 'Completed' : 'Order issued',
    isWithinSla: isWithinSla ? 'Yes' : 'No',
    createdOffset,
    dueOffset,
    completedOffset,
    dueDateToCompletedDiffDays: isWithinSla ? 0 : dueOffset - completedOffset,
    firstAssignedOffset,
    assignee: selectAssignee(random, seedContext),
    handlingTimeDays: positiveDuration(firstAssignedOffset, completedOffset),
    processingTimeDays: positiveDuration(createdOffset, completedOffset),
  };
};

const applyDeletedScenario = (row, random, seedContext) => {
  const createdOffset = -randomInt(random, 20, 70);
  const completedOffset = -randomInt(random, 1, 10);

  return {
    ...row,
    state: 'TERMINATED',
    terminationReason: 'deleted',
    terminationProcessLabel: 'Manual cancellation',
    outcome: 'Cancelled',
    createdOffset,
    dueOffset: -randomInt(random, 1, 14),
    completedOffset,
    firstAssignedOffset: createdOffset + randomInt(random, 1, 5),
    assignee: selectAssignee(random, seedContext),
    handlingTimeDays: positiveDuration(createdOffset, completedOffset),
    processingTimeDays: positiveDuration(createdOffset, completedOffset),
  };
};

const createReportableTask = (index, random, seedContext) => {
  const scenario = selectWeighted(seedContext.scenarios, random);
  const row = createBaseReportableTask(index, random, seedContext);

  switch (scenario) {
    case 'assigned_overdue':
      return applyAssignedScenario(row, random, -randomInt(random, 1, 10), seedContext);
    case 'assigned_due_soon':
      return applyAssignedScenario(row, random, randomInt(random, 1, 5), seedContext);
    case 'assigned_due_later':
      return applyAssignedScenario(row, random, randomInt(random, 14, 35), seedContext);
    case 'unassigned_overdue':
      return { ...row, state: 'UNASSIGNED', dueOffset: -randomInt(random, 1, 10) };
    case 'unassigned_due_soon':
      return { ...row, state: 'UNASSIGNED', dueOffset: randomInt(random, 1, 5) };
    case 'pending_auto_assign':
      return { ...row, state: 'PENDING AUTO ASSIGN', dueOffset: randomInt(random, 14, 35) };
    case 'completed_within_sla':
      return applyCompletedScenario(row, random, true, seedContext);
    case 'completed_beyond_sla':
      return applyCompletedScenario(row, random, false, seedContext);
    case 'deleted_cancelled':
      return applyDeletedScenario(row, random, seedContext);
    default:
      return row;
  }
};

const generateReportableTasks = (recordCount, randomSeed) => {
  const seedConfig = { recordCount, randomSeed };
  assertSeedConfig(seedConfig);
  const random = createSeededRandom(randomSeed);
  const seedContext = createSeedContext(random);

  return Array.from({ length: recordCount }, (_value, index) => createReportableTask(index, random, seedContext));
};

const reportableTaskValueFields = [
  'taskId',
  'updateId',
  'taskName',
  'jurisdictionLabel',
  'caseTypeId',
  'caseTypeLabel',
  'roleCategoryLabel',
  'caseId',
  'region',
  'location',
  'state',
  'terminationReason',
  'terminationProcessLabel',
  'outcome',
  'workType',
  'isWithinSla',
  'createdOffset',
  'dueOffset',
  'completedOffset',
  'dueDateToCompletedDiffDays',
  'firstAssignedOffset',
  'majorPriority',
  'assignee',
  'waitTimeDays',
  'handlingTimeDays',
  'processingTimeDays',
  'numberOfReassignments',
];

const buildReportableTaskInsertQuery = rows => {
  const params = [];
  let paramIndex = 1;
  const valuesSql = rows
    .map(row => {
      const placeholders = reportableTaskValueFields.map(field => {
        params.push(row[field]);
        const placeholder = `$${paramIndex}`;
        paramIndex += 1;
        return placeholder;
      });
      return `(${placeholders.join(', ')})`;
    })
    .join(',\n');

  return {
    params,
    sql: `
INSERT INTO cft_task_db.reportable_task (
  task_id,
  update_id,
  task_name,
  jurisdiction_label,
  case_type_id,
  case_type_label,
  role_category_label,
  case_id,
  region,
  location,
  state,
  termination_reason,
  termination_process_label,
  outcome,
  work_type,
  is_within_sla,
  created_date,
  due_date,
  completed_date,
  due_date_to_completed_diff_time,
  first_assigned_date,
  major_priority,
  assignee,
  wait_time_days,
  wait_time,
  handling_time_days,
  handling_time,
  processing_time_days,
  processing_time,
  number_of_reassignments
)
SELECT
  rows.task_id,
  rows.update_id::bigint,
  rows.task_name,
  rows.jurisdiction_label,
  rows.case_type_id,
  rows.case_type_label,
  rows.role_category_label,
  rows.case_id,
  rows.region,
  rows.location,
  rows.state,
  rows.termination_reason,
  rows.termination_process_label,
  rows.outcome,
  rows.work_type,
  rows.is_within_sla,
  CURRENT_DATE + rows.created_offset::integer,
  CURRENT_DATE + rows.due_offset::integer,
  CASE WHEN rows.completed_offset IS NULL THEN NULL ELSE CURRENT_DATE + rows.completed_offset::integer END,
  CASE
    WHEN rows.due_date_to_completed_diff_days IS NULL THEN NULL
    ELSE rows.due_date_to_completed_diff_days::double precision * INTERVAL '1 day'
  END,
  CASE WHEN rows.first_assigned_offset IS NULL THEN NULL ELSE CURRENT_DATE + rows.first_assigned_offset::integer END,
  rows.major_priority::integer,
  rows.assignee,
  rows.wait_time_days::double precision,
  CASE WHEN rows.wait_time_days IS NULL THEN NULL ELSE rows.wait_time_days::double precision * INTERVAL '1 day' END,
  rows.handling_time_days::double precision,
  CASE
    WHEN rows.handling_time_days IS NULL THEN NULL
    ELSE rows.handling_time_days::double precision * INTERVAL '1 day'
  END,
  rows.processing_time_days::double precision,
  CASE
    WHEN rows.processing_time_days IS NULL THEN NULL
    ELSE rows.processing_time_days::double precision * INTERVAL '1 day'
  END,
  rows.number_of_reassignments::integer
FROM (
  VALUES
${valuesSql}
) AS rows(
  task_id,
  update_id,
  task_name,
  jurisdiction_label,
  case_type_id,
  case_type_label,
  role_category_label,
  case_id,
  region,
  location,
  state,
  termination_reason,
  termination_process_label,
  outcome,
  work_type,
  is_within_sla,
  created_offset,
  due_offset,
  completed_offset,
  due_date_to_completed_diff_days,
  first_assigned_offset,
  major_priority,
  assignee,
  wait_time_days,
  handling_time_days,
  processing_time_days,
  number_of_reassignments
)`,
  };
};

const runExternalCommand = (command, args, options = {}, spawnSyncFn = spawnSync) => {
  const result = spawnSyncFn(command, args, {
    cwd: options.cwd || ROOT_DIR,
    env: options.env || process.env,
    stdio: options.stdio || 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }

  return result;
};

const runSqlFile = async (config, database, filePath, dependencies = {}) => {
  const { ClientCtor = Client, fileSystem = fs, logger = console } = dependencies;
  const sql = fileSystem.readFileSync(filePath, 'utf8');
  const client = createClient(config, database, ClientCtor);

  logger.info(`Applying ${path.relative(config.rootDir, filePath)} to ${database}`);
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
};

const waitForLocalDatabase = async (config = resolveLocalDbConfig(), dependencies = {}) => {
  assertLocalHost(config.host);
  const { ClientCtor = Client, delay = sleep, logger = console, retries = 30, retryIntervalMs = 1000 } = dependencies;

  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const client = createClient(config, config.adminDatabase, ClientCtor);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return;
    } catch (error) {
      lastError = error;
      try {
        await client.end();
      } catch {
        // Ignore cleanup failures while waiting for PostgreSQL to accept connections.
      }

      if (attempt < retries) {
        logger.info(`Waiting for local PostgreSQL to become ready (${attempt}/${retries})`);
        await delay(retryIntervalMs);
      }
    }
  }

  throw lastError;
};

const resetLocalDatabases = async (config = resolveLocalDbConfig(), dependencies = {}) => {
  assertLocalHost(config.host);
  await waitForLocalDatabase(config, dependencies);
  const { ClientCtor = Client, logger = console } = dependencies;
  const client = createClient(config, config.adminDatabase, ClientCtor);
  const databaseNames = [config.databases.tm, config.databases.crd, config.databases.lrd];

  await client.connect();
  try {
    for (const databaseName of databaseNames) {
      logger.info(`Recreating local database ${databaseName}`);
      await client.query(`DROP DATABASE IF EXISTS ${escapeIdentifier(databaseName)} WITH (FORCE)`);
      await client.query(`CREATE DATABASE ${escapeIdentifier(databaseName)} OWNER ${escapeIdentifier(config.user)}`);
    }
  } finally {
    await client.end();
  }

  await runSqlFile(config, config.databases.tm, localDbFiles.tmPreFlyway, dependencies);
};

const migrateLocalDatabase = (config = resolveLocalDbConfig(), dependencies = {}) => {
  assertLocalHost(config.host);
  const { runCommand = runExternalCommand, logger = console } = dependencies;
  const gradleWrapper = path.join(config.rootDir, 'db', 'flyway', 'gradlew');
  const args = buildFlywayArgs(config, 'flywayMigrate');

  logger.info('Running local TM Flyway migrations');
  runCommand(gradleWrapper, args, {
    cwd: path.join(config.rootDir, 'db', 'flyway'),
    env: process.env,
    stdio: 'inherit',
  });
};

const seedReportableTasks = async (config = resolveLocalDbConfig(), dependencies = {}) => {
  assertLocalHost(config.host);
  assertSeedConfig(config.seed);
  const {
    ClientCtor = Client,
    batchSize = REPORTABLE_TASK_INSERT_BATCH_SIZE,
    logger = console,
    reportableTaskRows,
  } = dependencies;
  const rowCount = reportableTaskRows?.length ?? config.seed.recordCount;
  const client = createClient(config, config.databases.tm, ClientCtor);

  logger.info(`Seeding ${rowCount} generated reportable tasks with seed ${config.seed.randomSeed}`);
  await client.connect();
  try {
    await client.query('TRUNCATE cft_task_db.reportable_task');
    if (reportableTaskRows) {
      for (let start = 0; start < reportableTaskRows.length; start += batchSize) {
        const batch = reportableTaskRows.slice(start, start + batchSize);
        const { sql, params } = buildReportableTaskInsertQuery(batch);
        await client.query(sql, params);
      }
      return;
    }

    const random = createSeededRandom(config.seed.randomSeed);
    const seedContext = createSeedContext(random);
    for (let start = 0; start < config.seed.recordCount; start += batchSize) {
      const batchLength = Math.min(batchSize, config.seed.recordCount - start);
      const batch = Array.from({ length: batchLength }, (_value, offset) =>
        createReportableTask(start + offset, random, seedContext)
      );
      const { sql, params } = buildReportableTaskInsertQuery(batch);
      await client.query(sql, params);
    }
  } finally {
    await client.end();
  }
};

const buildBulkInsertQuery = (tableName, columns, rows) => {
  const params = [];
  const values = rows
    .map(row => {
      const placeholders = columns.map(column => {
        params.push(row[column] ?? null);
        return `$${params.length}`;
      });
      return `(${placeholders.join(', ')})`;
    })
    .join(', ');

  return {
    sql: `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${values}`,
    params,
  };
};

const fetchLocalCourtVenueCaseTypeLookupRows = async lrdClient => {
  const associationTableResult = await lrdClient.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'locrefdata'
      AND table_name IN ('court_type_service_assoc', 'service_to_ccd_case_type_assoc')
  `);
  const associationTables = new Set(associationTableResult.rows.map(row => row.table_name));
  if (!associationTables.has('court_type_service_assoc') || !associationTables.has('service_to_ccd_case_type_assoc')) {
    return [];
  }

  const result = await lrdClient.query(`
    SELECT
      cv.epimms_id,
      assoc.ccd_case_type,
      MIN(ctsa.service_code) AS service_code,
      MIN(cv.court_type_id) AS court_type_id,
      MIN(cv.site_name) AS site_name,
      MIN(cv.region_id) AS region_id
    FROM locrefdata.court_venue cv
    INNER JOIN locrefdata.court_type_service_assoc ctsa
      ON ctsa.court_type_id = cv.court_type_id
    INNER JOIN locrefdata.service_to_ccd_case_type_assoc assoc
      ON assoc.service_code = ctsa.service_code
    WHERE NULLIF(BTRIM(cv.epimms_id), '') IS NOT NULL
      AND NULLIF(BTRIM(assoc.ccd_case_type), '') IS NOT NULL
      AND NULLIF(BTRIM(cv.site_name), '') IS NOT NULL
    GROUP BY
      cv.epimms_id,
      assoc.ccd_case_type
    HAVING COUNT(DISTINCT cv.court_type_id) = 1
      AND COUNT(DISTINCT cv.site_name) = 1
  `);

  return result.rows;
};

const fetchLocalCourtVenueEpimmsLookupRows = async lrdClient => {
  const result = await lrdClient.query(`
    SELECT
      cv.epimms_id,
      MIN(cv.site_name) AS site_name,
      MIN(cv.region_id) AS region_id
    FROM locrefdata.court_venue cv
    WHERE NULLIF(BTRIM(cv.epimms_id), '') IS NOT NULL
      AND NULLIF(BTRIM(cv.site_name), '') IS NOT NULL
    GROUP BY cv.epimms_id
    HAVING COUNT(DISTINCT cv.site_name) = 1
  `);

  return result.rows;
};

const syncLocalLocationReferenceData = async (config = resolveLocalDbConfig(), dependencies = {}) => {
  assertLocalHost(config.host);
  const { ClientCtor = Client, logger = console } = dependencies;
  const lrdClient = createClient(config, config.databases.lrd, ClientCtor);
  const tmClient = createClient(config, config.databases.tm, ClientCtor);

  logger.info('Syncing local analytics location reference data');
  await lrdClient.connect();
  await tmClient.connect();
  try {
    const caseTypeRows = await fetchLocalCourtVenueCaseTypeLookupRows(lrdClient);
    const epimmsRows = await fetchLocalCourtVenueEpimmsLookupRows(lrdClient);

    await tmClient.query('BEGIN');
    try {
      await tmClient.query('DELETE FROM analytics.court_venue_case_type_lookup');
      await tmClient.query('DELETE FROM analytics.court_venue_epimms_lookup');

      if (caseTypeRows.length > 0) {
        const { sql, params } = buildBulkInsertQuery(
          'analytics.court_venue_case_type_lookup',
          ['epimms_id', 'ccd_case_type', 'service_code', 'court_type_id', 'site_name', 'region_id'],
          caseTypeRows
        );
        await tmClient.query(sql, params);
      }

      if (epimmsRows.length > 0) {
        const { sql, params } = buildBulkInsertQuery(
          'analytics.court_venue_epimms_lookup',
          ['epimms_id', 'site_name', 'region_id'],
          epimmsRows
        );
        await tmClient.query(sql, params);
      }

      await tmClient.query(
        `
          INSERT INTO analytics.location_reference_sync_state (
            singleton_id,
            last_synced_at,
            case_type_lookup_rows,
            epimms_lookup_rows
          )
          VALUES (TRUE, now(), $1, $2)
          ON CONFLICT (singleton_id) DO UPDATE
          SET
            last_synced_at = EXCLUDED.last_synced_at,
            case_type_lookup_rows = EXCLUDED.case_type_lookup_rows,
            epimms_lookup_rows = EXCLUDED.epimms_lookup_rows
        `,
        [caseTypeRows.length, epimmsRows.length]
      );
      await tmClient.query('COMMIT');
    } catch (error) {
      await tmClient.query('ROLLBACK');
      throw error;
    }

    logger.info(
      `Synced local location reference data (${caseTypeRows.length} case-type rows, ${epimmsRows.length} EPIMMS rows)`
    );
  } finally {
    await lrdClient.end();
    await tmClient.end();
  }
};

const refreshLocalDatabase = async (config = resolveLocalDbConfig(), dependencies = {}) => {
  assertLocalHost(config.host);
  const { ClientCtor = Client, logger = console } = dependencies;
  const client = createClient(config, config.databases.tm, ClientCtor);

  await syncLocalLocationReferenceData(config, dependencies);

  logger.info('Running local analytics snapshot refresh');
  await client.connect();
  try {
    await client.query('CALL analytics.run_snapshot_refresh_batch()');
  } finally {
    await client.end();
  }
};

const seedLocalDatabase = async (config = resolveLocalDbConfig(), dependencies = {}) => {
  assertLocalHost(config.host);
  await runSqlFile(config, config.databases.tm, localDbFiles.tmReferenceData, dependencies);
  await runSqlFile(config, config.databases.crd, localDbFiles.crdReferenceData, dependencies);
  await runSqlFile(config, config.databases.lrd, localDbFiles.lrdReferenceData, dependencies);
  await seedReportableTasks(config, dependencies);
  await refreshLocalDatabase(config, dependencies);
};

const validateRows = async (client, sql, description, params = []) => {
  const result = await client.query(sql, params);
  const rows = Number(result.rows[0]?.rows ?? 0);
  if (rows <= 0) {
    throw new Error(`Local database validation failed: ${description}`);
  }
};

const getPublishedSnapshotId = async client => {
  const result = await client.query(`
    SELECT published_snapshot_id AS snapshot_id
    FROM analytics.snapshot_state
    WHERE singleton_id = TRUE
      AND published_snapshot_id IS NOT NULL
  `);
  const snapshotId = Number(result.rows[0]?.snapshot_id ?? 0);
  if (snapshotId <= 0) {
    throw new Error('Local database validation failed: no published snapshot is available');
  }
  return snapshotId;
};

const validateLocalDatabase = async (config = resolveLocalDbConfig(), dependencies = {}) => {
  const { ClientCtor = Client, logger = console } = dependencies;

  const tmClient = createClient(config, config.databases.tm, ClientCtor);
  await tmClient.connect();
  try {
    const publishedSnapshotId = await getPublishedSnapshotId(tmClient);
    await validateRows(
      tmClient,
      'SELECT COUNT(*)::int AS rows FROM analytics.snapshot_batches WHERE snapshot_id = $1 AND status = $2',
      `published snapshot ${publishedSnapshotId} did not succeed`,
      [publishedSnapshotId, 'succeeded']
    );
    await validateRows(
      tmClient,
      'SELECT COUNT(*)::int AS rows FROM analytics.snapshot_open_task_rows WHERE snapshot_id = $1',
      'open task snapshot rows are missing',
      [publishedSnapshotId]
    );
    await validateRows(
      tmClient,
      'SELECT COUNT(*)::int AS rows FROM analytics.snapshot_completed_task_rows WHERE snapshot_id = $1',
      'completed task snapshot rows are missing',
      [publishedSnapshotId]
    );
    await validateRows(
      tmClient,
      'SELECT COUNT(*)::int AS rows FROM analytics.snapshot_task_event_service_daily_facts WHERE snapshot_id = $1',
      'task event service rollup rows are missing',
      [publishedSnapshotId]
    );
    await validateRows(
      tmClient,
      'SELECT COUNT(*)::int AS rows FROM analytics.snapshot_overview_filter_facts WHERE snapshot_id = $1',
      'overview filter facts are missing',
      [publishedSnapshotId]
    );
  } finally {
    await tmClient.end();
  }

  const crdClient = createClient(config, config.databases.crd, ClientCtor);
  await crdClient.connect();
  try {
    await validateRows(
      crdClient,
      'SELECT COUNT(*)::int AS rows FROM rdstaffreport.vw_case_worker_profile',
      'caseworker reference data is missing'
    );
  } finally {
    await crdClient.end();
  }

  const lrdClient = createClient(config, config.databases.lrd, ClientCtor);
  await lrdClient.connect();
  try {
    await validateRows(
      lrdClient,
      'SELECT COUNT(*)::int AS rows FROM locrefdata.region',
      'region reference data is missing'
    );
    await validateRows(
      lrdClient,
      'SELECT COUNT(*)::int AS rows FROM locrefdata.court_venue',
      'court venue reference data is missing'
    );
  } finally {
    await lrdClient.end();
  }

  logger.info('Local database validation passed');
};

const startLocalDatabase = (config = resolveLocalDbConfig(), dependencies = {}) => {
  const { runCommand = runExternalCommand, logger = console } = dependencies;

  logger.info('Starting local Postgres container');
  runCommand('docker', ['compose', '-f', 'docker-compose.local-db.yml', 'up', '-d', '--wait'], {
    cwd: config.rootDir,
    env: { ...process.env, LOCAL_DB_PORT: config.port },
    stdio: 'inherit',
  });
};

const rebuildLocalDatabase = async (config = resolveLocalDbConfig(), dependencies = {}) => {
  await resetLocalDatabases(config, dependencies);
  migrateLocalDatabase(config, dependencies);
  await seedLocalDatabase(config, dependencies);
  await validateLocalDatabase(config, dependencies);
};

const runFromEnvironment = async (argv = process.argv.slice(2), env = process.env, dependencies = {}) => {
  const [command] = argv;
  const config = resolveLocalDbConfig(env);

  switch (command) {
    case 'up':
      startLocalDatabase(config, dependencies);
      return;
    case 'reset':
      await resetLocalDatabases(config, dependencies);
      return;
    case 'migrate':
      migrateLocalDatabase(config, dependencies);
      return;
    case 'seed':
      await seedLocalDatabase(config, dependencies);
      return;
    case 'refresh':
      await refreshLocalDatabase(config, dependencies);
      return;
    case 'rebuild':
      await rebuildLocalDatabase(config, dependencies);
      return;
    case 'validate':
      await validateLocalDatabase(config, dependencies);
      return;
    default:
      throw new Error('Usage: node scripts/local-db.js <up|reset|migrate|seed|refresh|rebuild|validate>');
  }
};

module.exports = {
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
  MIN_SEED_RECORD_COUNT,
  assertLocalHost,
  buildReportableTaskInsertQuery,
  buildConnectionString,
  buildFlywayArgs,
  buildFlywayJdbcUrl,
  generateReportableTasks,
  localDbFiles,
  migrateLocalDatabase,
  refreshLocalDatabase,
  rebuildLocalDatabase,
  resetLocalDatabases,
  resolveLocalDbConfig,
  runFromEnvironment,
  seedLocalDatabase,
  seedReportableTasks,
  startLocalDatabase,
  syncLocalLocationReferenceData,
  validateLocalDatabase,
  waitForLocalDatabase,
};

/* istanbul ignore next */
if (require.main === module) {
  void runFromEnvironment().catch(error => {
    console.error('Local database command failed', error);
    process.exitCode = 1;
  });
}
