CREATE SCHEMA IF NOT EXISTS locrefdata;

CREATE TABLE IF NOT EXISTS locrefdata.region (
  region_id TEXT PRIMARY KEY,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS locrefdata.court_venue (
  epimms_id TEXT NOT NULL,
  site_name TEXT NOT NULL,
  region_id TEXT NOT NULL,
  court_type_id TEXT NOT NULL,
  CONSTRAINT court_venue_epimms_court_type_pk PRIMARY KEY (epimms_id, court_type_id)
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

ALTER TABLE locrefdata.court_venue
  DROP CONSTRAINT IF EXISTS court_venue_pkey;

TRUNCATE locrefdata.service_to_ccd_case_type_assoc;
TRUNCATE locrefdata.court_type_service_assoc;
TRUNCATE locrefdata.court_venue;
TRUNCATE locrefdata.region;

ALTER TABLE locrefdata.court_venue
  ALTER COLUMN court_type_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'locrefdata.court_venue'::regclass
      AND conname = 'court_venue_epimms_court_type_pk'
  ) THEN
    ALTER TABLE locrefdata.court_venue
      ADD CONSTRAINT court_venue_epimms_court_type_pk PRIMARY KEY (epimms_id, court_type_id);
  END IF;
END $$;

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

INSERT INTO locrefdata.court_venue (epimms_id, site_name, region_id, court_type_id)
VALUES
  ('900001', 'Duplicate EPIMMS Civil Court', '1', 'local_duplicate_civil'),
  ('900001', 'Duplicate EPIMMS Family Court', '1', 'local_duplicate_family'),
  ('900002', 'Ambiguous EPIMMS Mapped Court', '2', 'local_ambiguous_mapped'),
  ('900002', 'Ambiguous EPIMMS Unmapped Court', '2', 'local_ambiguous_unmapped'),
  ('900003', 'Unambiguous EPIMMS Fallback Court', '3', 'local_unambiguous_unmapped');

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

INSERT INTO locrefdata.court_type_service_assoc (court_type_id, service_code)
VALUES
  ('local_duplicate_civil', 'local_service_01'),
  ('local_duplicate_family', 'local_service_02'),
  ('local_ambiguous_mapped', 'local_service_03');
