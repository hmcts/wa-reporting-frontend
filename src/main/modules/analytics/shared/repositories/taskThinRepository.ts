import { Prisma } from '@prisma/client';

import { tmPrisma } from '../data/prisma';
import { CriticalTasksSortBy } from '../outstandingSort';
import { MAX_PAGINATION_RESULTS, getMaxPaginationPage, normalisePage } from '../pagination';
import { priorityRankSql } from '../priority/priorityRankSql';
import { AnalyticsFilters } from '../types';
import { AssignedSortBy, CompletedSortBy, SortDirection, SortState } from '../userOverviewSort';

import { AnalyticsQueryOptions, buildAnalyticsWhere } from './filters';
import { asOfSnapshotCondition } from './snapshotSql';
import {
  CompletedTaskAuditRow,
  FilterValueRow,
  OutstandingCriticalTaskRow,
  UserOverviewCompletedByDateRow,
  UserOverviewCompletedByTaskNameRow,
  UserOverviewTaskRow,
  WaitTimeRow,
} from './types';

type PaginationOptions = {
  page: number;
  pageSize: number;
};

const WITHIN_DUE_SORT_SQL = Prisma.sql`within_due_sort_value`;
const OPEN_TASK_ROWS_TABLE = 'analytics.snapshot_open_task_rows';
const COMPLETED_TASK_ROWS_TABLE = 'analytics.snapshot_completed_task_rows';
const OUTSTANDING_FILTER_FACTS_TABLE = 'analytics.snapshot_outstanding_filter_facts';
const ROWS_ALIAS = 'rows';

function qualifiedColumn(column: string, tableAlias = ROWS_ALIAS): Prisma.Sql {
  return Prisma.raw(`${tableAlias}.${column}`);
}

function buildPriorityRank(tableAlias = ROWS_ALIAS): Prisma.Sql {
  return priorityRankSql({
    priorityColumn: qualifiedColumn('major_priority', tableAlias),
    dateColumn: qualifiedColumn('due_date', tableAlias),
  });
}

function applyCompletedDateFilters(filters: AnalyticsFilters, conditions: Prisma.Sql[]): void {
  if (filters.completedFrom) {
    conditions.push(Prisma.sql`completed_date >= ${filters.completedFrom}`);
  }
  if (filters.completedTo) {
    conditions.push(Prisma.sql`completed_date <= ${filters.completedTo}`);
  }
}

function buildCompletedTaskConditions(filters: AnalyticsFilters, caseId?: string): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [Prisma.sql`LOWER(termination_reason) = 'completed'`];
  applyCompletedDateFilters(filters, conditions);
  if (caseId) {
    conditions.push(Prisma.sql`case_id = ${caseId}`);
  }
  return conditions;
}

function buildCompletedRowConditions(filters: AnalyticsFilters, caseId?: string): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];
  applyCompletedDateFilters(filters, conditions);
  if (caseId) {
    conditions.push(Prisma.sql`case_id = ${caseId}`);
  }
  return conditions;
}

function buildPaginationClauses(pagination?: PaginationOptions | null): {
  limitClause: Prisma.Sql;
  offsetClause: Prisma.Sql;
} {
  if (!pagination) {
    return { limitClause: Prisma.empty, offsetClause: Prisma.empty };
  }
  const pageSize = Number.isFinite(pagination.pageSize)
    ? Math.min(Math.max(Math.floor(pagination.pageSize), 1), MAX_PAGINATION_RESULTS)
    : 1;
  const maxPage = getMaxPaginationPage(pageSize);
  const page = normalisePage(pagination.page, maxPage);
  const offset = (page - 1) * pageSize;
  return {
    limitClause: Prisma.sql`LIMIT ${pageSize}`,
    offsetClause: Prisma.sql`OFFSET ${offset}`,
  };
}

function buildOpenUserOverviewTaskQuery(
  whereClause: Prisma.Sql,
  orderBy: Prisma.Sql,
  pagination?: PaginationOptions | null
): Prisma.Sql {
  const priorityRank = buildPriorityRank();
  const { limitClause, offsetClause } = buildPaginationClauses(pagination);

  return Prisma.sql`
    SELECT
      case_id,
      task_id,
      task_name,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      to_char(created_date, 'YYYY-MM-DD') AS created_date,
      to_char(first_assigned_date, 'YYYY-MM-DD') AS first_assigned_date,
      to_char(due_date, 'YYYY-MM-DD') AS due_date,
      NULL::text AS completed_date,
      NULL::double precision AS handling_time_days,
      NULL::text AS is_within_sla,
      ${priorityRank} AS priority_rank,
      assignee,
      number_of_reassignments
    FROM ${Prisma.raw(OPEN_TASK_ROWS_TABLE)} rows
    ${whereClause}
    ORDER BY ${orderBy}
    ${limitClause}
    ${offsetClause}
  `;
}

function buildCompletedUserOverviewTaskQuery(
  whereClause: Prisma.Sql,
  orderBy: Prisma.Sql,
  pagination?: PaginationOptions | null
): Prisma.Sql {
  const priorityRank = buildPriorityRank();
  const { limitClause, offsetClause } = buildPaginationClauses(pagination);

  return Prisma.sql`
    SELECT
      case_id,
      task_id,
      task_name,
      jurisdiction_label,
      role_category_label,
      region,
      location,
      to_char(created_date, 'YYYY-MM-DD') AS created_date,
      to_char(first_assigned_date, 'YYYY-MM-DD') AS first_assigned_date,
      to_char(due_date, 'YYYY-MM-DD') AS due_date,
      to_char(completed_date, 'YYYY-MM-DD') AS completed_date,
      handling_time_days,
      is_within_sla,
      ${priorityRank} AS priority_rank,
      assignee,
      number_of_reassignments
    FROM ${Prisma.raw(COMPLETED_TASK_ROWS_TABLE)} rows
    ${whereClause}
    ORDER BY ${orderBy}
    ${limitClause}
    ${offsetClause}
  `;
}

function directionSql(direction: SortDirection): Prisma.Sql {
  return Prisma.raw(direction === 'asc' ? 'ASC' : 'DESC');
}

function buildAssignedOrderBy(sort: SortState<AssignedSortBy>): Prisma.Sql {
  const column = (() => {
    switch (sort.by) {
      case 'caseId':
        return Prisma.sql`case_id`;
      case 'createdDate':
        return qualifiedColumn('created_date');
      case 'taskName':
        return Prisma.sql`task_name`;
      case 'assignedDate':
        return qualifiedColumn('first_assigned_date');
      case 'dueDate':
        return qualifiedColumn('due_date');
      case 'priority':
        return buildPriorityRank();
      case 'totalAssignments':
        return Prisma.sql`COALESCE(number_of_reassignments, 0) + 1`;
      case 'assignee':
        return Prisma.sql`assignee`;
      case 'location':
        return Prisma.sql`location`;
      default:
        return qualifiedColumn('created_date');
    }
  })();

  return Prisma.sql`${column} ${directionSql(sort.dir)} NULLS LAST`;
}

function buildCompletedOrderBy(sort: SortState<CompletedSortBy>): Prisma.Sql {
  const column = (() => {
    switch (sort.by) {
      case 'caseId':
        return Prisma.sql`case_id`;
      case 'createdDate':
        return qualifiedColumn('created_date');
      case 'taskName':
        return Prisma.sql`task_name`;
      case 'assignedDate':
        return qualifiedColumn('first_assigned_date');
      case 'dueDate':
        return qualifiedColumn('due_date');
      case 'completedDate':
        return qualifiedColumn('completed_date');
      case 'handlingTimeDays':
        return Prisma.sql`handling_time_days`;
      case 'withinDue':
        return WITHIN_DUE_SORT_SQL;
      case 'totalAssignments':
        return Prisma.sql`COALESCE(number_of_reassignments, 0) + 1`;
      case 'assignee':
        return Prisma.sql`assignee`;
      case 'location':
        return Prisma.sql`location`;
      default:
        return qualifiedColumn('completed_date');
    }
  })();

  return Prisma.sql`${column} ${directionSql(sort.dir)} NULLS LAST`;
}

function buildCriticalTasksOrderBy(sort: SortState<CriticalTasksSortBy>): Prisma.Sql {
  const column = (() => {
    switch (sort.by) {
      case 'caseId':
        return Prisma.sql`case_id`;
      case 'caseType':
        return Prisma.sql`case_type_label`;
      case 'location':
        return Prisma.sql`location`;
      case 'taskName':
        return Prisma.sql`task_name`;
      case 'createdDate':
        return qualifiedColumn('created_date');
      case 'dueDate':
        return qualifiedColumn('due_date');
      case 'priority':
        return priorityRankSql({
          priorityColumn: qualifiedColumn('major_priority'),
          dateColumn: qualifiedColumn('due_date'),
        });
      case 'agentName':
        return Prisma.sql`assignee`;
      default:
        return qualifiedColumn('due_date');
    }
  })();

  return Prisma.sql`${column} ${directionSql(sort.dir)} NULLS LAST`;
}

function buildUserOverviewWhere(
  snapshotId: number,
  filters: AnalyticsFilters,
  baseConditions: Prisma.Sql[],
  queryOptions?: AnalyticsQueryOptions
): Prisma.Sql {
  const whereClause = buildAnalyticsWhere(
    filters,
    [asOfSnapshotCondition(snapshotId), ...baseConditions],
    queryOptions
  );
  if (!filters.user || filters.user.length === 0) {
    return whereClause;
  }
  const userCondition = Prisma.sql`assignee IN (${Prisma.join(filters.user)})`;
  if (whereClause.sql) {
    return Prisma.sql`${whereClause} AND ${userCondition}`;
  }
  return Prisma.sql`WHERE ${userCondition}`;
}

function buildUserOverviewCompletedFactsWhere(
  snapshotId: number,
  filters: AnalyticsFilters,
  queryOptions?: AnalyticsQueryOptions
): Prisma.Sql {
  const conditions: Prisma.Sql[] = [asOfSnapshotCondition(snapshotId)];
  applyCompletedDateFilters(filters, conditions);
  if (filters.user && filters.user.length > 0) {
    conditions.push(Prisma.sql`assignee IN (${Prisma.join(filters.user)})`);
  }
  return buildAnalyticsWhere(filters, conditions, queryOptions);
}

export class TaskThinRepository {
  async fetchUserOverviewAssignedTaskRows(
    snapshotId: number,
    filters: AnalyticsFilters,
    sort: SortState<AssignedSortBy>,
    pagination?: PaginationOptions | null,
    queryOptions?: AnalyticsQueryOptions
  ): Promise<UserOverviewTaskRow[]> {
    const whereClause = buildUserOverviewWhere(snapshotId, filters, [Prisma.sql`state = 'ASSIGNED'`], queryOptions);
    const orderBy = buildAssignedOrderBy(sort);

    return tmPrisma.$queryRaw<UserOverviewTaskRow[]>(buildOpenUserOverviewTaskQuery(whereClause, orderBy, pagination));
  }

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
      buildCompletedUserOverviewTaskQuery(whereClause, orderBy, pagination)
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
      FROM ${Prisma.raw(OPEN_TASK_ROWS_TABLE)}
      ${whereClause}
    `);
    return rows[0]?.total ?? 0;
  }

  async fetchUserOverviewCompletedTaskCount(
    snapshotId: number,
    filters: AnalyticsFilters,
    queryOptions?: AnalyticsQueryOptions
  ): Promise<number> {
    const conditions = buildCompletedRowConditions(filters);
    const whereClause = buildUserOverviewWhere(snapshotId, filters, conditions, queryOptions);
    const rows = await tmPrisma.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM ${Prisma.raw(COMPLETED_TASK_ROWS_TABLE)}
      ${whereClause}
    `);
    return rows[0]?.total ?? 0;
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
      FROM analytics.snapshot_user_completed_facts
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
      FROM analytics.snapshot_user_completed_facts
      ${whereClause}
      GROUP BY task_name
      ORDER BY tasks DESC NULLS LAST, task_name ASC
    `);
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
      FROM ${Prisma.raw(COMPLETED_TASK_ROWS_TABLE)} rows
      ${whereClause}
      ORDER BY rows.completed_date DESC NULLS LAST
    `);
  }

  async fetchOutstandingCriticalTaskRows(
    snapshotId: number,
    filters: AnalyticsFilters,
    sort: SortState<CriticalTasksSortBy>,
    pagination: PaginationOptions
  ): Promise<OutstandingCriticalTaskRow[]> {
    const priorityRank = buildPriorityRank();
    const whereClause = buildAnalyticsWhere(filters, [
      asOfSnapshotCondition(snapshotId),
      Prisma.sql`state NOT IN ('COMPLETED', 'TERMINATED')`,
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
      FROM ${Prisma.raw(OPEN_TASK_ROWS_TABLE)} rows
      ${whereClause}
      ORDER BY ${orderBy}
      ${limitClause}
      ${offsetClause}
    `);
  }

  async fetchOutstandingCriticalTaskCount(snapshotId: number, filters: AnalyticsFilters): Promise<number> {
    const whereClause = buildAnalyticsWhere(filters, [asOfSnapshotCondition(snapshotId)]);
    const rows = await tmPrisma.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT COALESCE(SUM(row_count), 0)::int AS total
      FROM ${Prisma.raw(OUTSTANDING_FILTER_FACTS_TABLE)}
      ${whereClause}
    `);
    return rows[0]?.total ?? 0;
  }

  async fetchWaitTimeByAssignedDateRows(snapshotId: number, filters: AnalyticsFilters): Promise<WaitTimeRow[]> {
    const whereClause = buildAnalyticsWhere(filters, [asOfSnapshotCondition(snapshotId)]);

    return tmPrisma.$queryRaw<WaitTimeRow[]>(Prisma.sql`
      SELECT
        to_char(reference_date, 'YYYY-MM-DD') AS date_key,
        CASE
          WHEN SUM(assigned_task_count) = 0 THEN 0
          ELSE SUM(total_wait_time_days_sum)::double precision / SUM(assigned_task_count)::double precision
        END::double precision AS avg_wait_time_days,
        SUM(assigned_task_count)::int AS assigned_task_count
      FROM analytics.snapshot_wait_time_by_assigned_date
      ${whereClause}
      GROUP BY reference_date
      ORDER BY reference_date
    `);
  }

  async fetchAssigneeIds(snapshotId: number): Promise<string[]> {
    const rows = await tmPrisma.$queryRaw<FilterValueRow[]>(Prisma.sql`
      SELECT DISTINCT value
      FROM (
        SELECT assignee AS value
        FROM ${Prisma.raw(OPEN_TASK_ROWS_TABLE)}
        WHERE ${asOfSnapshotCondition(snapshotId)}
        UNION
        SELECT assignee AS value
        FROM ${Prisma.raw(COMPLETED_TASK_ROWS_TABLE)}
        WHERE ${asOfSnapshotCondition(snapshotId)}
      ) assignees
      WHERE value IS NOT NULL
      ORDER BY value
    `);

    return rows.map(row => row.value);
  }
}

export const __testing = {
  buildUserOverviewWhere,
  buildCompletedTaskConditions,
  buildCompletedRowConditions,
};

export const taskThinRepository = new TaskThinRepository();
