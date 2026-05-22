import { Prisma } from '@prisma/client';

import { tmPrisma } from '../data/prisma';
import { AnalyticsFilters } from '../types';
import { CompletedSortBy, SortState } from '../userOverviewSort';

import { AnalyticsQueryOptions, buildAnalyticsWhere } from './filters';
import {
  PaginationOptions,
  buildCompletedOrderBy,
  buildCompletedRowConditions,
  buildCompletedUserOverviewTaskQuery,
  buildUserOverviewWhere,
} from './rowRepositoryHelpers';
import { asOfSnapshotCondition } from './snapshotSql';
import { CompletedTaskAuditRow, UserOverviewTaskRow } from './types';

const TABLE_NAME = 'analytics.snapshot_completed_task_rows';

export class SnapshotCompletedTaskRowsRepository {
  async fetchUserOverviewCompletedTaskRows(
    snapshotId: number,
    filters: AnalyticsFilters,
    sort: SortState<CompletedSortBy>,
    pagination?: PaginationOptions | null,
    queryOptions?: AnalyticsQueryOptions
  ): Promise<UserOverviewTaskRow[]> {
    const conditions = buildCompletedRowConditions(filters);
    const whereClause = buildUserOverviewWhere(snapshotId, filters, conditions, queryOptions);
    const orderBy = buildCompletedOrderBy(sort);

    return tmPrisma.$queryRaw<UserOverviewTaskRow[]>(
      buildCompletedUserOverviewTaskQuery(TABLE_NAME, whereClause, orderBy, pagination)
    );
  }

  async fetchCompletedTaskAuditRows(
    snapshotId: number,
    filters: AnalyticsFilters,
    caseId?: string
  ): Promise<CompletedTaskAuditRow[]> {
    const conditions = [asOfSnapshotCondition(snapshotId), ...buildCompletedRowConditions(filters, caseId)];
    const whereClause = buildAnalyticsWhere(filters, conditions);

    return tmPrisma.$queryRaw<CompletedTaskAuditRow[]>(Prisma.sql`
      SELECT
        case_id,
        task_name,
        assignee,
        to_char(completed_date, 'YYYY-MM-DD') AS completed_date,
        number_of_reassignments,
        location,
        termination_process_label,
        outcome
      FROM ${Prisma.raw(TABLE_NAME)} rows
      ${whereClause}
      ORDER BY rows.completed_date DESC
    `);
  }
}

export const snapshotCompletedTaskRowsRepository = new SnapshotCompletedTaskRowsRepository();
