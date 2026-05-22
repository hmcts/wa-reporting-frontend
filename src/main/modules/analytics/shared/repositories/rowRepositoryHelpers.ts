import { Prisma } from '@prisma/client';

import { CriticalTasksSortBy } from '../outstandingSort';
import { MAX_PAGINATION_RESULTS, getMaxPaginationPage, normalisePage } from '../pagination';
import { priorityRankSql } from '../priority/priorityRankSql';
import { AnalyticsFilters } from '../types';
import { AssignedSortBy, CompletedSortBy, SortDirection, SortState } from '../userOverviewSort';

import { AnalyticsQueryOptions, buildAnalyticsWhere } from './filters';
import { asOfSnapshotCondition } from './snapshotSql';

export type PaginationOptions = {
  page: number;
  pageSize: number;
};

const WITHIN_DUE_SORT_SQL = Prisma.sql`within_due_sort_value`;
const ROWS_ALIAS = 'rows';

function qualifiedColumn(column: string, tableAlias = ROWS_ALIAS): Prisma.Sql {
  return Prisma.raw(`${tableAlias}.${column}`);
}

export function buildOpenTaskPriorityRank(tableAlias = ROWS_ALIAS): Prisma.Sql {
  return priorityRankSql({
    priorityColumn: qualifiedColumn('major_priority', tableAlias),
    dateColumn: qualifiedColumn('due_date', tableAlias),
  });
}

export function applyCompletedDateFilters(filters: AnalyticsFilters, conditions: Prisma.Sql[]): void {
  if (filters.completedFrom) {
    conditions.push(Prisma.sql`completed_date >= ${filters.completedFrom}`);
  }
  if (filters.completedTo) {
    conditions.push(Prisma.sql`completed_date <= ${filters.completedTo}`);
  }
}

export function buildCompletedRowConditions(filters: AnalyticsFilters, caseId?: string): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];
  applyCompletedDateFilters(filters, conditions);
  if (caseId) {
    conditions.push(Prisma.sql`case_id = ${caseId}`);
  }
  return conditions;
}

export function buildPaginationClauses(pagination?: PaginationOptions | null): {
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

export function buildOpenUserOverviewTaskQuery(
  tableName: string,
  whereClause: Prisma.Sql,
  orderBy: Prisma.Sql,
  pagination?: PaginationOptions | null
): Prisma.Sql {
  const priorityRank = buildOpenTaskPriorityRank();
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
    FROM ${Prisma.raw(tableName)} rows
    ${whereClause}
    ORDER BY ${orderBy}
    ${limitClause}
    ${offsetClause}
  `;
}

export function buildCompletedUserOverviewTaskQuery(
  tableName: string,
  whereClause: Prisma.Sql,
  orderBy: Prisma.Sql,
  pagination?: PaginationOptions | null
): Prisma.Sql {
  const priorityRank = buildOpenTaskPriorityRank();
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
    FROM ${Prisma.raw(tableName)} rows
    ${whereClause}
    ORDER BY ${orderBy}
    ${limitClause}
    ${offsetClause}
  `;
}

function directionSql(direction: SortDirection): Prisma.Sql {
  return Prisma.raw(direction === 'asc' ? 'ASC' : 'DESC');
}

export function buildAssignedOrderBy(sort: SortState<AssignedSortBy>): Prisma.Sql {
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
        return buildOpenTaskPriorityRank();
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

  return Prisma.sql`${column} ${directionSql(sort.dir)}`;
}

export function buildCompletedOrderBy(sort: SortState<CompletedSortBy>): Prisma.Sql {
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

  return Prisma.sql`${column} ${directionSql(sort.dir)}`;
}

export function buildCriticalTasksOrderBy(sort: SortState<CriticalTasksSortBy>): Prisma.Sql {
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

  return Prisma.sql`${column} ${directionSql(sort.dir)}`;
}

export function buildUserOverviewWhere(
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

export function buildUserOverviewCompletedFactsWhere(
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
