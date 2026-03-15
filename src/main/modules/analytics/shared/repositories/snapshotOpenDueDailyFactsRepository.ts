import { Prisma } from '@prisma/client';

import { tmPrisma } from '../data/prisma';
import { priorityRankSql } from '../priority/priorityRankSql';
import { AnalyticsFilters } from '../types';

import { AnalyticsQueryOptions, buildAnalyticsWhere } from './filters';
import { asOfSnapshotCondition } from './snapshotSql';
import {
  OpenTasksByNameRow,
  OpenTasksByRegionLocationRow,
  ServiceOverviewDbRow,
  SummaryTotalsRow,
  TasksDuePriorityRow,
  UserOverviewAssignedSummaryRow,
} from './types';

const TABLE_NAME = 'analytics.snapshot_open_due_daily_facts';

export class SnapshotOpenDueDailyFactsRepository {
  async fetchServiceOverviewRows(snapshotId: number, filters: AnalyticsFilters): Promise<ServiceOverviewDbRow[]> {
    const whereClause = buildAnalyticsWhere(filters, [asOfSnapshotCondition(snapshotId)]);
    const priorityRank = priorityRankSql({
      priorityColumn: Prisma.raw('priority'),
      dateColumn: Prisma.raw('due_date'),
    });

    return tmPrisma.$queryRaw<ServiceOverviewDbRow[]>(Prisma.sql`
      WITH bucketed AS (
        SELECT
          jurisdiction_label,
          assignment_state,
          task_count,
          ${priorityRank} AS priority_rank
        FROM ${Prisma.raw(TABLE_NAME)}
        ${whereClause}
      )
      SELECT
        jurisdiction_label AS service,
        SUM(task_count)::int AS open_tasks,
        SUM(CASE WHEN assignment_state = 'Assigned' THEN task_count ELSE 0 END)::int AS assigned_tasks,
        SUM(CASE WHEN priority_rank = 4 THEN task_count ELSE 0 END)::int AS urgent,
        SUM(CASE WHEN priority_rank = 3 THEN task_count ELSE 0 END)::int AS high,
        SUM(CASE WHEN priority_rank = 2 THEN task_count ELSE 0 END)::int AS medium,
        SUM(CASE WHEN priority_rank = 1 THEN task_count ELSE 0 END)::int AS low
      FROM bucketed
      GROUP BY jurisdiction_label
      ORDER BY service ASC
    `);
  }

  async fetchOpenTasksByNameRows(snapshotId: number, filters: AnalyticsFilters): Promise<OpenTasksByNameRow[]> {
    const whereClause = buildAnalyticsWhere(filters, [asOfSnapshotCondition(snapshotId)]);
    const priorityRank = priorityRankSql({
      priorityColumn: Prisma.raw('priority'),
      dateColumn: Prisma.raw('due_date'),
    });

    return tmPrisma.$queryRaw<OpenTasksByNameRow[]>(Prisma.sql`
      WITH bucketed AS (
        SELECT
          task_name,
          task_count,
          ${priorityRank} AS priority_rank
        FROM ${Prisma.raw(TABLE_NAME)}
        ${whereClause}
      )
      SELECT
        task_name,
        SUM(CASE WHEN priority_rank = 4 THEN task_count ELSE 0 END)::int AS urgent,
        SUM(CASE WHEN priority_rank = 3 THEN task_count ELSE 0 END)::int AS high,
        SUM(CASE WHEN priority_rank = 2 THEN task_count ELSE 0 END)::int AS medium,
        SUM(CASE WHEN priority_rank = 1 THEN task_count ELSE 0 END)::int AS low
      FROM bucketed
      GROUP BY task_name
      ORDER BY task_name ASC
    `);
  }

  async fetchOpenTasksByRegionLocationRows(
    snapshotId: number,
    filters: AnalyticsFilters
  ): Promise<OpenTasksByRegionLocationRow[]> {
    const whereClause = buildAnalyticsWhere(filters, [asOfSnapshotCondition(snapshotId)]);
    const priorityRank = priorityRankSql({
      priorityColumn: Prisma.raw('priority'),
      dateColumn: Prisma.raw('due_date'),
    });

    return tmPrisma.$queryRaw<OpenTasksByRegionLocationRow[]>(Prisma.sql`
      WITH bucketed AS (
        SELECT
          region,
          location,
          task_count,
          ${priorityRank} AS priority_rank
        FROM ${Prisma.raw(TABLE_NAME)}
        ${whereClause}
      )
      SELECT
        region,
        location,
        SUM(task_count)::int AS open_tasks,
        SUM(CASE WHEN priority_rank = 4 THEN task_count ELSE 0 END)::int AS urgent,
        SUM(CASE WHEN priority_rank = 3 THEN task_count ELSE 0 END)::int AS high,
        SUM(CASE WHEN priority_rank = 2 THEN task_count ELSE 0 END)::int AS medium,
        SUM(CASE WHEN priority_rank = 1 THEN task_count ELSE 0 END)::int AS low
      FROM bucketed
      GROUP BY region, location
      ORDER BY location ASC, region ASC
    `);
  }

  async fetchOpenTasksSummaryRows(snapshotId: number, filters: AnalyticsFilters): Promise<SummaryTotalsRow[]> {
    const whereClause = buildAnalyticsWhere(filters, [asOfSnapshotCondition(snapshotId)]);
    const priorityRank = priorityRankSql({
      priorityColumn: Prisma.raw('priority'),
      dateColumn: Prisma.raw('due_date'),
    });

    return tmPrisma.$queryRaw<SummaryTotalsRow[]>(Prisma.sql`
      WITH bucketed AS (
        SELECT
          assignment_state,
          task_count,
          ${priorityRank} AS priority_rank
        FROM ${Prisma.raw(TABLE_NAME)}
        ${whereClause}
      )
      SELECT
        SUM(CASE WHEN assignment_state = 'Assigned' THEN task_count ELSE 0 END)::int AS assigned,
        SUM(CASE WHEN assignment_state = 'Assigned' THEN 0 ELSE task_count END)::int AS unassigned,
        SUM(CASE WHEN priority_rank = 4 THEN task_count ELSE 0 END)::int AS urgent,
        SUM(CASE WHEN priority_rank = 3 THEN task_count ELSE 0 END)::int AS high,
        SUM(CASE WHEN priority_rank = 2 THEN task_count ELSE 0 END)::int AS medium,
        SUM(CASE WHEN priority_rank = 1 THEN task_count ELSE 0 END)::int AS low
      FROM bucketed
    `);
  }

  async fetchTasksDuePriorityRows(snapshotId: number, filters: AnalyticsFilters): Promise<TasksDuePriorityRow[]> {
    const whereClause = buildAnalyticsWhere(filters, [asOfSnapshotCondition(snapshotId)]);
    const priorityRank = priorityRankSql({
      priorityColumn: Prisma.raw('priority'),
      dateColumn: Prisma.raw('due_date'),
    });

    return tmPrisma.$queryRaw<TasksDuePriorityRow[]>(Prisma.sql`
      WITH bucketed AS (
        SELECT
          due_date,
          task_count,
          ${priorityRank} AS priority_rank
        FROM ${Prisma.raw(TABLE_NAME)}
        ${whereClause}
      )
      SELECT
        to_char(due_date, 'YYYY-MM-DD') AS date_key,
        SUM(CASE WHEN priority_rank = 4 THEN task_count ELSE 0 END)::int AS urgent,
        SUM(CASE WHEN priority_rank = 3 THEN task_count ELSE 0 END)::int AS high,
        SUM(CASE WHEN priority_rank = 2 THEN task_count ELSE 0 END)::int AS medium,
        SUM(CASE WHEN priority_rank = 1 THEN task_count ELSE 0 END)::int AS low
      FROM bucketed
      GROUP BY due_date
      ORDER BY due_date
    `);
  }

  async fetchAssignedSummaryRows(
    snapshotId: number,
    filters: AnalyticsFilters,
    queryOptions?: AnalyticsQueryOptions
  ): Promise<UserOverviewAssignedSummaryRow[]> {
    const conditions: Prisma.Sql[] = [asOfSnapshotCondition(snapshotId), Prisma.sql`assignment_state = 'Assigned'`];
    const whereClause = buildAnalyticsWhere(filters, conditions, queryOptions);
    const priorityRank = priorityRankSql({
      priorityColumn: Prisma.raw('priority'),
      dateColumn: Prisma.raw('due_date'),
    });

    return tmPrisma.$queryRaw<UserOverviewAssignedSummaryRow[]>(Prisma.sql`
      WITH bucketed AS (
        SELECT
          task_count,
          ${priorityRank} AS priority_rank
        FROM ${Prisma.raw(TABLE_NAME)}
        ${whereClause}
      )
      SELECT
        COALESCE(SUM(task_count), 0)::int AS total,
        COALESCE(SUM(CASE WHEN priority_rank = 4 THEN task_count ELSE 0 END), 0)::int AS urgent,
        COALESCE(SUM(CASE WHEN priority_rank = 3 THEN task_count ELSE 0 END), 0)::int AS high,
        COALESCE(SUM(CASE WHEN priority_rank = 2 THEN task_count ELSE 0 END), 0)::int AS medium,
        COALESCE(SUM(CASE WHEN priority_rank = 1 THEN task_count ELSE 0 END), 0)::int AS low
      FROM bucketed
    `);
  }
}

export const snapshotOpenDueDailyFactsRepository = new SnapshotOpenDueDailyFactsRepository();
