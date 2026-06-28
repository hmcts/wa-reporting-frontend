import fs from 'fs';
import path from 'path';

const readRepositoryFile = (relativePath: string): string =>
  fs.readFileSync(path.join(__dirname, '../../../../', relativePath), 'utf8');

const normaliseSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim();

describe('analytics location reference snapshot SQL', () => {
  const currentStateSql = readRepositoryFile('db/current-state/tm-analytics-schema.sql');
  const migrationSql = readRepositoryFile('db/migrations/tm/V016__lrd_court_venue_location_labels.sql');

  test.each([
    ['current-state schema', currentStateSql],
    ['V016 migration', migrationSql],
  ])('%s resolves location labels with case-type lookup then generic EPIMMS fallback', (_label, sql) => {
    const normalised = normaliseSql(sql);

    expect(normalised).toMatch(/CREATE TABLE (IF NOT EXISTS )?analytics\.court_venue_case_type_lookup/);
    expect(normalised).toContain('PRIMARY KEY (epimms_id, ccd_case_type)');
    expect(normalised).toMatch(/CREATE TABLE (IF NOT EXISTS )?analytics\.court_venue_epimms_lookup/);
    expect(normalised).toMatch(/CREATE TABLE (IF NOT EXISTS )?analytics\.location_reference_sync_state/);
    expect(normalised).toContain("NULLIF(BTRIM(source.location), '') AS location_id");
    expect(normalised).toContain('source.case_type_id');
    expect(normalised).toContain(
      "COALESCE( case_type_location.site_name, epimms_location.site_name, NULLIF(BTRIM(source.location), '') ) AS location"
    );
    expect(normalised).toContain(
      "LEFT JOIN analytics.court_venue_case_type_lookup case_type_location ON case_type_location.epimms_id = NULLIF(BTRIM(source.location), '') AND case_type_location.ccd_case_type = source.case_type_id"
    );
    expect(normalised).toContain(
      "LEFT JOIN analytics.court_venue_epimms_lookup epimms_location ON epimms_location.epimms_id = NULLIF(BTRIM(source.location), '')"
    );
    expect(normalised).not.toContain('WaCaseType');
  });

  test.each([
    ['current-state schema', currentStateSql],
    ['V016 migration', migrationSql],
  ])('%s persists raw location_id on row-level snapshot tables', (_label, sql) => {
    const normalised = normaliseSql(sql);

    expect(normalised).toMatch(
      /(CREATE TABLE analytics\.snapshot_open_task_rows|ALTER TABLE analytics\.snapshot_open_task_rows)/
    );
    expect(normalised).toMatch(
      /(CREATE TABLE analytics\.snapshot_completed_task_rows|ALTER TABLE analytics\.snapshot_completed_task_rows)/
    );
    expect(normalised).toContain('location_id TEXT');
    expect(normalised).toContain(
      'INSERT INTO %s ( snapshot_id, task_id, case_id, task_name, case_type_label, jurisdiction_label, role_category_label, region, location_id, location'
    );
    expect(normalised).toContain(
      'INSERT INTO %s ( snapshot_id, task_id, case_id, task_name, jurisdiction_label, role_category_label, region, location_id, location'
    );
  });
});
