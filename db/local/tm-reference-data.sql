TRUNCATE cft_task_db.work_types;

INSERT INTO cft_task_db.work_types (work_type_id, label)
SELECT
  format('work_type_%s', lpad(value::TEXT, 2, '0')) AS work_type_id,
  format('Work type %s', lpad(value::TEXT, 2, '0')) AS label
FROM generate_series(1, 5) AS work_types(value);
