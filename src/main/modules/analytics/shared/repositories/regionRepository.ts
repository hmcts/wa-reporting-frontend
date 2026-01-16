import { lrdPrisma } from '../data/prisma';

import type { RegionRow } from './types';

export class RegionRepository {
  async getAll(): Promise<RegionRow[]> {
    return lrdPrisma.$queryRaw<RegionRow[]>`
      SELECT
        region_id,
        description
      FROM region
      ORDER BY description ASC
    `;
  }

  async getById(regionId: string): Promise<RegionRow | null> {
    const rows = await lrdPrisma.$queryRaw<RegionRow[]>`
      SELECT
        region_id,
        description
      FROM region
      WHERE region_id = ${regionId}
      LIMIT 1
    `;

    return rows[0] ?? null;
  }
}

export const regionRepository = new RegionRepository();
