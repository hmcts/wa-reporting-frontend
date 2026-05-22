import { Prisma } from '@prisma/client';

import { tmPrisma } from '../data/prisma';
import { AnalyticsFilters } from '../types';

import { buildAnalyticsWhere } from './filters';
import { asOfSnapshotCondition } from './snapshotSql';
import { AssignmentRow } from './types';

const TABLE_NAME = 'analytics.snapshot_outstanding_created_assignment_daily_facts';

export class SnapshotOutstandingCreatedAssignmentDailyFactsRepository {
  async fetchOpenTasksCreatedByAssignmentRows(snapshotId: number, filters: AnalyticsFilters): Promise<AssignmentRow[]> {
    const whereClause = buildAnalyticsWhere(filters, [asOfSnapshotCondition(snapshotId)]);

    return tmPrisma.$queryRaw<AssignmentRow[]>(Prisma.sql`
      SELECT
        to_char(reference_date, 'YYYY-MM-DD') AS date_key,
        assignment_state,
        SUM(task_count)::int AS total
      FROM ${Prisma.raw(TABLE_NAME)}
      ${whereClause}
      GROUP BY reference_date, assignment_state
      ORDER BY reference_date
    `);
  }
}

export const snapshotOutstandingCreatedAssignmentDailyFactsRepository =
  new SnapshotOutstandingCreatedAssignmentDailyFactsRepository();
