import fs from 'fs';
import path from 'path';

const readRepositoryFile = (relativePath: string): string =>
  fs.readFileSync(path.join(__dirname, '../../../../', relativePath), 'utf8');

const normaliseSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim();

describe('analytics completed task audit snapshot SQL', () => {
  const currentStateSql = normaliseSql(readRepositoryFile('db/current-state/tm-analytics-schema.sql'));
  const migrationSql = normaliseSql(
    readRepositoryFile('db/migrations/tm/V021__include_cancelled_tasks_in_completed_row_snapshot.sql')
  );

  test.each([
    ['current-state schema', currentStateSql],
    ['V021 migration', migrationSql],
  ])('%s appends cancelled rows to the completed row snapshot', (_label, sql) => {
    expect(sql).toContain('event_date DATE');
    expect(sql).toContain('CREATE OR REPLACE PROCEDURE analytics.populate_snapshot_cancelled_task_rows');
    expect(sql).toContain('last_updated_date::date, handling_time_days');
    expect(sql).toContain("WHERE outcome_lower = 'cancelled'");
    expect(sql).toContain('CALL analytics.populate_snapshot_cancelled_task_rows(p_snapshot_id)');
    expect(sql).toContain('case_id, event_date DESC');
  });

  test('migration coordinates with snapshot refresh before changing the snapshot', () => {
    expect(migrationSql).toContain("SET LOCAL lock_timeout = '20min'");
    expect(migrationSql).toContain(
      "SELECT pg_advisory_xact_lock(hashtext('analytics_run_snapshot_refresh_batch_lock'))"
    );
  });

  test('completed-only filter indexes are created before cancelled rows are appended', () => {
    const completedFilterIndexes = currentStateSql.indexOf('CALL analytics.create_snapshot_filter_indexes_only(');
    const cancelledRows = currentStateSql.indexOf(
      'CALL analytics.populate_snapshot_cancelled_task_rows(p_snapshot_id)'
    );

    expect(completedFilterIndexes).toBeGreaterThan(-1);
    expect(cancelledRows).toBeGreaterThan(completedFilterIndexes);
  });
});
