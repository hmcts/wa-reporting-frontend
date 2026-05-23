import { Prisma } from '@prisma/client';

import { tmPrisma } from '../data/prisma';
import { AnalyticsFilters } from '../types';

import { hasSelectedValues } from './filterSelection';
import { asOfSnapshotCondition } from './snapshotSql';
import { CompletedRegionLocationAggregateRow } from './types';

const TABLE_NAME = 'analytics.snapshot_completed_region_location_facts';

function buildCompletedRegionLocationFactsWhereClause(params: {
  snapshotId: number;
  filters: AnalyticsFilters;
  range?: { from?: Date; to?: Date };
}): Prisma.Sql {
  const conditions: Prisma.Sql[] = [asOfSnapshotCondition(params.snapshotId)];
  if (params.range?.from) {
    conditions.push(Prisma.sql`reference_date >= ${params.range.from}`);
  }
  if (params.range?.to) {
    conditions.push(Prisma.sql`reference_date <= ${params.range.to}`);
  }
  const regions = params.filters.region;
  if (hasSelectedValues(regions)) {
    conditions.push(Prisma.sql`region IN (${Prisma.join(regions)})`);
  }
  const locations = params.filters.location;
  if (hasSelectedValues(locations)) {
    conditions.push(Prisma.sql`location IN (${Prisma.join(locations)})`);
  }
  return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
}

export class SnapshotCompletedRegionLocationFactsRepository {
  async fetchCompletedRegionLocationRows(
    snapshotId: number,
    filters: AnalyticsFilters,
    range?: { from?: Date; to?: Date }
  ): Promise<CompletedRegionLocationAggregateRow[]> {
    const whereClause = buildCompletedRegionLocationFactsWhereClause({ snapshotId, filters, range });

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

export const snapshotCompletedRegionLocationFactsRepository = new SnapshotCompletedRegionLocationFactsRepository();
