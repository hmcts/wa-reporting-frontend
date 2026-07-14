const { Client, escapeIdentifier } = require('pg');

const DEFAULT_DB_READER_USERNAME = 'DTS JIT Access wa DB Reader SC';
const DEFAULT_TM_DATABASE = 'cft_task_db';
const DEFAULT_TM_PORT = '5432';
const DEFAULT_TM_OPTIONS = 'ssl=true&sslmode=require';
const ANALYTICS_SCHEMA = 'analytics';
const DURABLE_ANALYTICS_TABLES = Object.freeze([
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
]);
const DURABLE_ANALYTICS_TABLE_SET = new Set(DURABLE_ANALYTICS_TABLES);
const SNAPSHOT_REFRESH_LOCK_KEY = 'analytics_run_snapshot_refresh_batch_lock';
// Serialises catalog ACL updates when multiple CI jobs bootstrap the same TM database.
const TM_SCHEMA_PERMISSIONS_BOOTSTRAP_LOCK_KEY = [0x746d, 0x7065726d];

const DURABLE_PERMISSIONS_PREFLIGHT_SQL = `
WITH required_tables AS (
  SELECT unnest($2::text[]) AS table_name
),
table_permissions AS (
  SELECT
    required_tables.table_name,
    analytics_table.oid,
    analytics_table.relkind,
    CASE
      WHEN analytics_table.oid IS NULL OR analytics_table.relkind NOT IN ('r', 'p') THEN FALSE
      ELSE has_table_privilege($1::text, analytics_table.oid, 'SELECT')
    END AS has_select
  FROM required_tables
  LEFT JOIN pg_namespace analytics_namespace
    ON analytics_namespace.nspname = $3::text
  LEFT JOIN pg_class analytics_table
    ON analytics_table.relnamespace = analytics_namespace.oid
   AND analytics_table.relname = required_tables.table_name
)
SELECT
  has_schema_privilege($1::text, $3::text, 'USAGE') AS has_schema_usage,
  COALESCE(
    array_agg(table_name ORDER BY table_name)
      FILTER (WHERE oid IS NULL OR relkind NOT IN ('r', 'p')),
    ARRAY[]::text[]
  ) AS missing_tables,
  COALESCE(
    array_agg(table_name ORDER BY table_name)
      FILTER (WHERE oid IS NOT NULL AND relkind IN ('r', 'p') AND NOT has_select),
    ARRAY[]::text[]
  ) AS tables_without_select
FROM table_permissions
`;

const firstDefined = (...values) => values.find(value => value !== undefined);

const normaliseOptions = options => {
  if (typeof options !== 'string') {
    return '';
  }

  const trimmedOptions = options.trim();
  if (!trimmedOptions) {
    return '';
  }

  return trimmedOptions.replace(/^\?+/, '');
};

const validateIdentifier = identifier => {
  if (typeof identifier !== 'string' || identifier.trim() === '') {
    throw new Error('TM schema permissions bootstrap requires a non-empty dbReaderUsername');
  }
};

const buildConnectionString = (env = process.env) => {
  if (env.TM_SCHEMA_PERMISSIONS_BOOTSTRAP_URL) {
    return env.TM_SCHEMA_PERMISSIONS_BOOTSTRAP_URL;
  }

  const host = firstDefined(
    env.TM_SCHEMA_PERMISSIONS_BOOTSTRAP_HOST,
    env.TM_DB_PRIMARY_HOST,
    env.TM_DB_REPLICA_HOST,
    env.TM_DB_HOST
  );
  const port = firstDefined(env.TM_SCHEMA_PERMISSIONS_BOOTSTRAP_PORT, env.TM_DB_PORT, DEFAULT_TM_PORT);
  const user = firstDefined(env.TM_SCHEMA_PERMISSIONS_BOOTSTRAP_USER, env.TM_DB_MIGRATION_USER, env.TM_DB_USER);
  const password = firstDefined(
    env.TM_SCHEMA_PERMISSIONS_BOOTSTRAP_PASSWORD,
    env.TM_DB_MIGRATION_PASSWORD,
    env.TM_DB_PASSWORD
  );
  const database = firstDefined(env.TM_SCHEMA_PERMISSIONS_BOOTSTRAP_DATABASE, env.TM_DB_NAME, DEFAULT_TM_DATABASE);
  const options = normaliseOptions(
    firstDefined(env.TM_SCHEMA_PERMISSIONS_BOOTSTRAP_OPTIONS, env.TM_DB_OPTIONS, DEFAULT_TM_OPTIONS)
  );

  if (!host || !user || !database) {
    return undefined;
  }

  const auth = password ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}` : encodeURIComponent(user);
  const connectionString = `postgresql://${auth}@${host}:${port}/${database}`;

  return options ? `${connectionString}?${options}` : connectionString;
};

const resolveBootstrapConfig = (env = process.env) => ({
  connectionString: buildConnectionString(env),
  dbReaderUsername: env.TM_SCHEMA_PERMISSIONS_DB_READER_USERNAME || DEFAULT_DB_READER_USERNAME,
});

const checkDurableAnalyticsPermissions = async (client, dbReaderUsername) => {
  const result = await client.query(DURABLE_PERMISSIONS_PREFLIGHT_SQL, [
    dbReaderUsername,
    DURABLE_ANALYTICS_TABLES,
    ANALYTICS_SCHEMA,
  ]);
  const permissions = result?.rows?.[0];

  if (!permissions) {
    throw new Error('TM schema permissions preflight did not return a permissions result');
  }

  return {
    hasSchemaUsage: permissions.has_schema_usage === true,
    missingTables: permissions.missing_tables || [],
    tablesWithoutSelect: permissions.tables_without_select || [],
  };
};

const assertDurableAnalyticsTablesExist = permissions => {
  if (permissions.missingTables.length > 0) {
    throw new Error(
      `TM schema permissions bootstrap is missing required durable analytics tables: ${permissions.missingTables.join(', ')}`
    );
  }
};

const hasRequiredDurableAnalyticsPermissions = permissions =>
  permissions.hasSchemaUsage && permissions.tablesWithoutSelect.length === 0;

const quoteDurableAnalyticsTables = tableNames => {
  const unknownTableNames = tableNames.filter(tableName => !DURABLE_ANALYTICS_TABLE_SET.has(tableName));
  if (unknownTableNames.length > 0) {
    throw new Error(
      `TM schema permissions preflight returned unexpected analytics tables: ${unknownTableNames.join(', ')}`
    );
  }

  return tableNames.map(tableName => `${escapeIdentifier(ANALYTICS_SCHEMA)}.${escapeIdentifier(tableName)}`).join(', ');
};

const bootstrapTmSchemaPermissions = async (
  config = resolveBootstrapConfig(),
  { ClientCtor = Client, logger = console } = {}
) => {
  if (!config.connectionString) {
    throw new Error('Unable to resolve TM schema permissions bootstrap database URL');
  }

  const client = new ClientCtor({ connectionString: config.connectionString });
  validateIdentifier(config.dbReaderUsername);
  const quotedDbReaderUsername = escapeIdentifier(config.dbReaderUsername);

  await client.connect();
  let transactionStarted = false;

  try {
    let permissions = await checkDurableAnalyticsPermissions(client, config.dbReaderUsername);
    assertDurableAnalyticsTablesExist(permissions);

    if (hasRequiredDurableAnalyticsPermissions(permissions)) {
      logger.info('TM analytics durable table permissions already granted; skipping bootstrap', {
        dbReaderUsername: config.dbReaderUsername,
      });
      return;
    }

    await client.query('BEGIN');
    transactionStarted = true;
    await client.query("SET LOCAL lock_timeout = '30min'");
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [SNAPSHOT_REFRESH_LOCK_KEY]);
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', TM_SCHEMA_PERMISSIONS_BOOTSTRAP_LOCK_KEY);

    permissions = await checkDurableAnalyticsPermissions(client, config.dbReaderUsername);
    assertDurableAnalyticsTablesExist(permissions);

    if (hasRequiredDurableAnalyticsPermissions(permissions)) {
      await client.query('COMMIT');
      transactionStarted = false;
      logger.info('TM analytics durable table permissions already granted; skipping bootstrap', {
        dbReaderUsername: config.dbReaderUsername,
      });
      return;
    }

    if (!permissions.hasSchemaUsage) {
      await client.query(`GRANT USAGE ON SCHEMA ${escapeIdentifier(ANALYTICS_SCHEMA)} TO ${quotedDbReaderUsername}`);
    }

    if (permissions.tablesWithoutSelect.length > 0) {
      const quotedTables = quoteDurableAnalyticsTables(permissions.tablesWithoutSelect);
      await client.query(`GRANT SELECT ON TABLE ${quotedTables} TO ${quotedDbReaderUsername}`);
    }

    await client.query('COMMIT');
    transactionStarted = false;

    logger.info('Granted TM analytics durable table permissions to configured DB reader role', {
      dbReaderUsername: config.dbReaderUsername,
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logger.warn('Failed to roll back TM schema permissions bootstrap transaction', rollbackError);
      }
    }

    throw error;
  } finally {
    await client.end();
  }
};

const runFromEnvironment = async (env = process.env, dependencies = {}) =>
  bootstrapTmSchemaPermissions(resolveBootstrapConfig(env), dependencies);

module.exports = {
  DEFAULT_DB_READER_USERNAME,
  buildConnectionString,
  bootstrapTmSchemaPermissions,
  normaliseOptions,
  resolveBootstrapConfig,
  runFromEnvironment,
  validateIdentifier,
};

/* istanbul ignore next */
if (require.main === module) {
  void runFromEnvironment().catch(error => {
    console.error('TM schema permissions bootstrap failed', error);
    process.exitCode = 1;
  });
}
