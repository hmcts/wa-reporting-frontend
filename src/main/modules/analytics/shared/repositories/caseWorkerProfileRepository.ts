import { Prisma } from '@prisma/client';

import { crdPrisma } from '../data/prisma';

import type { CaseWorkerProfileRow } from './types';

export class CaseWorkerProfileRepository {
  async getAll(): Promise<CaseWorkerProfileRow[]> {
    return crdPrisma.$queryRaw<CaseWorkerProfileRow[]>(Prisma.sql`
      SELECT
        case_worker_id,
        first_name,
        last_name,
        email_id,
        region_id
      FROM vw_case_worker_profile
    `);
  }

  async getById(caseWorkerId: string): Promise<CaseWorkerProfileRow | null> {
    const rows = await crdPrisma.$queryRaw<CaseWorkerProfileRow[]>(Prisma.sql`
      SELECT
        case_worker_id,
        first_name,
        last_name,
        email_id,
        region_id
      FROM vw_case_worker_profile
      WHERE case_worker_id = ${caseWorkerId}
    `);

    return rows[0] ?? null;
  }
}

export const caseWorkerProfileRepository = new CaseWorkerProfileRepository();
