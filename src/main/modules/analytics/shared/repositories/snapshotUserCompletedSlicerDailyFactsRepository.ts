import { Prisma } from '@prisma/client';

import { tmPrisma } from '../data/prisma';
import { AnalyticsFilters } from '../types';

import { buildAnalyticsWhere } from './filters';
import { applyCompletedDateFilters } from './rowRepositoryHelpers';
import { asOfSnapshotCondition } from './snapshotSql';
import { CompletedSummaryRow, UserOverviewCompletedByDateRow, UserOverviewCompletedByTaskNameRow } from './types';

const TABLE_NAME = 'analytics.snapshot_user_completed_slicer_daily_facts';

function buildSlicerDailyFactsWhere(snapshotId: number, filters: AnalyticsFilters): Prisma.Sql {
  const conditions: Prisma.Sql[] = [asOfSnapshotCondition(snapshotId)];
  applyCompletedDateFilters(filters, conditions);
  return buildAnalyticsWhere(filters, conditions);
}

export class SnapshotUserCompletedSlicerDailyFactsRepository {
  async fetchUserOverviewCompletedSummaryRows(
    snapshotId: number,
    filters: AnalyticsFilters
  ): Promise<CompletedSummaryRow[]> {
    const whereClause = buildSlicerDailyFactsWhere(snapshotId, filters);

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
    const whereClause = buildSlicerDailyFactsWhere(snapshotId, filters);

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

  async fetchUserOverviewCompletedByTaskNameRows(
    snapshotId: number,
    filters: AnalyticsFilters
  ): Promise<UserOverviewCompletedByTaskNameRow[]> {
    const whereClause = buildSlicerDailyFactsWhere(snapshotId, filters);

    return tmPrisma.$queryRaw<UserOverviewCompletedByTaskNameRow[]>(Prisma.sql`
      SELECT
        task_name,
        SUM(tasks)::int AS tasks,
        SUM(handling_time_sum)::double precision AS handling_time_sum,
        SUM(tasks)::int AS handling_time_count,
        SUM(days_beyond_sum)::double precision AS days_beyond_sum,
        SUM(tasks)::int AS days_beyond_count
      FROM ${Prisma.raw(TABLE_NAME)}
      ${whereClause}
      GROUP BY task_name
      ORDER BY tasks DESC, task_name ASC
    `);
  }
}

export const snapshotUserCompletedSlicerDailyFactsRepository = new SnapshotUserCompletedSlicerDailyFactsRepository();
