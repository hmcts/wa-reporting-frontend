import { lrdPrisma } from '../data/prisma';

import type { CourtVenueRow } from './types';

export class CourtVenueRepository {
  async getAll(): Promise<CourtVenueRow[]> {
    return lrdPrisma.$queryRaw<CourtVenueRow[]>`
      SELECT
        epimms_id,
        site_name,
        region_id
      FROM court_venue
      ORDER BY site_name ASC
    `;
  }

  async getById(epimmsId: string): Promise<CourtVenueRow | null> {
    const rows = await lrdPrisma.$queryRaw<CourtVenueRow[]>`
      SELECT
        epimms_id,
        site_name,
        region_id
      FROM court_venue
      WHERE epimms_id = ${epimmsId}
      LIMIT 1
    `;

    return rows[0] ?? null;
  }
}

export const courtVenueRepository = new CourtVenueRepository();
