import fs from 'fs';
import path from 'path';

const readRepositoryFile = (relativePath: string): string =>
  fs.readFileSync(path.join(__dirname, '../../../../', relativePath), 'utf8');

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const expectHelperIndexDefinition = (sql: string, helperIndexName: string, createIndexSql: string): void => {
  expect(sql).toMatch(
    new RegExp(
      `'${escapeRegExp(createIndexSql)}',\\s+format\\('${escapeRegExp(helperIndexName)}', p_snapshot_id\\)`,
      's'
    )
  );
};

describe('analytics snapshot partition index SQL', () => {
  const currentStateSql = readRepositoryFile('db/current-state/tm-analytics-schema.sql');
  const migrationSql = readRepositoryFile('db/migrations/tm/V015__deduplicate_snapshot_partition_indexes.sql');

  const parentCompatibleIndexDefinitions = [
    {
      helperIndexName: 'ux_sucdt_p_%s_key',
      createIndexSql: 'CREATE UNIQUE INDEX %I ON analytics.%I(snapshot_id, completed_date)',
    },
    {
      helperIndexName: 'ux_sucsdf_p_%s_key',
      createIndexSql:
        'CREATE UNIQUE INDEX %I ON analytics.%I(snapshot_id, jurisdiction_label, role_category_label, region, location, task_name, work_type, completed_date)',
    },
    {
      helperIndexName: 'ix_sucsdf_p_%s_completed_date',
      createIndexSql: 'CREATE INDEX %I ON analytics.%I(snapshot_id, completed_date)',
    },
    {
      helperIndexName: 'ix_sucsdf_p_%s_slicers',
      createIndexSql:
        'CREATE INDEX %I ON analytics.%I(snapshot_id, jurisdiction_label, role_category_label, region, location, task_name, work_type)',
    },
    {
      helperIndexName: 'ix_sucsdf_p_%s_task_name',
      createIndexSql: 'CREATE INDEX %I ON analytics.%I(snapshot_id, task_name)',
    },
    {
      helperIndexName: 'ux_scdmf_p_%s_date',
      createIndexSql: 'CREATE UNIQUE INDEX IF NOT EXISTS %I ON analytics.%I(snapshot_id, reference_date)',
    },
    {
      helperIndexName: 'ux_scrlf_p_%s_key',
      createIndexSql:
        'CREATE UNIQUE INDEX IF NOT EXISTS %I ON analytics.%I(snapshot_id, reference_date, region, location)',
    },
    {
      helperIndexName: 'ix_scrlf_p_%s_ref_date',
      createIndexSql: 'CREATE INDEX IF NOT EXISTS %I ON analytics.%I(snapshot_id, reference_date)',
    },
    {
      helperIndexName: 'ix_scrlf_p_%s_region_loc',
      createIndexSql: 'CREATE INDEX IF NOT EXISTS %I ON analytics.%I(snapshot_id, region, location)',
    },
    {
      helperIndexName: 'ux_stesdf_p_%s_key',
      createIndexSql:
        'CREATE UNIQUE INDEX IF NOT EXISTS %I ON analytics.%I(snapshot_id, event_date, event_type, jurisdiction_label)',
    },
    {
      helperIndexName: 'ux_scdf_p_%s_key',
      createIndexSql:
        'CREATE UNIQUE INDEX %I ON analytics.%I(snapshot_id, reference_date, jurisdiction_label, role_category_label, region, location, task_name, work_type)',
    },
    {
      helperIndexName: 'ix_scdf_p_%s_reference_date',
      createIndexSql: 'CREATE INDEX %I ON analytics.%I(snapshot_id, reference_date)',
    },
    {
      helperIndexName: 'ix_scdf_p_%s_slicers',
      createIndexSql:
        'CREATE INDEX %I ON analytics.%I(snapshot_id, jurisdiction_label, role_category_label, region, location, task_name, work_type)',
    },
    {
      helperIndexName: 'ux_sodsf_p_%s_key',
      createIndexSql:
        'CREATE UNIQUE INDEX %I ON analytics.%I(snapshot_id, due_date, jurisdiction_label, role_category_label, region, location, task_name, work_type)',
    },
    {
      helperIndexName: 'ix_sodsf_p_%s_due_date',
      createIndexSql:
        'CREATE INDEX %I ON analytics.%I(snapshot_id, due_date) INCLUDE (open_task_count, completed_task_count)',
    },
    {
      helperIndexName: 'ix_sodsf_p_%s_slicers',
      createIndexSql:
        'CREATE INDEX %I ON analytics.%I(snapshot_id, jurisdiction_label, role_category_label, region, location, task_name, work_type)',
    },
    {
      helperIndexName: 'ux_socaf_p_%s_key',
      createIndexSql:
        'CREATE UNIQUE INDEX %I ON analytics.%I(snapshot_id, reference_date, jurisdiction_label, role_category_label, region, location, task_name, work_type, assignment_state)',
    },
    {
      helperIndexName: 'ix_socaf_p_%s_ref_date',
      createIndexSql: 'CREATE INDEX %I ON analytics.%I(snapshot_id, reference_date)',
    },
    {
      helperIndexName: 'ix_socaf_p_%s_slicers',
      createIndexSql:
        'CREATE INDEX %I ON analytics.%I(snapshot_id, jurisdiction_label, role_category_label, region, location, task_name, work_type, assignment_state)',
    },
  ];

  test('creates refresh helper indexes with parent-compatible snapshot_id-leading definitions', () => {
    expect.assertions(parentCompatibleIndexDefinitions.length * 2);

    for (const { helperIndexName, createIndexSql } of parentCompatibleIndexDefinitions) {
      expectHelperIndexDefinition(currentStateSql, helperIndexName, createIndexSql);
      expectHelperIndexDefinition(migrationSql, helperIndexName, createIndexSql);
    }
  });

  test('keeps the duplicate cleanup scoped to old child-local helper indexes only', () => {
    expect(migrationSql).toMatch(
      /AND NOT EXISTS \(\s+SELECT 1\s+FROM pg_inherits index_inheritance\s+WHERE index_inheritance\.inhrelid = index_class\.oid\s+\)/s
    );
    expect(migrationSql).toMatch(/table_class\.relname ~ '_p_\[0-9\]\+\$'/);

    for (const { helperIndexName } of parentCompatibleIndexDefinitions) {
      expect(migrationSql).toContain(helperIndexName.replace('%s', '%'));
    }
  });
});
