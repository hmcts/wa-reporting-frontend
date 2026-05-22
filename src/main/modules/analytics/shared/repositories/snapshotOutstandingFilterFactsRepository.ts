import { Prisma } from '@prisma/client';

import { tmPrisma } from '../data/prisma';
import { AnalyticsFilters } from '../types';

import { buildAnalyticsWhere } from './filters';
import { FilterFactsQueryParams, fetchFilterOptionsRows } from './filterFactsQueryHelpers';
import { asOfSnapshotCondition } from './snapshotSql';
import { OverviewFilterOptionsRows } from './types';

const TABLE_NAME = 'analytics.snapshot_outstanding_filter_facts';

export class SnapshotOutstandingFilterFactsRepository {
  async fetchFilterOptionsRows(
    snapshotId: number,
    params?: FilterFactsQueryParams
  ): Promise<OverviewFilterOptionsRows> {
    return fetchFilterOptionsRows({ tableName: TABLE_NAME, supportsAssigneeFacet: false }, snapshotId, params);
  }

  async fetchCriticalTaskCount(snapshotId: number, filters: AnalyticsFilters): Promise<number> {
    const whereClause = buildAnalyticsWhere(filters, [asOfSnapshotCondition(snapshotId)]);
    const rows = await tmPrisma.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT COALESCE(SUM(row_count), 0)::int AS total
      FROM ${Prisma.raw(TABLE_NAME)}
      ${whereClause}
    `);
    return rows[0]?.total ?? 0;
  }
}

export const snapshotOutstandingFilterFactsRepository = new SnapshotOutstandingFilterFactsRepository();
