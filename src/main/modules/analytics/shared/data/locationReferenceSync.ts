import { Prisma } from '@prisma/client';
import config from 'config';

import { lrdPrisma, tmPrisma } from './prisma';

const { Logger } = require('../../../logging');

const logger = Logger.getLogger('location-reference-sync');
const LOCATION_REFERENCE_SYNC_LOCK_KEY = 'analytics_location_reference_sync_lock';

type LocationReferenceSyncConfig = {
  enabled: boolean;
  intervalSeconds: number;
};

type LockRow = {
  acquired: boolean;
};

type CourtVenueCaseTypeLookupRow = {
  epimms_id: string;
  ccd_case_type: string;
  service_code: string;
  court_type_id: string;
  site_name: string;
  region_id: string | null;
};

type CourtVenueEpimmsLookupRow = {
  epimms_id: string;
  site_name: string;
  region_id: string | null;
};

function getLocationReferenceSyncConfig(): LocationReferenceSyncConfig {
  if (config.has('analytics.locationReferenceSync')) {
    return config.get<LocationReferenceSyncConfig>('analytics.locationReferenceSync');
  }
  return { enabled: true, intervalSeconds: 900 };
}

function getSafeIntervalMilliseconds(intervalSeconds: number): number {
  const seconds = Number.isFinite(intervalSeconds) ? Math.max(60, Math.floor(intervalSeconds)) : 900;
  return seconds * 1000;
}

function getErrorLogPayload(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { error };
  }
  return {
    errorName: error.name,
    errorMessage: error.message,
    errorStack: error.stack,
  };
}

async function fetchCourtVenueCaseTypeLookupRows(): Promise<CourtVenueCaseTypeLookupRow[]> {
  return lrdPrisma.$queryRaw<CourtVenueCaseTypeLookupRow[]>(Prisma.sql`
    SELECT
      cv.epimms_id,
      assoc.ccd_case_type,
      MIN(ctsa.service_code) AS service_code,
      MIN(cv.court_type_id) AS court_type_id,
      MIN(cv.site_name) AS site_name,
      MIN(cv.region_id) AS region_id
    FROM court_venue cv
    INNER JOIN court_type_service_assoc ctsa
      ON ctsa.court_type_id = cv.court_type_id
    INNER JOIN service_to_ccd_case_type_assoc assoc
      ON assoc.service_code = ctsa.service_code
    WHERE NULLIF(BTRIM(cv.epimms_id), '') IS NOT NULL
      AND NULLIF(BTRIM(assoc.ccd_case_type), '') IS NOT NULL
      AND NULLIF(BTRIM(cv.site_name), '') IS NOT NULL
    GROUP BY
      cv.epimms_id,
      assoc.ccd_case_type
    HAVING COUNT(DISTINCT cv.court_type_id) = 1
      AND COUNT(DISTINCT cv.site_name) = 1
  `);
}

async function fetchCourtVenueEpimmsLookupRows(): Promise<CourtVenueEpimmsLookupRow[]> {
  return lrdPrisma.$queryRaw<CourtVenueEpimmsLookupRow[]>(Prisma.sql`
    SELECT
      cv.epimms_id,
      MIN(cv.site_name) AS site_name,
      MIN(cv.region_id) AS region_id
    FROM court_venue cv
    WHERE NULLIF(BTRIM(cv.epimms_id), '') IS NOT NULL
      AND NULLIF(BTRIM(cv.site_name), '') IS NOT NULL
    GROUP BY cv.epimms_id
    HAVING COUNT(DISTINCT cv.site_name) = 1
  `);
}

function buildCaseTypeRowsInsert(rows: CourtVenueCaseTypeLookupRow[]): Prisma.Sql {
  return Prisma.sql`
    INSERT INTO analytics.court_venue_case_type_lookup (
      epimms_id,
      ccd_case_type,
      service_code,
      court_type_id,
      site_name,
      region_id
    )
    VALUES ${Prisma.join(
      rows.map(
        row => Prisma.sql`
        (
          ${row.epimms_id},
          ${row.ccd_case_type},
          ${row.service_code},
          ${row.court_type_id},
          ${row.site_name},
          ${row.region_id}
        )
      `
      )
    )}
  `;
}

function buildEpimmsRowsInsert(rows: CourtVenueEpimmsLookupRow[]): Prisma.Sql {
  return Prisma.sql`
    INSERT INTO analytics.court_venue_epimms_lookup (
      epimms_id,
      site_name,
      region_id
    )
    VALUES ${Prisma.join(
      rows.map(
        row => Prisma.sql`
        (
          ${row.epimms_id},
          ${row.site_name},
          ${row.region_id}
        )
      `
      )
    )}
  `;
}

export async function syncLocationReferenceData(): Promise<void> {
  const syncedCounts: { caseTypeRows: number; epimmsRows: number }[] = [];

  await tmPrisma.$transaction(async tx => {
    const lockRows = await tx.$queryRaw<LockRow[]>(Prisma.sql`
      SELECT pg_try_advisory_xact_lock(hashtext(${LOCATION_REFERENCE_SYNC_LOCK_KEY})) AS acquired
    `);
    if (lockRows[0]?.acquired !== true) {
      logger.info('Skipping location reference sync because advisory lock was not acquired');
      return;
    }

    const [caseTypeRows, epimmsRows] = await Promise.all([
      fetchCourtVenueCaseTypeLookupRows(),
      fetchCourtVenueEpimmsLookupRows(),
    ]);

    await tx.$executeRaw(Prisma.sql`DELETE FROM analytics.court_venue_case_type_lookup`);
    await tx.$executeRaw(Prisma.sql`DELETE FROM analytics.court_venue_epimms_lookup`);

    if (caseTypeRows.length > 0) {
      await tx.$executeRaw(buildCaseTypeRowsInsert(caseTypeRows));
    }
    if (epimmsRows.length > 0) {
      await tx.$executeRaw(buildEpimmsRowsInsert(epimmsRows));
    }

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO analytics.location_reference_sync_state (
        singleton_id,
        last_synced_at,
        case_type_lookup_rows,
        epimms_lookup_rows
      )
      VALUES (
        TRUE,
        now(),
        ${caseTypeRows.length},
        ${epimmsRows.length}
      )
      ON CONFLICT (singleton_id) DO UPDATE
      SET
        last_synced_at = EXCLUDED.last_synced_at,
        case_type_lookup_rows = EXCLUDED.case_type_lookup_rows,
        epimms_lookup_rows = EXCLUDED.epimms_lookup_rows
    `);

    syncedCounts.push({ caseTypeRows: caseTypeRows.length, epimmsRows: epimmsRows.length });
  });

  const [counts] = syncedCounts;
  if (counts) {
    logger.info('Synced location reference data', {
      caseTypeLookupRows: counts.caseTypeRows,
      epimmsLookupRows: counts.epimmsRows,
    });
  }
}

export async function bootstrapLocationReferenceSync(): Promise<void> {
  const syncConfig = getLocationReferenceSyncConfig();
  if (!syncConfig.enabled) {
    logger.info('Location reference sync disabled; skipping startup sync');
    return;
  }

  try {
    await syncLocationReferenceData();
  } catch (error) {
    logger.error('Failed to sync location reference data during startup', getErrorLogPayload(error));
  }

  const interval = setInterval(() => {
    void syncLocationReferenceData().catch((error: unknown) => {
      logger.error('Failed to sync location reference data on interval', getErrorLogPayload(error));
    });
  }, getSafeIntervalMilliseconds(syncConfig.intervalSeconds));

  (interval as unknown as { unref?: () => void }).unref?.();
}
