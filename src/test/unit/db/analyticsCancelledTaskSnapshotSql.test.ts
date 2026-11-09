import fs from 'fs';
import path from 'path';

const readRepositoryFile = (relativePath: string): string =>
  fs.readFileSync(path.join(__dirname, '../../../../', relativePath), 'utf8');

const normaliseSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim();

describe('analytics cancelled task snapshot SQL', () => {
  const currentStateSql = readRepositoryFile('db/current-state/tm-analytics-schema.sql');
  const migrationSql = readRepositoryFile('db/migrations/tm/V022__cancelled_task_audit_snapshot.sql');

  test.each([
    ['current-state schema', currentStateSql],
    ['V022 migration', migrationSql],
  ])('%s creates and populates a dedicated cancelled task snapshot', (_label, sql) => {
    const normalised = normaliseSql(sql);

    expect(normalised).toContain('CREATE TABLE analytics.snapshot_cancelled_task_rows');
    expect(normalised).toContain("'snapshot_cancelled_task_rows'");
    expect(normalised).toContain("WHERE outcome_lower = 'cancelled'");
    expect(normalised).toContain('last_updated_date');
    expect(normalised).toContain('CALL analytics.populate_snapshot_cancelled_task_rows(');
    expect(normalised).toContain('CALL analytics.create_snapshot_cancelled_task_rows_indexes(');
  });

  test('V022 serialises snapshot DDL with refresh', () => {
    const normalised = normaliseSql(migrationSql);

    expect(normalised).toContain("SET LOCAL lock_timeout = '20min'");
    expect(normalised).toContain("SELECT pg_advisory_xact_lock(hashtext('analytics_run_snapshot_refresh_batch_lock'))");
  });
});
