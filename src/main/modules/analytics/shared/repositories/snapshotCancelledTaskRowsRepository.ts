import { Prisma } from '@prisma/client';

import { tmPrisma } from '../data/prisma';
import { AnalyticsFilters } from '../types';

import { buildAnalyticsWhere } from './filters';
import { asOfSnapshotCondition } from './snapshotSql';
import { CompletedTaskAuditRow } from './types';

const TABLE_NAME = 'analytics.snapshot_cancelled_task_rows';

export class SnapshotCancelledTaskRowsRepository {
  async fetchCancelledTaskAuditRows(
    snapshotId: number,
    filters: AnalyticsFilters,
    caseId?: string
  ): Promise<CompletedTaskAuditRow[]> {
    const conditions = [asOfSnapshotCondition(snapshotId)];
    if (filters.completedFrom) {
      conditions.push(Prisma.sql`last_updated_date >= ${filters.completedFrom}`);
    }
    if (filters.completedTo) {
      conditions.push(Prisma.sql`last_updated_date <= ${filters.completedTo}`);
    }
    if (caseId) {
      conditions.push(Prisma.sql`case_id = ${caseId}`);
    }
    const whereClause = buildAnalyticsWhere(filters, conditions);

    return tmPrisma.$queryRaw<CompletedTaskAuditRow[]>(Prisma.sql`
      SELECT
        case_id,
        task_name,
        assignee,
        to_char(last_updated_date, 'YYYY-MM-DD') AS completed_date,
        number_of_reassignments,
        location,
        termination_process_label,
        outcome
      FROM ${Prisma.raw(TABLE_NAME)} rows
      ${whereClause}
      ORDER BY rows.last_updated_date DESC
    `);
  }
}

export const snapshotCancelledTaskRowsRepository = new SnapshotCancelledTaskRowsRepository();
