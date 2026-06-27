CREATE SCHEMA IF NOT EXISTS locrefdata;

CREATE TABLE IF NOT EXISTS locrefdata.region (
  region_id TEXT PRIMARY KEY,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS locrefdata.court_venue (
  epimms_id TEXT PRIMARY KEY,
  site_name TEXT NOT NULL,
  region_id TEXT NOT NULL,
  court_type_id TEXT
);

CREATE TABLE IF NOT EXISTS locrefdata.court_type_service_assoc (
  court_type_id TEXT NOT NULL,
  service_code TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS locrefdata.service_to_ccd_case_type_assoc (
  service_code TEXT NOT NULL,
  ccd_case_type TEXT NOT NULL
);

ALTER TABLE locrefdata.court_venue
  ADD COLUMN IF NOT EXISTS court_type_id TEXT;

TRUNCATE locrefdata.service_to_ccd_case_type_assoc;
TRUNCATE locrefdata.court_type_service_assoc;
TRUNCATE locrefdata.court_venue;
TRUNCATE locrefdata.region;

INSERT INTO locrefdata.region (region_id, description)
SELECT
  value::TEXT AS region_id,
  format('Region %s', lpad(value::TEXT, 2, '0')) AS description
FROM generate_series(1, 8) AS regions(value);

INSERT INTO locrefdata.court_venue (epimms_id, site_name, region_id, court_type_id)
SELECT
  (1000 + value)::TEXT AS epimms_id,
  format('Generated Court Venue %s', lpad(value::TEXT, 3, '0')) AS site_name,
  (((value - 1) % 8) + 1)::TEXT AS region_id,
  'local_court' AS court_type_id
FROM generate_series(1, 100) AS venues(value);

INSERT INTO locrefdata.service_to_ccd_case_type_assoc (service_code, ccd_case_type)
SELECT
  format('local_service_%s', lpad(value::TEXT, 2, '0')) AS service_code,
  format('Service %s', lpad(value::TEXT, 2, '0')) AS ccd_case_type
FROM generate_series(1, 10) AS services(value);

INSERT INTO locrefdata.court_type_service_assoc (court_type_id, service_code)
SELECT
  'local_court' AS court_type_id,
  format('local_service_%s', lpad(value::TEXT, 2, '0')) AS service_code
FROM generate_series(1, 10) AS services(value);
