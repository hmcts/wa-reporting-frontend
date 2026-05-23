import { Prisma } from '@prisma/client';

import { tmPrisma } from '../data/prisma';

import { asOfSnapshotCondition } from './snapshotSql';
import { CompletedProcessingHandlingTimeRow, CompletedSummaryRow, CompletedTimelineRow } from './types';

const TABLE_NAME = 'analytics.snapshot_completed_daily_metrics_facts';

function buildCompletedDailyMetricsWhereClause(params: {
  snapshotId: number;
  range?: { from?: Date; to?: Date };
}): Prisma.Sql {
  const conditions: Prisma.Sql[] = [asOfSnapshotCondition(params.snapshotId)];
  if (params.range?.from) {
    conditions.push(Prisma.sql`reference_date >= ${params.range.from}`);
  }
  if (params.range?.to) {
    conditions.push(Prisma.sql`reference_date <= ${params.range.to}`);
  }
  return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
}

export class SnapshotCompletedDailyMetricsFactsRepository {
  async fetchCompletedSummaryRows(
    snapshotId: number,
    range?: { from?: Date; to?: Date }
  ): Promise<CompletedSummaryRow[]> {
    const whereClause = buildCompletedDailyMetricsWhereClause({ snapshotId, range });

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
    range?: { from?: Date; to?: Date }
  ): Promise<CompletedTimelineRow[]> {
    const whereClause = buildCompletedDailyMetricsWhereClause({ snapshotId, range });

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
    range?: { from?: Date; to?: Date }
  ): Promise<CompletedProcessingHandlingTimeRow[]> {
    const whereClause = buildCompletedDailyMetricsWhereClause({ snapshotId, range });

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
}

export const snapshotCompletedDailyMetricsFactsRepository = new SnapshotCompletedDailyMetricsFactsRepository();
