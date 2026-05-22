import { Prisma } from '@prisma/client';

import { tmPrisma } from '../data/prisma';
import { AnalyticsFilters } from '../types';

import { AnalyticsQueryOptions, buildAnalyticsWhere } from './filters';
import { asOfSnapshotCondition } from './snapshotSql';
import {
  CompletedByNameRow,
  CompletedProcessingHandlingTimeRow,
  CompletedRegionLocationAggregateRow,
  CompletedSummaryRow,
  CompletedTimelineRow,
} from './types';

const TABLE_NAME = 'analytics.snapshot_completed_dashboard_facts';

function buildCompletedDashboardFactsWhereClause(params: {
  snapshotId: number;
  filters: AnalyticsFilters;
  range?: { from?: Date; to?: Date };
  queryOptions?: AnalyticsQueryOptions;
}): Prisma.Sql {
  const conditions: Prisma.Sql[] = [asOfSnapshotCondition(params.snapshotId)];
  if (params.range?.from) {
    conditions.push(Prisma.sql`reference_date >= ${params.range.from}`);
  }
  if (params.range?.to) {
    conditions.push(Prisma.sql`reference_date <= ${params.range.to}`);
  }
  return buildAnalyticsWhere(params.filters, conditions, params.queryOptions);
}

export class SnapshotCompletedDashboardFactsRepository {
  async fetchCompletedSummaryRows(
    snapshotId: number,
    filters: AnalyticsFilters,
    range?: { from?: Date; to?: Date },
    queryOptions?: AnalyticsQueryOptions
  ): Promise<CompletedSummaryRow[]> {
    const whereClause = buildCompletedDashboardFactsWhereClause({ snapshotId, filters, range, queryOptions });

    return tmPrisma.$queryRaw<CompletedSummaryRow[]>(Prisma.sql`
      SELECT
        SUM(total_task_count)::int AS total,
        SUM(within_task_count)::int AS within
      FROM ${Prisma.raw(TABLE_NAME)}
      ${whereClause}
    `);
  }

  async fetchCompletedTimelineRows(
    snapshotId: number,
    filters: AnalyticsFilters,
    range?: { from?: Date; to?: Date }
  ): Promise<CompletedTimelineRow[]> {
    const whereClause = buildCompletedDashboardFactsWhereClause({ snapshotId, filters, range });

    return tmPrisma.$queryRaw<CompletedTimelineRow[]>(Prisma.sql`
      SELECT
        to_char(reference_date, 'YYYY-MM-DD') AS date_key,
        SUM(total_task_count)::int AS total,
        SUM(within_task_count)::int AS within
      FROM ${Prisma.raw(TABLE_NAME)}
      ${whereClause}
      GROUP BY reference_date
      ORDER BY reference_date
    `);
  }

  async fetchCompletedProcessingHandlingTimeRows(
    snapshotId: number,
    filters: AnalyticsFilters,
    range?: { from?: Date; to?: Date }
  ): Promise<CompletedProcessingHandlingTimeRow[]> {
    const whereClause = buildCompletedDashboardFactsWhereClause({ snapshotId, filters, range });

    return tmPrisma.$queryRaw<CompletedProcessingHandlingTimeRow[]>(Prisma.sql`
      SELECT
        to_char(reference_date, 'YYYY-MM-DD') AS date_key,
        SUM(total_task_count)::int AS task_count,
        CASE
          WHEN SUM(handling_time_days_count) = 0 THEN NULL
          ELSE SUM(handling_time_days_sum)::double precision / SUM(handling_time_days_count)::double precision
        END AS handling_avg,
        CASE
          WHEN SUM(handling_time_days_count) = 0 THEN NULL
          ELSE SQRT(
            GREATEST(
              0,
              (SUM(handling_time_days_sum_squares)::double precision / SUM(handling_time_days_count)::double precision) -
              POWER(SUM(handling_time_days_sum)::double precision / SUM(handling_time_days_count)::double precision, 2)
            )
          )
        END AS handling_stddev,
        SUM(handling_time_days_sum)::double precision AS handling_sum,
        SUM(handling_time_days_count)::int AS handling_count,
        CASE
          WHEN SUM(processing_time_days_count) = 0 THEN NULL
          ELSE SUM(processing_time_days_sum)::double precision / SUM(processing_time_days_count)::double precision
        END AS processing_avg,
        CASE
          WHEN SUM(processing_time_days_count) = 0 THEN NULL
          ELSE SQRT(
            GREATEST(
              0,
              (SUM(processing_time_days_sum_squares)::double precision / SUM(processing_time_days_count)::double precision) -
              POWER(SUM(processing_time_days_sum)::double precision / SUM(processing_time_days_count)::double precision, 2)
            )
          )
        END AS processing_stddev,
        SUM(processing_time_days_sum)::double precision AS processing_sum,
        SUM(processing_time_days_count)::int AS processing_count
      FROM ${Prisma.raw(TABLE_NAME)}
      ${whereClause}
      GROUP BY reference_date
      ORDER BY reference_date
    `);
  }

  async fetchCompletedByNameRows(
    snapshotId: number,
    filters: AnalyticsFilters,
    range?: { from?: Date; to?: Date }
  ): Promise<CompletedByNameRow[]> {
    const whereClause = buildCompletedDashboardFactsWhereClause({ snapshotId, filters, range });

    return tmPrisma.$queryRaw<CompletedByNameRow[]>(Prisma.sql`
      SELECT
        task_name,
        SUM(total_task_count)::int AS total,
        SUM(within_task_count)::int AS within
      FROM ${Prisma.raw(TABLE_NAME)}
      ${whereClause}
      GROUP BY task_name
      ORDER BY total DESC
    `);
  }

  async fetchCompletedRegionLocationRows(
    snapshotId: number,
    filters: AnalyticsFilters,
    range?: { from?: Date; to?: Date }
  ): Promise<CompletedRegionLocationAggregateRow[]> {
    const whereClause = buildCompletedDashboardFactsWhereClause({ snapshotId, filters, range });

    return tmPrisma.$queryRaw<CompletedRegionLocationAggregateRow[]>(Prisma.sql`
      SELECT
        CASE
          WHEN GROUPING(location) = 0 THEN 'location'
          ELSE 'region'
        END AS grouping_type,
        location,
        region,
        SUM(total_task_count)::int AS total,
        SUM(within_task_count)::int AS within,
        SUM(handling_time_days_sum)::double precision AS handling_time_days_sum,
        SUM(handling_time_days_count)::int AS handling_time_days_count,
        SUM(processing_time_days_sum)::double precision AS processing_time_days_sum,
        SUM(processing_time_days_count)::int AS processing_time_days_count
      FROM ${Prisma.raw(TABLE_NAME)}
      ${whereClause}
      GROUP BY GROUPING SETS ((location, region), (region))
      ORDER BY
        CASE WHEN GROUPING(location) = 0 THEN 1 ELSE 0 END ASC,
        CASE WHEN GROUPING(location) = 0 THEN location ELSE region END ASC,
        region ASC
    `);
  }
}

export const snapshotCompletedDashboardFactsRepository = new SnapshotCompletedDashboardFactsRepository();
