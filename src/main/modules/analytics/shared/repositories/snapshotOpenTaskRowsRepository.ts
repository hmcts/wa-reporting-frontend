import { Prisma } from '@prisma/client';

import { tmPrisma } from '../data/prisma';
import { CriticalTasksSortBy } from '../outstandingSort';
import { AnalyticsFilters } from '../types';
import { AssignedSortBy, SortState } from '../userOverviewSort';

import { AnalyticsQueryOptions, buildAnalyticsWhere } from './filters';
import {
  PaginationOptions,
  buildAssignedOrderBy,
  buildCriticalTasksOrderBy,
  buildOpenTaskPriorityRank,
  buildOpenUserOverviewTaskQuery,
  buildPaginationClauses,
  buildUserOverviewWhere,
} from './rowRepositoryHelpers';
import { asOfSnapshotCondition } from './snapshotSql';
import { OutstandingCriticalTaskRow, UserOverviewAssignedSummaryRow, UserOverviewTaskRow } from './types';

const TABLE_NAME = 'analytics.snapshot_open_task_rows';

export class SnapshotOpenTaskRowsRepository {
  async fetchUserOverviewAssignedTaskRows(
    snapshotId: number,
    filters: AnalyticsFilters,
    sort: SortState<AssignedSortBy>,
    pagination?: PaginationOptions | null,
    queryOptions?: AnalyticsQueryOptions
  ): Promise<UserOverviewTaskRow[]> {
    const whereClause = buildUserOverviewWhere(snapshotId, filters, [Prisma.sql`state = 'ASSIGNED'`], queryOptions);
    const orderBy = buildAssignedOrderBy(sort);

    return tmPrisma.$queryRaw<UserOverviewTaskRow[]>(
      buildOpenUserOverviewTaskQuery(TABLE_NAME, whereClause, orderBy, pagination)
    );
  }

  async fetchUserOverviewAssignedTaskCount(
    snapshotId: number,
    filters: AnalyticsFilters,
    queryOptions?: AnalyticsQueryOptions
  ): Promise<number> {
    const whereClause = buildUserOverviewWhere(snapshotId, filters, [Prisma.sql`state = 'ASSIGNED'`], queryOptions);
    const rows = await tmPrisma.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM ${Prisma.raw(TABLE_NAME)}
      ${whereClause}
    `);
    return rows[0]?.total ?? 0;
  }

  async fetchAssignedSummaryRows(
    snapshotId: number,
    filters: AnalyticsFilters,
    queryOptions?: AnalyticsQueryOptions
  ): Promise<UserOverviewAssignedSummaryRow[]> {
    const conditions: Prisma.Sql[] = [asOfSnapshotCondition(snapshotId), Prisma.sql`state = 'ASSIGNED'`];
    if (filters.user && filters.user.length > 0) {
      conditions.push(Prisma.sql`assignee IN (${Prisma.join(filters.user)})`);
    }
    const whereClause = buildAnalyticsWhere(filters, conditions, queryOptions);
    const priorityRank = buildOpenTaskPriorityRank();

    return tmPrisma.$queryRaw<UserOverviewAssignedSummaryRow[]>(Prisma.sql`
      SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(CASE WHEN ${priorityRank} = 4 THEN 1 ELSE 0 END), 0)::int AS urgent,
        COALESCE(SUM(CASE WHEN ${priorityRank} = 3 THEN 1 ELSE 0 END), 0)::int AS high,
        COALESCE(SUM(CASE WHEN ${priorityRank} = 2 THEN 1 ELSE 0 END), 0)::int AS medium,
        COALESCE(SUM(CASE WHEN ${priorityRank} = 1 THEN 1 ELSE 0 END), 0)::int AS low
      FROM ${Prisma.raw(TABLE_NAME)} rows
      ${whereClause}
    `);
  }

  async fetchOutstandingCriticalTaskRows(
    snapshotId: number,
    filters: AnalyticsFilters,
    sort: SortState<CriticalTasksSortBy>,
    pagination: PaginationOptions
  ): Promise<OutstandingCriticalTaskRow[]> {
    const priorityRank = buildOpenTaskPriorityRank();
    const whereClause = buildAnalyticsWhere(filters, [
      asOfSnapshotCondition(snapshotId),
      Prisma.sql`state IN ('ASSIGNED', 'UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED')`,
      Prisma.sql`created_date IS NOT NULL`,
    ]);
    const orderBy = buildCriticalTasksOrderBy(sort);
    const { limitClause, offsetClause } = buildPaginationClauses(pagination);

    return tmPrisma.$queryRaw<OutstandingCriticalTaskRow[]>(Prisma.sql`
      SELECT
        case_id,
        task_id,
        task_name,
        case_type_label,
        region,
        location,
        to_char(created_date, 'YYYY-MM-DD') AS created_date,
        to_char(due_date, 'YYYY-MM-DD') AS due_date,
        ${priorityRank} AS priority_rank,
        assignee
      FROM ${Prisma.raw(TABLE_NAME)} rows
      ${whereClause}
      ORDER BY ${orderBy}
      ${limitClause}
      ${offsetClause}
    `);
  }

  async fetchOutstandingCriticalTaskCount(snapshotId: number, filters: AnalyticsFilters): Promise<number> {
    const whereClause = buildAnalyticsWhere(filters, [
      asOfSnapshotCondition(snapshotId),
      Prisma.sql`state IN ('ASSIGNED', 'UNASSIGNED', 'PENDING AUTO ASSIGN', 'UNCONFIGURED')`,
      Prisma.sql`created_date IS NOT NULL`,
    ]);
    const rows = await tmPrisma.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM ${Prisma.raw(TABLE_NAME)} rows
      ${whereClause}
    `);
    return rows[0]?.total ?? 0;
  }
}

export const snapshotOpenTaskRowsRepository = new SnapshotOpenTaskRowsRepository();
