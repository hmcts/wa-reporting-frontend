import { Prisma } from '@prisma/client';

import { tmPrisma } from '../data/prisma';
import { priorityBucketSql } from '../priority/priorityBucketSql';
import { priorityDisplayLabels } from '../priority/priorityLabels';
import { AnalyticsFilters } from '../types';

import { buildAnalyticsWhere } from './filters';
import {
  AssignmentRow,
  CompletedByLocationRow,
  CompletedByNameRow,
  CompletedByRegionRow,
  CompletedProcessingHandlingTimeRow,
  CompletedSummaryRow,
  CompletedTimelineRow,
  FilterValueRow,
  OverviewFilterOptionsRows,
  ServiceOverviewDbRow,
  TaskEventsByServiceDbRow,
  TasksDuePriorityRow,
} from './types';

export class TaskFactsRepository {
  async fetchServiceOverviewRows(filters: AnalyticsFilters): Promise<ServiceOverviewDbRow[]> {
    const whereClause = buildAnalyticsWhere(filters, [Prisma.sql`date_role = 'due'`, Prisma.sql`task_status = 'open'`]);
    const priorityBucket = priorityBucketSql({
      priorityColumn: Prisma.raw('priority'),
      dateColumn: Prisma.raw('reference_date'),
      labels: {
        urgent: priorityDisplayLabels.urgent,
        high: priorityDisplayLabels.high,
        medium: priorityDisplayLabels.medium,
        low: priorityDisplayLabels.low,
      },
    });

    return tmPrisma.$queryRaw<ServiceOverviewDbRow[]>(Prisma.sql`
      WITH bucketed AS (
        SELECT
          jurisdiction_label,
          assignment_state,
          task_count,
          ${priorityBucket} AS priority_bucket
        FROM analytics.mv_task_daily_facts
        ${whereClause}
      )
      SELECT
        jurisdiction_label AS service,
        SUM(task_count)::int AS open_tasks,
        SUM(CASE WHEN assignment_state = 'Assigned' THEN task_count ELSE 0 END)::int AS assigned_tasks,
        SUM(CASE WHEN priority_bucket = 'Urgent' THEN task_count ELSE 0 END)::int AS urgent,
        SUM(CASE WHEN priority_bucket = 'High' THEN task_count ELSE 0 END)::int AS high,
        SUM(CASE WHEN priority_bucket = 'Medium' THEN task_count ELSE 0 END)::int AS medium,
        SUM(CASE WHEN priority_bucket = 'Low' THEN task_count ELSE 0 END)::int AS low
      FROM bucketed
      GROUP BY jurisdiction_label
      ORDER BY service ASC
    `);
  }

  async fetchTaskEventsByServiceRows(
    filters: AnalyticsFilters,
    range: { from: Date; to: Date }
  ): Promise<TaskEventsByServiceDbRow[]> {
    const whereClause = buildAnalyticsWhere(filters, [
      Prisma.sql`reference_date >= ${range.from}`,
      Prisma.sql`reference_date <= ${range.to}`,
      Prisma.sql`date_role IN ('created', 'completed', 'cancelled')`,
    ]);

    return tmPrisma.$queryRaw<TaskEventsByServiceDbRow[]>(Prisma.sql`
      SELECT
        jurisdiction_label AS service,
        SUM(CASE WHEN date_role = 'completed' THEN task_count ELSE 0 END)::int AS completed,
        SUM(CASE WHEN date_role = 'cancelled' THEN task_count ELSE 0 END)::int AS cancelled,
        SUM(CASE WHEN date_role = 'created' THEN task_count ELSE 0 END)::int AS created
      FROM analytics.mv_task_daily_facts
      ${whereClause}
      GROUP BY jurisdiction_label
      ORDER BY service ASC
    `);
  }

  async fetchOverviewFilterOptionsRows(): Promise<OverviewFilterOptionsRows> {
    const [services, roleCategories, regions, locations, taskNames, assignees] = await Promise.all([
      tmPrisma.$queryRaw<FilterValueRow[]>(Prisma.sql`
        SELECT DISTINCT jurisdiction_label AS value
        FROM analytics.mv_task_daily_facts
        WHERE jurisdiction_label IS NOT NULL
        ORDER BY value
      `),
      tmPrisma.$queryRaw<FilterValueRow[]>(Prisma.sql`
        SELECT DISTINCT role_category_label AS value
        FROM analytics.mv_task_daily_facts
        WHERE role_category_label IS NOT NULL
        ORDER BY value
      `),
      tmPrisma.$queryRaw<FilterValueRow[]>(Prisma.sql`
        SELECT DISTINCT region AS value
        FROM analytics.mv_task_daily_facts
        WHERE region IS NOT NULL
        ORDER BY value
      `),
      tmPrisma.$queryRaw<FilterValueRow[]>(Prisma.sql`
        SELECT DISTINCT location AS value
        FROM analytics.mv_task_daily_facts
        WHERE location IS NOT NULL
        ORDER BY value
      `),
      tmPrisma.$queryRaw<FilterValueRow[]>(Prisma.sql`
        SELECT DISTINCT task_name AS value
        FROM analytics.mv_task_daily_facts
        WHERE task_name IS NOT NULL
        ORDER BY value
      `),
      tmPrisma.$queryRaw<FilterValueRow[]>(Prisma.sql`
        SELECT DISTINCT assignee AS value
        FROM analytics.mv_reportable_task_thin
        WHERE assignee IS NOT NULL
        ORDER BY value
      `),
    ]);

    return { services, roleCategories, regions, locations, taskNames, assignees };
  }

  async fetchOpenTasksCreatedByAssignmentRows(filters: AnalyticsFilters): Promise<AssignmentRow[]> {
    const whereClause = buildAnalyticsWhere(filters, [
      Prisma.sql`date_role = 'created'`,
      Prisma.sql`task_status = 'open'`,
    ]);

    return tmPrisma.$queryRaw<AssignmentRow[]>(Prisma.sql`
      SELECT
        to_char(reference_date, 'YYYY-MM-DD') AS date_key,
        assignment_state,
        SUM(task_count)::int AS total
      FROM analytics.mv_task_daily_facts
      ${whereClause}
      GROUP BY reference_date, assignment_state
      ORDER BY reference_date
    `);
  }

  async fetchTasksDuePriorityRows(filters: AnalyticsFilters): Promise<TasksDuePriorityRow[]> {
    const whereClause = buildAnalyticsWhere(filters, [Prisma.sql`date_role = 'due'`, Prisma.sql`task_status = 'open'`]);
    const priorityBucket = priorityBucketSql({
      priorityColumn: Prisma.raw('priority'),
      dateColumn: Prisma.raw('reference_date'),
      labels: {
        urgent: priorityDisplayLabels.urgent,
        high: priorityDisplayLabels.high,
        medium: priorityDisplayLabels.medium,
        low: priorityDisplayLabels.low,
      },
    });

    return tmPrisma.$queryRaw<TasksDuePriorityRow[]>(Prisma.sql`
      WITH bucketed AS (
        SELECT
          reference_date,
          task_count,
          ${priorityBucket} AS bucket
        FROM analytics.mv_task_daily_facts
        ${whereClause}
      )
      SELECT
        to_char(reference_date, 'YYYY-MM-DD') AS date_key,
        SUM(CASE WHEN bucket = 'Urgent' THEN task_count ELSE 0 END)::int AS urgent,
        SUM(CASE WHEN bucket = 'High' THEN task_count ELSE 0 END)::int AS high,
        SUM(CASE WHEN bucket = 'Medium' THEN task_count ELSE 0 END)::int AS medium,
        SUM(CASE WHEN bucket = 'Low' THEN task_count ELSE 0 END)::int AS low
      FROM bucketed
      GROUP BY reference_date
      ORDER BY reference_date
    `);
  }

  async fetchCompletedSummaryRows(
    filters: AnalyticsFilters,
    range?: { from?: Date; to?: Date }
  ): Promise<CompletedSummaryRow[]> {
    const conditions: Prisma.Sql[] = [Prisma.sql`date_role = 'completed'`, Prisma.sql`task_status = 'completed'`];
    if (range?.from) {
      conditions.push(Prisma.sql`reference_date >= ${range.from}`);
    }
    if (range?.to) {
      conditions.push(Prisma.sql`reference_date <= ${range.to}`);
    }
    const whereClause = buildAnalyticsWhere(filters, conditions);

    return tmPrisma.$queryRaw<CompletedSummaryRow[]>(Prisma.sql`
      SELECT
        SUM(task_count)::int AS total,
        SUM(CASE WHEN sla_flag IS TRUE THEN task_count ELSE 0 END)::int AS within
      FROM analytics.mv_task_daily_facts
      ${whereClause}
    `);
  }

  async fetchCompletedTimelineRows(
    filters: AnalyticsFilters,
    range?: { from?: Date; to?: Date }
  ): Promise<CompletedTimelineRow[]> {
    const conditions: Prisma.Sql[] = [Prisma.sql`date_role = 'completed'`, Prisma.sql`task_status = 'completed'`];
    if (range?.from) {
      conditions.push(Prisma.sql`reference_date >= ${range.from}`);
    }
    if (range?.to) {
      conditions.push(Prisma.sql`reference_date <= ${range.to}`);
    }
    const whereClause = buildAnalyticsWhere(filters, conditions);

    return tmPrisma.$queryRaw<CompletedTimelineRow[]>(Prisma.sql`
      SELECT
        to_char(reference_date, 'YYYY-MM-DD') AS date_key,
        SUM(task_count)::int AS total,
        SUM(CASE WHEN sla_flag IS TRUE THEN task_count ELSE 0 END)::int AS within
      FROM analytics.mv_task_daily_facts
      ${whereClause}
      GROUP BY reference_date
      ORDER BY reference_date
    `);
  }

  async fetchCompletedProcessingHandlingTimeRows(
    filters: AnalyticsFilters,
    range?: { from?: Date; to?: Date }
  ): Promise<CompletedProcessingHandlingTimeRow[]> {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`termination_reason = 'completed'`,
      Prisma.sql`state IN ('COMPLETED', 'TERMINATED')`,
      Prisma.sql`completed_date IS NOT NULL`,
    ];
    if (range?.from) {
      conditions.push(Prisma.sql`completed_date >= ${range.from}`);
    }
    if (range?.to) {
      conditions.push(Prisma.sql`completed_date <= ${range.to}`);
    }
    const whereClause = buildAnalyticsWhere(filters, conditions);

    return tmPrisma.$queryRaw<CompletedProcessingHandlingTimeRow[]>(Prisma.sql`
      SELECT
        to_char(completed_date, 'YYYY-MM-DD') AS date_key,
        COUNT(*)::int AS task_count,
        AVG(handling_time_days) FILTER (WHERE handling_time_days IS NOT NULL)::double precision AS handling_avg,
        STDDEV_POP(handling_time_days) FILTER (WHERE handling_time_days IS NOT NULL)::double precision AS handling_stddev,
        SUM(handling_time_days) FILTER (WHERE handling_time_days IS NOT NULL)::double precision AS handling_sum,
        COUNT(handling_time_days)::int AS handling_count,
        AVG(processing_time_days) FILTER (WHERE processing_time_days IS NOT NULL)::double precision AS processing_avg,
        STDDEV_POP(processing_time_days) FILTER (WHERE processing_time_days IS NOT NULL)::double precision AS processing_stddev,
        SUM(processing_time_days) FILTER (WHERE processing_time_days IS NOT NULL)::double precision AS processing_sum,
        COUNT(processing_time_days)::int AS processing_count
      FROM analytics.mv_reportable_task_thin
      ${whereClause}
      GROUP BY completed_date
      ORDER BY completed_date
    `);
  }

  async fetchCompletedByNameRows(
    filters: AnalyticsFilters,
    range?: { from?: Date; to?: Date }
  ): Promise<CompletedByNameRow[]> {
    const conditions: Prisma.Sql[] = [Prisma.sql`date_role = 'completed'`, Prisma.sql`task_status = 'completed'`];
    if (range?.from) {
      conditions.push(Prisma.sql`reference_date >= ${range.from}`);
    }
    if (range?.to) {
      conditions.push(Prisma.sql`reference_date <= ${range.to}`);
    }
    const whereClause = buildAnalyticsWhere(filters, conditions);

    return tmPrisma.$queryRaw<CompletedByNameRow[]>(Prisma.sql`
      SELECT
        task_name,
        SUM(task_count)::int AS total,
        SUM(CASE WHEN sla_flag IS TRUE THEN task_count ELSE 0 END)::int AS within
      FROM analytics.mv_task_daily_facts
      ${whereClause}
      GROUP BY task_name
      ORDER BY total DESC
    `);
  }

  async fetchCompletedByLocationRows(
    filters: AnalyticsFilters,
    range?: { from?: Date; to?: Date }
  ): Promise<CompletedByLocationRow[]> {
    const conditions: Prisma.Sql[] = [Prisma.sql`date_role = 'completed'`, Prisma.sql`task_status = 'completed'`];
    if (range?.from) {
      conditions.push(Prisma.sql`reference_date >= ${range.from}`);
    }
    if (range?.to) {
      conditions.push(Prisma.sql`reference_date <= ${range.to}`);
    }
    const whereClause = buildAnalyticsWhere(filters, conditions);

    return tmPrisma.$queryRaw<CompletedByLocationRow[]>(Prisma.sql`
      SELECT
        location,
        region,
        SUM(task_count)::int AS total,
        SUM(CASE WHEN sla_flag IS TRUE THEN task_count ELSE 0 END)::int AS within,
        SUM(handling_time_days_sum)::double precision AS handling_time_days_sum,
        SUM(handling_time_days_count)::int AS handling_time_days_count,
        SUM(processing_time_days_sum)::double precision AS processing_time_days_sum,
        SUM(processing_time_days_count)::int AS processing_time_days_count
      FROM analytics.mv_task_daily_facts
      ${whereClause}
      GROUP BY location, region
      ORDER BY location ASC, region ASC
    `);
  }

  async fetchCompletedByRegionRows(
    filters: AnalyticsFilters,
    range?: { from?: Date; to?: Date }
  ): Promise<CompletedByRegionRow[]> {
    const conditions: Prisma.Sql[] = [Prisma.sql`date_role = 'completed'`, Prisma.sql`task_status = 'completed'`];
    if (range?.from) {
      conditions.push(Prisma.sql`reference_date >= ${range.from}`);
    }
    if (range?.to) {
      conditions.push(Prisma.sql`reference_date <= ${range.to}`);
    }
    const whereClause = buildAnalyticsWhere(filters, conditions);

    return tmPrisma.$queryRaw<CompletedByRegionRow[]>(Prisma.sql`
      SELECT
        region,
        SUM(task_count)::int AS total,
        SUM(CASE WHEN sla_flag IS TRUE THEN task_count ELSE 0 END)::int AS within,
        SUM(handling_time_days_sum)::double precision AS handling_time_days_sum,
        SUM(handling_time_days_count)::int AS handling_time_days_count,
        SUM(processing_time_days_sum)::double precision AS processing_time_days_sum,
        SUM(processing_time_days_count)::int AS processing_time_days_count
      FROM analytics.mv_task_daily_facts
      ${whereClause}
      GROUP BY region
      ORDER BY region ASC
    `);
  }
}

export const taskFactsRepository = new TaskFactsRepository();
