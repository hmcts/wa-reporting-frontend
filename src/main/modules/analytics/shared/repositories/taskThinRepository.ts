import { Prisma } from '@prisma/client';

import { tmPrisma } from '../data/prisma';
import { CriticalTasksSortBy } from '../outstandingSort';
import { priorityBucketSql } from '../priority/priorityBucketSql';
import { AnalyticsFilters } from '../types';
import { AssignedSortBy, CompletedSortBy, SortDirection, SortState } from '../userOverviewSort';

import { buildAnalyticsWhere } from './filters';
import {
  CompletedTaskAuditRow,
  FilterValueRow,
  OpenTasksByNameRow,
  OpenTasksByRegionLocationRow,
  OutstandingCriticalTaskRow,
  SummaryTotalsRow,
  TasksDueRow,
  UserOverviewCompletedByDateRow,
  UserOverviewCompletedByTaskNameRow,
  UserOverviewTaskRow,
  WaitTimeRow,
} from './types';

const CRITICAL_TASKS_LIMIT = 5000;
const USER_OVERVIEW_TASKS_LIMIT = 5000;

const PRIORITY_SORT_SQL = Prisma.sql`CASE
  WHEN major_priority <= 2000 THEN 4
  WHEN major_priority < 5000 THEN 3
  WHEN major_priority = 5000 AND due_date < CURRENT_DATE THEN 3
  WHEN major_priority = 5000 AND due_date = CURRENT_DATE THEN 2
  ELSE 1
END`;

const WITHIN_DUE_SORT_SQL = Prisma.sql`CASE
  WHEN is_within_sla = 'Yes' THEN 1
  WHEN is_within_sla = 'No' THEN 2
  ELSE 3
END`;

function directionSql(direction: SortDirection): Prisma.Sql {
  return Prisma.raw(direction === 'asc' ? 'ASC' : 'DESC');
}

function buildAssignedOrderBy(sort: SortState<AssignedSortBy>): Prisma.Sql {
  const column = (() => {
    switch (sort.by) {
      case 'caseId':
        return Prisma.sql`case_id`;
      case 'createdDate':
        return Prisma.raw('created_date');
      case 'taskName':
        return Prisma.sql`task_name`;
      case 'assignedDate':
        return Prisma.raw('first_assigned_date');
      case 'dueDate':
        return Prisma.raw('due_date');
      case 'priority':
        return PRIORITY_SORT_SQL;
      case 'totalAssignments':
        return Prisma.sql`COALESCE(number_of_reassignments, 0) + 1`;
      case 'assignee':
        return Prisma.sql`assignee`;
      case 'location':
        return Prisma.sql`location`;
      default:
        return Prisma.raw('created_date');
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
        return Prisma.raw('created_date');
      case 'taskName':
        return Prisma.sql`task_name`;
      case 'assignedDate':
        return Prisma.raw('first_assigned_date');
      case 'dueDate':
        return Prisma.raw('due_date');
      case 'completedDate':
        return Prisma.raw('completed_date');
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
        return Prisma.raw('completed_date');
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
        return Prisma.raw('created_date');
      case 'dueDate':
        return Prisma.raw('due_date');
      case 'priority':
        return PRIORITY_SORT_SQL;
      case 'agentName':
        return Prisma.sql`assignee`;
      default:
        return Prisma.raw('due_date');
    }
  })();

  return Prisma.sql`${column} ${directionSql(sort.dir)} NULLS LAST`;
}

function buildUserOverviewWhere(filters: AnalyticsFilters, baseConditions: Prisma.Sql[]): Prisma.Sql {
  const whereClause = buildAnalyticsWhere(filters, baseConditions);
  if (!filters.user || filters.user.length === 0) {
    return whereClause;
  }
  const userCondition = Prisma.sql`assignee IN (${Prisma.join(filters.user)})`;
  if (whereClause.sql) {
    return Prisma.sql`${whereClause} AND ${userCondition}`;
  }
  return Prisma.sql`WHERE ${userCondition}`;
}

export class TaskThinRepository {
  async fetchUserOverviewAssignedTaskRows(
    filters: AnalyticsFilters,
    sort: SortState<AssignedSortBy>,
    limit: number | null = USER_OVERVIEW_TASKS_LIMIT
  ): Promise<UserOverviewTaskRow[]> {
    const priorityBucket = priorityBucketSql({
      priorityColumn: Prisma.raw('major_priority'),
      dateColumn: Prisma.raw('due_date'),
      labels: { urgent: 'urgent', high: 'high', medium: 'medium', low: 'low' },
    });
    const whereClause = buildUserOverviewWhere(filters, [Prisma.sql`state = 'ASSIGNED'`]);
    const orderBy = buildAssignedOrderBy(sort);
    const limitClause = limit === null ? Prisma.empty : Prisma.sql`LIMIT ${limit}`;

    return tmPrisma.$queryRaw<UserOverviewTaskRow[]>(Prisma.sql`
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
        ${priorityBucket} AS priority,
        assignee,
        number_of_reassignments
      FROM analytics.mv_reportable_task_thin
      ${whereClause}
      ORDER BY ${orderBy}
      ${limitClause}
    `);
  }

  async fetchUserOverviewCompletedTaskRows(
    filters: AnalyticsFilters,
    sort: SortState<CompletedSortBy>,
    limit: number | null = USER_OVERVIEW_TASKS_LIMIT
  ): Promise<UserOverviewTaskRow[]> {
    const priorityBucket = priorityBucketSql({
      priorityColumn: Prisma.raw('major_priority'),
      dateColumn: Prisma.raw('due_date'),
      labels: { urgent: 'urgent', high: 'high', medium: 'medium', low: 'low' },
    });
    const conditions: Prisma.Sql[] = [
      Prisma.sql`termination_reason = 'completed'`,
      Prisma.sql`state IN ('COMPLETED', 'TERMINATED')`,
    ];
    if (filters.completedFrom) {
      conditions.push(Prisma.sql`completed_date >= ${filters.completedFrom}`);
    }
    if (filters.completedTo) {
      conditions.push(Prisma.sql`completed_date <= ${filters.completedTo}`);
    }
    const whereClause = buildUserOverviewWhere(filters, conditions);
    const orderBy = buildCompletedOrderBy(sort);
    const limitClause = limit === null ? Prisma.empty : Prisma.sql`LIMIT ${limit}`;

    return tmPrisma.$queryRaw<UserOverviewTaskRow[]>(Prisma.sql`
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
        ${priorityBucket} AS priority,
        assignee,
        number_of_reassignments
      FROM analytics.mv_reportable_task_thin
      ${whereClause}
      ORDER BY ${orderBy}
      ${limitClause}
    `);
  }

  async fetchUserOverviewCompletedByDateRows(filters: AnalyticsFilters): Promise<UserOverviewCompletedByDateRow[]> {
    const conditions: Prisma.Sql[] = [Prisma.sql`completed_date IS NOT NULL`];
    if (filters.completedFrom) {
      conditions.push(Prisma.sql`completed_date >= ${filters.completedFrom}`);
    }
    if (filters.completedTo) {
      conditions.push(Prisma.sql`completed_date <= ${filters.completedTo}`);
    }
    if (filters.user && filters.user.length > 0) {
      conditions.push(Prisma.sql`assignee IN (${Prisma.join(filters.user)})`);
    }
    const whereClause = buildAnalyticsWhere(filters, conditions);

    return tmPrisma.$queryRaw<UserOverviewCompletedByDateRow[]>(Prisma.sql`
      SELECT
        to_char(completed_date, 'YYYY-MM-DD') AS date_key,
        SUM(tasks)::int AS tasks,
        SUM(within_due)::int AS within_due,
        SUM(beyond_due)::int AS beyond_due,
        SUM(handling_time_sum)::numeric AS handling_time_sum,
        SUM(handling_time_count)::int AS handling_time_count
      FROM analytics.mv_user_completed_facts
      ${whereClause}
      GROUP BY completed_date
      ORDER BY completed_date
    `);
  }

  async fetchUserOverviewCompletedByTaskNameRows(
    filters: AnalyticsFilters
  ): Promise<UserOverviewCompletedByTaskNameRow[]> {
    const conditions: Prisma.Sql[] = [Prisma.sql`completed_date IS NOT NULL`];
    if (filters.completedFrom) {
      conditions.push(Prisma.sql`completed_date >= ${filters.completedFrom}`);
    }
    if (filters.completedTo) {
      conditions.push(Prisma.sql`completed_date <= ${filters.completedTo}`);
    }
    if (filters.user && filters.user.length > 0) {
      conditions.push(Prisma.sql`assignee IN (${Prisma.join(filters.user)})`);
    }
    const whereClause = buildAnalyticsWhere(filters, conditions);

    return tmPrisma.$queryRaw<UserOverviewCompletedByTaskNameRow[]>(Prisma.sql`
      SELECT
        task_name,
        SUM(tasks)::int AS tasks,
        SUM(handling_time_sum)::numeric AS handling_time_sum,
        SUM(handling_time_count)::int AS handling_time_count,
        SUM(days_beyond_sum)::numeric AS days_beyond_sum,
        SUM(days_beyond_count)::int AS days_beyond_count
      FROM analytics.mv_user_completed_facts
      ${whereClause}
      GROUP BY task_name
      ORDER BY tasks DESC NULLS LAST, task_name ASC
    `);
  }

  async fetchCompletedTaskAuditRows(filters: AnalyticsFilters, caseId?: string): Promise<CompletedTaskAuditRow[]> {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`termination_reason = 'completed'`,
      Prisma.sql`state IN ('COMPLETED', 'TERMINATED')`,
    ];
    if (filters.completedFrom) {
      conditions.push(Prisma.sql`completed_date >= ${filters.completedFrom}`);
    }
    if (filters.completedTo) {
      conditions.push(Prisma.sql`completed_date <= ${filters.completedTo}`);
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
        to_char(completed_date, 'YYYY-MM-DD') AS completed_date,
        number_of_reassignments,
        location,
        termination_process_label
      FROM analytics.mv_reportable_task_thin
      ${whereClause}
      ORDER BY completed_date DESC NULLS LAST
    `);
  }

  async fetchOutstandingCriticalTaskRows(
    filters: AnalyticsFilters,
    sort: SortState<CriticalTasksSortBy>
  ): Promise<OutstandingCriticalTaskRow[]> {
    const priorityBucket = priorityBucketSql({
      priorityColumn: Prisma.raw('major_priority'),
      dateColumn: Prisma.raw('due_date'),
      labels: { urgent: 'urgent', high: 'high', medium: 'medium', low: 'low' },
    });
    const whereClause = buildAnalyticsWhere(filters, [Prisma.sql`state NOT IN ('COMPLETED', 'TERMINATED')`]);
    const orderBy = buildCriticalTasksOrderBy(sort);

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
        ${priorityBucket} AS priority,
        assignee
      FROM analytics.mv_reportable_task_thin
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${CRITICAL_TASKS_LIMIT}
    `);
  }

  async fetchOpenTasksByNameRows(filters: AnalyticsFilters): Promise<OpenTasksByNameRow[]> {
    const whereClause = buildAnalyticsWhere(filters, [
      Prisma.sql`priority_bucket IN ('Urgent', 'High', 'Medium', 'Low')`,
    ]);

    return tmPrisma.$queryRaw<OpenTasksByNameRow[]>(Prisma.sql`
      SELECT
        task_name,
        SUM(CASE WHEN priority_bucket = 'Urgent' THEN task_count ELSE 0 END)::int AS urgent,
        SUM(CASE WHEN priority_bucket = 'High' THEN task_count ELSE 0 END)::int AS high,
        SUM(CASE WHEN priority_bucket = 'Medium' THEN task_count ELSE 0 END)::int AS medium,
        SUM(CASE WHEN priority_bucket = 'Low' THEN task_count ELSE 0 END)::int AS low
      FROM analytics.mv_open_tasks_by_name
      ${whereClause}
      GROUP BY task_name
    `);
  }

  async fetchOpenTasksByRegionLocationRows(filters: AnalyticsFilters): Promise<OpenTasksByRegionLocationRow[]> {
    const whereClause = buildAnalyticsWhere(filters, []);

    return tmPrisma.$queryRaw<OpenTasksByRegionLocationRow[]>(Prisma.sql`
      SELECT
        region,
        location,
        SUM(task_count)::int AS open_tasks,
        SUM(CASE WHEN priority_bucket = 'Urgent' THEN task_count ELSE 0 END)::int AS urgent,
        SUM(CASE WHEN priority_bucket = 'High' THEN task_count ELSE 0 END)::int AS high,
        SUM(CASE WHEN priority_bucket = 'Medium' THEN task_count ELSE 0 END)::int AS medium,
        SUM(CASE WHEN priority_bucket = 'Low' THEN task_count ELSE 0 END)::int AS low
      FROM analytics.mv_open_tasks_by_region_location
      ${whereClause}
      GROUP BY region, location
      ORDER BY location ASC, region ASC
    `);
  }

  async fetchOpenTasksSummaryRows(filters: AnalyticsFilters): Promise<SummaryTotalsRow[]> {
    const whereClause = buildAnalyticsWhere(filters, []);

    return tmPrisma.$queryRaw<SummaryTotalsRow[]>(Prisma.sql`
      SELECT
        SUM(CASE WHEN state = 'ASSIGNED' THEN task_count ELSE 0 END)::int AS assigned,
        SUM(CASE WHEN state = 'ASSIGNED' THEN 0 ELSE task_count END)::int AS unassigned,
        SUM(CASE WHEN priority_bucket = 'Urgent' THEN task_count ELSE 0 END)::int AS urgent,
        SUM(CASE WHEN priority_bucket = 'High' THEN task_count ELSE 0 END)::int AS high,
        SUM(CASE WHEN priority_bucket = 'Medium' THEN task_count ELSE 0 END)::int AS medium,
        SUM(CASE WHEN priority_bucket = 'Low' THEN task_count ELSE 0 END)::int AS low
      FROM analytics.mv_open_tasks_summary
      ${whereClause}
    `);
  }

  async fetchWaitTimeByAssignedDateRows(filters: AnalyticsFilters): Promise<WaitTimeRow[]> {
    const whereClause = buildAnalyticsWhere(filters, []);

    return tmPrisma.$queryRaw<WaitTimeRow[]>(Prisma.sql`
      SELECT
        to_char(reference_date, 'YYYY-MM-DD') AS date_key,
        CASE
          WHEN SUM(assigned_task_count) = 0 THEN 0
          ELSE SUM(total_wait_time_days) / SUM(assigned_task_count)::numeric
        END::double precision AS avg_wait_time_days,
        SUM(assigned_task_count)::int AS assigned_task_count
      FROM analytics.mv_open_tasks_wait_time_by_assigned_date
      ${whereClause}
      GROUP BY reference_date
      ORDER BY reference_date
    `);
  }

  async fetchTasksDueByDateRows(filters: AnalyticsFilters): Promise<TasksDueRow[]> {
    const whereClause = buildAnalyticsWhere(filters, [Prisma.sql`date_role = 'due'`]);

    return tmPrisma.$queryRaw<TasksDueRow[]>(Prisma.sql`
      SELECT
        to_char(reference_date, 'YYYY-MM-DD') AS date_key,
        SUM(
          CASE
            WHEN task_status = 'open' THEN task_count
            ELSE 0
          END
        )::int AS open,
        SUM(
          CASE
            WHEN task_status = 'completed' THEN task_count
            ELSE 0
          END
        )::int AS completed
      FROM analytics.mv_task_daily_facts
      ${whereClause}
      GROUP BY reference_date
      ORDER BY reference_date
    `);
  }

  async fetchAssigneeIds(): Promise<string[]> {
    const rows = await tmPrisma.$queryRaw<FilterValueRow[]>(Prisma.sql`
      SELECT DISTINCT assignee AS value
      FROM analytics.mv_reportable_task_thin
      WHERE assignee IS NOT NULL
      ORDER BY value
    `);

    return rows.map(row => row.value);
  }
}

export const taskThinRepository = new TaskThinRepository();
