CREATE OR REPLACE FUNCTION analytics.create_user_overview_completed_sort_indexes(
  p_snapshot_id BIGINT,
  p_partition_name TEXT
)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON analytics.%I(created_date ASC) WHERE role_category_label IS NULL OR UPPER(role_category_label) <> ''JUDICIAL''',
    format('ix_sctr_p_%s_uo_completed_created_date', p_snapshot_id),
    p_partition_name
  );
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON analytics.%I(first_assigned_date ASC) WHERE role_category_label IS NULL OR UPPER(role_category_label) <> ''JUDICIAL''',
    format('ix_sctr_p_%s_uo_completed_first_assigned_date', p_snapshot_id),
    p_partition_name
  );
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON analytics.%I(due_date ASC) WHERE role_category_label IS NULL OR UPPER(role_category_label) <> ''JUDICIAL''',
    format('ix_sctr_p_%s_uo_completed_due_date', p_snapshot_id),
    p_partition_name
  );
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON analytics.%I(handling_time_days ASC) WHERE role_category_label IS NULL OR UPPER(role_category_label) <> ''JUDICIAL''',
    format('ix_sctr_p_%s_uo_completed_handling_time_days', p_snapshot_id),
    p_partition_name
  );
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON analytics.%I(assignee ASC) WHERE role_category_label IS NULL OR UPPER(role_category_label) <> ''JUDICIAL''',
    format('ix_sctr_p_%s_uo_completed_assignee', p_snapshot_id),
    p_partition_name
  );
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON analytics.%I(task_name ASC) WHERE role_category_label IS NULL OR UPPER(role_category_label) <> ''JUDICIAL''',
    format('ix_sctr_p_%s_uo_completed_task_name', p_snapshot_id),
    p_partition_name
  );
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON analytics.%I(location ASC) WHERE role_category_label IS NULL OR UPPER(role_category_label) <> ''JUDICIAL''',
    format('ix_sctr_p_%s_uo_completed_location', p_snapshot_id),
    p_partition_name
  );
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON analytics.%I(((COALESCE(number_of_reassignments, 0) + 1)) ASC) WHERE role_category_label IS NULL OR UPPER(role_category_label) <> ''JUDICIAL''',
    format('ix_sctr_p_%s_uo_completed_total_assignments', p_snapshot_id),
    p_partition_name
  );
END;
$function$;

DO $$
DECLARE
  v_partition RECORD;
BEGIN
  FOR v_partition IN
    SELECT
      child.relname AS partition_name,
      regexp_replace(child.relname, '^snapshot_completed_task_rows_p_', '')::bigint AS snapshot_id
    FROM pg_inherits inherit
    JOIN pg_class child ON child.oid = inherit.inhrelid
    JOIN pg_namespace child_namespace ON child_namespace.oid = child.relnamespace
    WHERE inherit.inhparent = 'analytics.snapshot_completed_task_rows'::regclass
      AND child_namespace.nspname = 'analytics'
    ORDER BY regexp_replace(child.relname, '^snapshot_completed_task_rows_p_', '')::bigint
  LOOP
    PERFORM analytics.create_user_overview_completed_sort_indexes(
      v_partition.snapshot_id,
      v_partition.partition_name
    );
  END LOOP;
END;
$$;

DO $$
DECLARE
  v_definition TEXT;
  v_anchor TEXT := $anchor$
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(UPPER(role_category_label))',
      format('ix_sctr_p_%s_upper_role_category', v_snapshot_id),
      v_completed_rows_partition_name
    );
$anchor$;
  v_replacement TEXT := $replacement$
    EXECUTE format(
      'CREATE INDEX %I ON analytics.%I(UPPER(role_category_label))',
      format('ix_sctr_p_%s_upper_role_category', v_snapshot_id),
      v_completed_rows_partition_name
    );

    PERFORM analytics.create_user_overview_completed_sort_indexes(
      v_snapshot_id,
      v_completed_rows_partition_name
    );
$replacement$;
BEGIN
  SELECT pg_get_functiondef('analytics.run_snapshot_refresh_batch()'::regprocedure)
  INTO v_definition;

  IF position('analytics.create_user_overview_completed_sort_indexes' IN v_definition) > 0 THEN
    RETURN;
  END IF;

  IF position(v_anchor IN v_definition) = 0 THEN
    RAISE EXCEPTION
      'Could not find completed-row index anchor while updating analytics.run_snapshot_refresh_batch()';
  END IF;

  v_definition := replace(v_definition, v_anchor, v_replacement);
  EXECUTE v_definition;
END;
$$;
