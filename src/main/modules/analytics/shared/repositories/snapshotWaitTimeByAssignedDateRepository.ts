import { Prisma } from '@prisma/client';

import { tmPrisma } from '../data/prisma';
import { AnalyticsFilters } from '../types';

import { buildAnalyticsWhere } from './filters';
import { asOfSnapshotCondition } from './snapshotSql';
import { WaitTimeRow } from './types';

const TABLE_NAME = 'analytics.snapshot_wait_time_by_assigned_date';

export class SnapshotWaitTimeByAssignedDateRepository {
  async fetchWaitTimeByAssignedDateRows(snapshotId: number, filters: AnalyticsFilters): Promise<WaitTimeRow[]> {
    const whereClause = buildAnalyticsWhere(filters, [asOfSnapshotCondition(snapshotId)]);

    return tmPrisma.$queryRaw<WaitTimeRow[]>(Prisma.sql`
      SELECT
        to_char(reference_date, 'YYYY-MM-DD') AS date_key,
        CASE
          WHEN SUM(assigned_task_count) = 0 THEN 0
          ELSE SUM(total_wait_time_days_sum)::double precision / SUM(assigned_task_count)::double precision
        END::double precision AS avg_wait_time_days,
        SUM(assigned_task_count)::int AS assigned_task_count
      FROM ${Prisma.raw(TABLE_NAME)}
      ${whereClause}
      GROUP BY reference_date
      ORDER BY reference_date
    `);
  }
}

export const snapshotWaitTimeByAssignedDateRepository = new SnapshotWaitTimeByAssignedDateRepository();
