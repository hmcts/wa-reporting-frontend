CREATE SCHEMA IF NOT EXISTS locrefdata;

CREATE TABLE IF NOT EXISTS locrefdata.region (
  region_id TEXT PRIMARY KEY,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS locrefdata.court_venue (
  epimms_id TEXT PRIMARY KEY,
  site_name TEXT NOT NULL,
  region_id TEXT NOT NULL
);

TRUNCATE locrefdata.court_venue;
TRUNCATE locrefdata.region;

INSERT INTO locrefdata.region (region_id, description)
SELECT
  value::TEXT AS region_id,
  format('Region %s', lpad(value::TEXT, 2, '0')) AS description
FROM generate_series(1, 8) AS regions(value);

INSERT INTO locrefdata.court_venue (epimms_id, site_name, region_id)
SELECT
  (1000 + value)::TEXT AS epimms_id,
  format('Generated Court Venue %s', lpad(value::TEXT, 3, '0')) AS site_name,
  (((value - 1) % 8) + 1)::TEXT AS region_id
FROM generate_series(1, 100) AS venues(value);
