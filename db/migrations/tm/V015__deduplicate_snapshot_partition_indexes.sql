CREATE OR REPLACE PROCEDURE analytics.create_snapshot_user_completed_rollup_indexes(
  p_snapshot_id BIGINT,
  p_user_completed_daily_totals_partition_name TEXT,
  p_user_completed_slicer_daily_facts_partition_name TEXT
)
LANGUAGE plpgsql
AS $procedure$
BEGIN
  EXECUTE format(
    'CREATE UNIQUE INDEX %I ON analytics.%I(snapshot_id, completed_date)',
    format('ux_sucdt_p_%s_key', p_snapshot_id),
    p_user_completed_daily_totals_partition_name
  );

  EXECUTE format(
    'CREATE UNIQUE INDEX %I ON analytics.%I(snapshot_id, jurisdiction_label, role_category_label, region, location, task_name, work_type, completed_date)',
    format('ux_sucsdf_p_%s_key', p_snapshot_id),
    p_user_completed_slicer_daily_facts_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(snapshot_id, completed_date)',
    format('ix_sucsdf_p_%s_completed_date', p_snapshot_id),
    p_user_completed_slicer_daily_facts_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(snapshot_id, jurisdiction_label, role_category_label, region, location, task_name, work_type)',
    format('ix_sucsdf_p_%s_slicers', p_snapshot_id),
    p_user_completed_slicer_daily_facts_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(snapshot_id, task_name)',
    format('ix_sucsdf_p_%s_task_name', p_snapshot_id),
    p_user_completed_slicer_daily_facts_partition_name
  );
END;
$procedure$;

CREATE OR REPLACE PROCEDURE analytics.create_snapshot_completed_daily_metrics_indexes(
  p_snapshot_id BIGINT,
  p_completed_daily_metrics_facts_partition_name TEXT
)
LANGUAGE plpgsql
AS $procedure$
BEGIN
  EXECUTE format(
    'CREATE UNIQUE INDEX IF NOT EXISTS %I ON analytics.%I(snapshot_id, reference_date)',
    format('ux_scdmf_p_%s_date', p_snapshot_id),
    p_completed_daily_metrics_facts_partition_name
  );
END;
$procedure$;

CREATE OR REPLACE PROCEDURE analytics.create_snapshot_completed_region_location_indexes(
  p_snapshot_id BIGINT,
  p_completed_region_location_facts_partition_name TEXT
)
LANGUAGE plpgsql
AS $procedure$
BEGIN
  EXECUTE format(
    'CREATE UNIQUE INDEX IF NOT EXISTS %I ON analytics.%I(snapshot_id, reference_date, region, location)',
    format('ux_scrlf_p_%s_key', p_snapshot_id),
    p_completed_region_location_facts_partition_name
  );
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON analytics.%I(snapshot_id, reference_date)',
    format('ix_scrlf_p_%s_ref_date', p_snapshot_id),
    p_completed_region_location_facts_partition_name
  );
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON analytics.%I(snapshot_id, region, location)',
    format('ix_scrlf_p_%s_region_loc', p_snapshot_id),
    p_completed_region_location_facts_partition_name
  );
END;
$procedure$;

CREATE OR REPLACE PROCEDURE analytics.create_snapshot_task_event_service_daily_indexes(
  p_snapshot_id BIGINT,
  p_task_event_service_daily_partition_name TEXT
)
LANGUAGE plpgsql
AS $procedure$
BEGIN
  EXECUTE format(
    'CREATE UNIQUE INDEX IF NOT EXISTS %I ON analytics.%I(snapshot_id, event_date, event_type, jurisdiction_label)',
    format('ux_stesdf_p_%s_key', p_snapshot_id),
    p_task_event_service_daily_partition_name
  );
END;
$procedure$;

CREATE OR REPLACE PROCEDURE analytics.create_snapshot_core_indexes(
  p_snapshot_id BIGINT,
  p_open_rows_partition_name TEXT,
  p_completed_rows_partition_name TEXT,
  p_user_completed_facts_partition_name TEXT,
  p_completed_dashboard_facts_partition_name TEXT,
  p_outstanding_due_status_partition_name TEXT,
  p_outstanding_created_assignment_partition_name TEXT,
  p_open_due_daily_partition_name TEXT,
  p_task_event_daily_partition_name TEXT,
  p_wait_time_partition_name TEXT
)
LANGUAGE plpgsql
AS $procedure$
BEGIN
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(jurisdiction_label, role_category_label, region, location, task_name, work_type)',
    format('ix_sotr_p_%s_slicers', p_snapshot_id),
    p_open_rows_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(state, created_date DESC)',
    format('ix_sotr_p_%s_state_created', p_snapshot_id),
    p_open_rows_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(created_date DESC NULLS LAST) WHERE state = ''ASSIGNED'' AND (role_category_label IS NULL OR UPPER(role_category_label) <> ''JUDICIAL'')',
    format('ix_sotr_p_%s_uo_assigned_default', p_snapshot_id),
    p_open_rows_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(state, assignee, created_date DESC) WHERE assignee IS NOT NULL',
    format('ix_sotr_p_%s_state_assignee_created', p_snapshot_id),
    p_open_rows_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(due_date)',
    format('ix_sotr_p_%s_due_date', p_snapshot_id),
    p_open_rows_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(case_id)',
    format('ix_sotr_p_%s_case_id', p_snapshot_id),
    p_open_rows_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(UPPER(role_category_label))',
    format('ix_sotr_p_%s_upper_role_category', p_snapshot_id),
    p_open_rows_partition_name
  );

  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(jurisdiction_label, role_category_label, region, location, task_name, work_type)',
    format('ix_sctr_p_%s_slicers', p_snapshot_id),
    p_completed_rows_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(completed_date DESC)',
    format('ix_sctr_p_%s_completed_date', p_snapshot_id),
    p_completed_rows_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(completed_date DESC NULLS LAST) WHERE role_category_label IS NULL OR UPPER(role_category_label) <> ''JUDICIAL''',
    format('ix_sctr_p_%s_uo_completed_default', p_snapshot_id),
    p_completed_rows_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(assignee, completed_date DESC) WHERE assignee IS NOT NULL',
    format('ix_sctr_p_%s_assignee_completed', p_snapshot_id),
    p_completed_rows_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(case_id, completed_date DESC)',
    format('ix_sctr_p_%s_case_id_completed', p_snapshot_id),
    p_completed_rows_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(within_due_sort_value, completed_date)',
    format('ix_sctr_p_%s_within_due_sort', p_snapshot_id),
    p_completed_rows_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(UPPER(role_category_label))',
    format('ix_sctr_p_%s_upper_role_category', p_snapshot_id),
    p_completed_rows_partition_name
  );
  PERFORM analytics.create_user_overview_completed_sort_indexes(
    p_snapshot_id,
    p_completed_rows_partition_name
  );

  EXECUTE format(
    'CREATE UNIQUE INDEX %I ON analytics.%I(assignee, jurisdiction_label, role_category_label, region, location, task_name, work_type, completed_date)',
    format('ux_sucf_p_%s_key', p_snapshot_id),
    p_user_completed_facts_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(assignee, completed_date DESC)',
    format('ix_sucf_p_%s_assignee_completed', p_snapshot_id),
    p_user_completed_facts_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(task_name)',
    format('ix_sucf_p_%s_task_name', p_snapshot_id),
    p_user_completed_facts_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(jurisdiction_label, role_category_label, region, location, task_name, work_type)',
    format('ix_sucf_p_%s_slicers', p_snapshot_id),
    p_user_completed_facts_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(completed_date)',
    format('ix_sucf_p_%s_completed_date', p_snapshot_id),
    p_user_completed_facts_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(UPPER(role_category_label))',
    format('ix_sucf_p_%s_upper_role_category', p_snapshot_id),
    p_user_completed_facts_partition_name
  );

  EXECUTE format(
    'CREATE UNIQUE INDEX %I ON analytics.%I(snapshot_id, reference_date, jurisdiction_label, role_category_label, region, location, task_name, work_type)',
    format('ux_scdf_p_%s_key', p_snapshot_id),
    p_completed_dashboard_facts_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(snapshot_id, reference_date)',
    format('ix_scdf_p_%s_reference_date', p_snapshot_id),
    p_completed_dashboard_facts_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(snapshot_id, jurisdiction_label, role_category_label, region, location, task_name, work_type)',
    format('ix_scdf_p_%s_slicers', p_snapshot_id),
    p_completed_dashboard_facts_partition_name
  );

  EXECUTE format(
    'CREATE UNIQUE INDEX %I ON analytics.%I(snapshot_id, due_date, jurisdiction_label, role_category_label, region, location, task_name, work_type)',
    format('ux_sodsf_p_%s_key', p_snapshot_id),
    p_outstanding_due_status_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(snapshot_id, due_date) INCLUDE (open_task_count, completed_task_count)',
    format('ix_sodsf_p_%s_due_date', p_snapshot_id),
    p_outstanding_due_status_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(snapshot_id, jurisdiction_label, role_category_label, region, location, task_name, work_type)',
    format('ix_sodsf_p_%s_slicers', p_snapshot_id),
    p_outstanding_due_status_partition_name
  );

  EXECUTE format(
    'CREATE UNIQUE INDEX %I ON analytics.%I(snapshot_id, reference_date, jurisdiction_label, role_category_label, region, location, task_name, work_type, assignment_state)',
    format('ux_socaf_p_%s_key', p_snapshot_id),
    p_outstanding_created_assignment_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(snapshot_id, reference_date)',
    format('ix_socaf_p_%s_ref_date', p_snapshot_id),
    p_outstanding_created_assignment_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(snapshot_id, jurisdiction_label, role_category_label, region, location, task_name, work_type, assignment_state)',
    format('ix_socaf_p_%s_slicers', p_snapshot_id),
    p_outstanding_created_assignment_partition_name
  );

  EXECUTE format(
    'CREATE UNIQUE INDEX %I ON analytics.%I(due_date, jurisdiction_label, role_category_label, region, location, task_name, work_type, priority, assignment_state)',
    format('ux_soddf_p_%s_key', p_snapshot_id),
    p_open_due_daily_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(jurisdiction_label, role_category_label, region, location, task_name, work_type)',
    format('ix_soddf_p_%s_slicers', p_snapshot_id),
    p_open_due_daily_partition_name
  );

  EXECUTE format(
    'CREATE UNIQUE INDEX %I ON analytics.%I(event_date, event_type, jurisdiction_label, role_category_label, region, location, task_name, work_type)',
    format('ux_stedf_p_%s_key', p_snapshot_id),
    p_task_event_daily_partition_name
  );

  EXECUTE format(
    'CREATE UNIQUE INDEX %I ON analytics.%I(jurisdiction_label, role_category_label, region, location, task_name, work_type, reference_date)',
    format('ux_swt_p_%s_key', p_snapshot_id),
    p_wait_time_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(jurisdiction_label, role_category_label, region, location, task_name, work_type)',
    format('ix_swt_p_%s_slicers', p_snapshot_id),
    p_wait_time_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(reference_date)',
    format('ix_swt_p_%s_reference_date', p_snapshot_id),
    p_wait_time_partition_name
  );
  EXECUTE format(
    'CREATE INDEX %I ON analytics.%I(UPPER(role_category_label))',
    format('ix_swt_p_%s_upper_role_category', p_snapshot_id),
    p_wait_time_partition_name
  );
END;
$procedure$;

DO $$
DECLARE
  v_index RECORD;
BEGIN
  FOR v_index IN
    SELECT
      index_namespace.nspname AS schema_name,
      index_class.relname AS index_name
    FROM pg_class index_class
    JOIN pg_namespace index_namespace
      ON index_namespace.oid = index_class.relnamespace
    JOIN pg_index index_def
      ON index_def.indexrelid = index_class.oid
    JOIN pg_class table_class
      ON table_class.oid = index_def.indrelid
    JOIN pg_namespace table_namespace
      ON table_namespace.oid = table_class.relnamespace
    WHERE index_namespace.nspname = 'analytics'
      AND table_namespace.nspname = 'analytics'
      AND table_class.relname ~ '_p_[0-9]+$'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_inherits index_inheritance
        WHERE index_inheritance.inhrelid = index_class.oid
      )
      AND (
        (table_class.relname LIKE 'snapshot_user_completed_daily_totals_p_%'
          AND index_class.relname LIKE 'ux_sucdt_p_%_key')
        OR (table_class.relname LIKE 'snapshot_user_completed_slicer_daily_facts_p_%'
          AND (
            index_class.relname LIKE 'ux_sucsdf_p_%_key'
            OR index_class.relname LIKE 'ix_sucsdf_p_%_completed_date'
            OR index_class.relname LIKE 'ix_sucsdf_p_%_slicers'
            OR index_class.relname LIKE 'ix_sucsdf_p_%_task_name'
          ))
        OR (table_class.relname LIKE 'snapshot_completed_dashboard_facts_p_%'
          AND (
            index_class.relname LIKE 'ux_scdf_p_%_key'
            OR index_class.relname LIKE 'ix_scdf_p_%_reference_date'
            OR index_class.relname LIKE 'ix_scdf_p_%_slicers'
          ))
        OR (table_class.relname LIKE 'snapshot_completed_daily_metrics_facts_p_%'
          AND index_class.relname LIKE 'ux_scdmf_p_%_date')
        OR (table_class.relname LIKE 'snapshot_completed_region_location_facts_p_%'
          AND (
            index_class.relname LIKE 'ux_scrlf_p_%_key'
            OR index_class.relname LIKE 'ix_scrlf_p_%_ref_date'
            OR index_class.relname LIKE 'ix_scrlf_p_%_region_loc'
          ))
        OR (table_class.relname LIKE 'snapshot_outstanding_due_status_daily_facts_p_%'
          AND (
            index_class.relname LIKE 'ux_sodsf_p_%_key'
            OR index_class.relname LIKE 'ix_sodsf_p_%_due_date'
            OR index_class.relname LIKE 'ix_sodsf_p_%_slicers'
          ))
        OR (table_class.relname LIKE 'snapshot_outstanding_created_assignment_daily_facts_p_%'
          AND (
            index_class.relname LIKE 'ux_socaf_p_%_key'
            OR index_class.relname LIKE 'ix_socaf_p_%_ref_date'
            OR index_class.relname LIKE 'ix_socaf_p_%_slicers'
          ))
        OR (table_class.relname LIKE 'snapshot_task_event_service_daily_facts_p_%'
          AND index_class.relname LIKE 'ux_stesdf_p_%_key')
      )
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I.%I', v_index.schema_name, v_index.index_name);
  END LOOP;
END;
$$;
