-- One-time cleanup for stale snapshot 10882.
--
-- Run this script manually against the TM database with client autocommit enabled.
-- Do not run it inside an explicit transaction because
-- analytics.cleanup_snapshot_partitions() commits internally.
--
-- If execution fails after acquiring the advisory lock, disconnect the
-- session or run the pg_advisory_unlock() statement at the end manually.

SET lock_timeout = '30min';

SELECT pg_advisory_lock(hashtext('analytics_run_snapshot_refresh_batch_lock'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM analytics.snapshot_state
    WHERE singleton_id = TRUE
      AND (
        published_snapshot_id = 10882
        OR in_progress_snapshot_id = 10882
      )
  ) THEN
    RAISE EXCEPTION 'Snapshot 10882 is published or in progress and cannot be cleaned up';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM analytics.snapshot_batches
    WHERE snapshot_id = 10882
      AND status = 'running'
      AND completed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Snapshot 10882 is not an incomplete running snapshot';
  END IF;
END;
$$;

CALL analytics.cleanup_snapshot_partitions(10882);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM analytics.snapshot_partition_catalog(10882)
    WHERE to_regclass(format('analytics.%I', partition_name)) IS NOT NULL
  ) OR EXISTS (
    SELECT 1
    FROM analytics.snapshot_batches
    WHERE snapshot_id = 10882
  ) THEN
    RAISE EXCEPTION 'Snapshot 10882 cleanup did not complete';
  END IF;
END;
$$;

SELECT pg_advisory_unlock(hashtext('analytics_run_snapshot_refresh_batch_lock'));

RESET lock_timeout;
