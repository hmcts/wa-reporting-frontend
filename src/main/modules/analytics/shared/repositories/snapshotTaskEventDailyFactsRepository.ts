import { Prisma } from '@prisma/client';

import { tmPrisma } from '../data/prisma';
import { AnalyticsFilters } from '../types';

import { buildAnalyticsWhere } from './filters';
import { asOfSnapshotCondition } from './snapshotSql';
import { TaskEventsByServiceDbRow } from './types';

const TABLE_NAME = 'analytics.snapshot_task_event_daily_facts';

export class SnapshotTaskEventDailyFactsRepository {
  async fetchTaskEventsByServiceRows(
    snapshotId: number,
    filters: AnalyticsFilters,
    range: { from: Date; to: Date }
  ): Promise<TaskEventsByServiceDbRow[]> {
    const whereClause = buildAnalyticsWhere(filters, [
      asOfSnapshotCondition(snapshotId),
      Prisma.sql`event_date >= ${range.from}`,
      Prisma.sql`event_date <= ${range.to}`,
    ]);

    return tmPrisma.$queryRaw<TaskEventsByServiceDbRow[]>(Prisma.sql`
      SELECT
        jurisdiction_label AS service,
        SUM(CASE WHEN event_type = 'completed' THEN task_count ELSE 0 END)::int AS completed,
        SUM(CASE WHEN event_type = 'cancelled' THEN task_count ELSE 0 END)::int AS cancelled,
        SUM(CASE WHEN event_type = 'created' THEN task_count ELSE 0 END)::int AS created
      FROM ${Prisma.raw(TABLE_NAME)}
      ${whereClause}
      GROUP BY jurisdiction_label
      ORDER BY service ASC
    `);
  }
}

export const snapshotTaskEventDailyFactsRepository = new SnapshotTaskEventDailyFactsRepository();
