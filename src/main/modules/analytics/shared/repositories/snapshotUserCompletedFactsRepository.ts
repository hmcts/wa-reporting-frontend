import { Prisma } from '@prisma/client';

import { tmPrisma } from '../data/prisma';
import { AnalyticsFilters } from '../types';

import { AnalyticsQueryOptions, buildAnalyticsWhere } from './filters';
import { applyCompletedDateFilters, buildUserOverviewCompletedFactsWhere } from './rowRepositoryHelpers';
import { asOfSnapshotCondition } from './snapshotSql';
import { CompletedSummaryRow, UserOverviewCompletedByDateRow, UserOverviewCompletedByTaskNameRow } from './types';

const TABLE_NAME = 'analytics.snapshot_user_completed_facts';

export class SnapshotUserCompletedFactsRepository {
  async fetchUserOverviewCompletedSummaryRows(
    snapshotId: number,
    filters: AnalyticsFilters,
    queryOptions?: AnalyticsQueryOptions
  ): Promise<CompletedSummaryRow[]> {
    const whereClause = buildUserOverviewCompletedFactsWhere(snapshotId, filters, queryOptions);

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
    filters: AnalyticsFilters,
    queryOptions?: AnalyticsQueryOptions
  ): Promise<UserOverviewCompletedByDateRow[]> {
    const conditions: Prisma.Sql[] = [asOfSnapshotCondition(snapshotId), Prisma.sql`completed_date IS NOT NULL`];
    applyCompletedDateFilters(filters, conditions);
    if (filters.user && filters.user.length > 0) {
      conditions.push(Prisma.sql`assignee IN (${Prisma.join(filters.user)})`);
    }
    const whereClause = buildAnalyticsWhere(filters, conditions, queryOptions);

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
    filters: AnalyticsFilters,
    queryOptions?: AnalyticsQueryOptions
  ): Promise<UserOverviewCompletedByTaskNameRow[]> {
    const whereClause = buildUserOverviewCompletedFactsWhere(snapshotId, filters, queryOptions);

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

export const snapshotUserCompletedFactsRepository = new SnapshotUserCompletedFactsRepository();
