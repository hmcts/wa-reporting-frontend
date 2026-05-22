import { Prisma } from '@prisma/client';

import { tmPrisma } from '../data/prisma';
import { AnalyticsFilters } from '../types';

import { buildAnalyticsWhere } from './filters';
import { asOfSnapshotCondition } from './snapshotSql';
import { TasksDueRow } from './types';

const TABLE_NAME = 'analytics.snapshot_outstanding_due_status_daily_facts';

export class SnapshotOutstandingDueStatusDailyFactsRepository {
  async fetchTasksDueByDateRows(snapshotId: number, filters: AnalyticsFilters): Promise<TasksDueRow[]> {
    const whereClause = buildAnalyticsWhere(filters, [asOfSnapshotCondition(snapshotId)]);

    return tmPrisma.$queryRaw<TasksDueRow[]>(Prisma.sql`
      SELECT
        to_char(due_date, 'YYYY-MM-DD') AS date_key,
        SUM(open_task_count)::int AS open,
        SUM(completed_task_count)::int AS completed
      FROM ${Prisma.raw(TABLE_NAME)}
      ${whereClause}
      GROUP BY due_date
      ORDER BY due_date
    `);
  }
}

export const snapshotOutstandingDueStatusDailyFactsRepository = new SnapshotOutstandingDueStatusDailyFactsRepository();
