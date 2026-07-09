import fs from 'fs';
import path from 'path';

const readRepositoryFile = (relativePath: string): string =>
  fs.readFileSync(path.join(__dirname, '../../../../', relativePath), 'utf8');

const normaliseSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim();

describe('analytics outcome-based task classification SQL', () => {
  const currentStateSql = readRepositoryFile('db/current-state/tm-analytics-schema.sql');
  const migrationSql = readRepositoryFile('db/migrations/tm/V017__refresh_outcome_based_task_classification.sql');

  test.each([
    ['current-state schema', currentStateSql],
    ['V017 migration', migrationSql],
  ])('%s uses outcome for completed and cancelled classifications', (_label, sql) => {
    const normalised = normaliseSql(sql);

    expect(normalised).toContain("LOWER(COALESCE(source.outcome, '')) AS outcome_lower");
    expect(normalised).toContain("WHEN outcome_lower = 'completed' THEN 'completed'");
    expect(normalised).toContain("WHERE outcome_lower = 'completed'");
    expect(normalised).toContain("AND outcome_lower = 'cancelled'");
    expect(normalised).not.toContain("AND termination_reason_lower = 'deleted'");
  });

  test.each([
    ['current-state schema', currentStateSql],
    ['V017 migration', migrationSql],
  ])('%s excludes CANCELLED rows from open snapshot rows', (_label, sql) => {
    const normalised = normaliseSql(sql);

    expect(normalised).toContain("WHERE state NOT IN ('COMPLETED', 'TERMINATED', 'CANCELLED')");
  });
});
