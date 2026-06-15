CREATE SCHEMA IF NOT EXISTS rdstaffreport;

DROP VIEW IF EXISTS rdstaffreport.vw_case_worker_profile;

CREATE VIEW rdstaffreport.vw_case_worker_profile AS
SELECT
  format('cw-%s', lpad(value::TEXT, 5, '0'))::TEXT AS case_worker_id,
  format('Caseworker%s', lpad(value::TEXT, 5, '0'))::TEXT AS first_name,
  format('User%s', lpad((((value - 1) % 250) + 1)::TEXT, 3, '0'))::TEXT AS last_name,
  format('caseworker.%s@example.test', lpad(value::TEXT, 5, '0'))::TEXT AS email_id,
  (((value - 1) % 8) + 1)::INTEGER AS region_id
FROM generate_series(1, 5000) AS profiles(value);
