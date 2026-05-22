import { Prisma } from '@prisma/client';

import { tmPrisma } from '../data/prisma';
import { AnalyticsFilters } from '../types';

import { applyCompletedDateFilters } from './rowRepositoryHelpers';
import { asOfSnapshotCondition } from './snapshotSql';
import { CompletedSummaryRow, UserOverviewCompletedByDateRow } from './types';

const TABLE_NAME = 'analytics.snapshot_user_completed_daily_totals';

function buildCompletedDateWhere(snapshotId: number, filters: AnalyticsFilters): Prisma.Sql {
  const conditions: Prisma.Sql[] = [asOfSnapshotCondition(snapshotId)];
  applyCompletedDateFilters(filters, conditions);
  return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
}

export class SnapshotUserCompletedDailyTotalsRepository {
  async fetchUserOverviewCompletedSummaryRows(
    snapshotId: number,
    filters: AnalyticsFilters
  ): Promise<CompletedSummaryRow[]> {
    const whereClause = buildCompletedDateWhere(snapshotId, filters);

    return tmPrisma.$queryRaw<CompletedSummaryRow[]>(Prisma.sql`
      SELECT
        COALESCE(SUM(tasks), 0)::int AS total,
        COALESCE(SUM(within_due), 0)::int AS within
      FROM ${Prisma.raw(TABLE_NAME)}
      ${whereClause}
    `);
  }

  async fetchUserOverviewCompletedByDateRows(
    snapshotId: number,
    filters: AnalyticsFilters
  ): Promise<UserOverviewCompletedByDateRow[]> {
    const whereClause = buildCompletedDateWhere(snapshotId, filters);

    return tmPrisma.$queryRaw<UserOverviewCompletedByDateRow[]>(Prisma.sql`
      SELECT
        to_char(completed_date, 'YYYY-MM-DD') AS date_key,
        SUM(tasks)::int AS tasks,
        SUM(within_due)::int AS within_due,
        SUM(beyond_due)::int AS beyond_due,
        SUM(handling_time_sum)::numeric AS handling_time_sum,
        SUM(handling_time_count)::int AS handling_time_count
      FROM ${Prisma.raw(TABLE_NAME)}
      ${whereClause}
      GROUP BY completed_date
      ORDER BY completed_date
    `);
  }
}

export const snapshotUserCompletedDailyTotalsRepository = new SnapshotUserCompletedDailyTotalsRepository();
