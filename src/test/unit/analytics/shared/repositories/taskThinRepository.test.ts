import { Prisma } from '@prisma/client';

import { tmPrisma } from '../../../../../main/modules/analytics/shared/data/prisma';
import { getDefaultOutstandingSort } from '../../../../../main/modules/analytics/shared/outstandingSort';
import {
  __testing,
  taskThinRepository,
} from '../../../../../main/modules/analytics/shared/repositories/taskThinRepository';
import {
  AssignedSortBy,
  CompletedSortBy,
  getDefaultUserOverviewSort,
} from '../../../../../main/modules/analytics/shared/userOverviewSort';

jest.mock('../../../../../main/modules/analytics/shared/data/prisma', () => ({
  tmPrisma: { $queryRaw: jest.fn() },
}));

describe('taskThinRepository', () => {
  const snapshotId = 502;

  const latestQuery = (): { sql: string; values: unknown[] } => {
    const calls = (tmPrisma.$queryRaw as jest.Mock).mock.calls;
    return calls[calls.length - 1][0];
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (tmPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);
  });

  test('executes core query methods', async () => {
    const sort = getDefaultUserOverviewSort();
    const outstandingSort = getDefaultOutstandingSort();
    await taskThinRepository.fetchUserOverviewAssignedTaskRows(snapshotId, {}, sort.assigned, {
      page: 1,
      pageSize: 20,
    });
    await taskThinRepository.fetchUserOverviewAssignedTaskRows(snapshotId, {}, sort.assigned, null);
    await taskThinRepository.fetchUserOverviewCompletedTaskRows(snapshotId, {}, sort.completed, {
      page: 1,
      pageSize: 20,
    });
    await taskThinRepository.fetchUserOverviewCompletedTaskRows(snapshotId, {}, sort.completed, null);
    await taskThinRepository.fetchUserOverviewAssignedTaskCount(snapshotId, {});
    await taskThinRepository.fetchUserOverviewCompletedTaskCount(snapshotId, {});
    await taskThinRepository.fetchUserOverviewCompletedByDateRows(snapshotId, {});
    await taskThinRepository.fetchUserOverviewCompletedByTaskNameRows(snapshotId, {});
    await taskThinRepository.fetchOutstandingCriticalTaskRows(snapshotId, {}, outstandingSort.criticalTasks, {
      page: 1,
      pageSize: 20,
    });
    await taskThinRepository.fetchOutstandingCriticalTaskCount(snapshotId, {});
    await taskThinRepository.fetchOpenTasksByNameRows(snapshotId, {});
    await taskThinRepository.fetchOpenTasksByRegionLocationRows(snapshotId, {});
    await taskThinRepository.fetchOpenTasksSummaryRows(snapshotId, {});
    await taskThinRepository.fetchWaitTimeByAssignedDateRows(snapshotId, {});
    await taskThinRepository.fetchTasksDueByDateRows(snapshotId, {});

    expect(tmPrisma.$queryRaw).toHaveBeenCalled();
  });

  test('maps assignee ids', async () => {
    (tmPrisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ value: 'user-1' }, { value: 'user-2' }]);

    const result = await taskThinRepository.fetchAssigneeIds(snapshotId);

    expect(result).toEqual(['user-1', 'user-2']);
  });

  test('covers assigned sort options', async () => {
    const baseSort = getDefaultUserOverviewSort().assigned;
    const sortKeys: AssignedSortBy[] = [
      'caseId',
      'createdDate',
      'taskName',
      'assignedDate',
      'dueDate',
      'priority',
      'totalAssignments',
      'assignee',
      'location',
    ];

    const expectedSqlBySort: Record<AssignedSortBy, string> = {
      caseId: 'case_id',
      createdDate: 'created_date',
      taskName: 'task_name',
      assignedDate: 'first_assigned_date',
      dueDate: 'due_date',
      priority: 'major_priority',
      totalAssignments: 'COALESCE(number_of_reassignments, 0) + 1',
      assignee: 'assignee',
      location: 'location',
    };

    for (const key of sortKeys) {
      await taskThinRepository.fetchUserOverviewAssignedTaskRows(
        snapshotId,
        {},
        { ...baseSort, by: key, dir: 'asc' },
        { page: 1, pageSize: 20 }
      );
      const query = latestQuery();
      expect(query.sql).toContain(expectedSqlBySort[key]);
      expect(query.sql).toContain('ASC NULLS LAST');
      expect(query.sql).toContain("state = 'ASSIGNED'");
    }

    await taskThinRepository.fetchUserOverviewAssignedTaskRows(
      snapshotId,
      { user: ['user-1'] },
      { ...baseSort, by: 'caseId', dir: 'asc' },
      { page: 1, pageSize: 20 }
    );
    const userFiltered = latestQuery();
    expect(userFiltered.sql).toContain('assignee IN');
    expect(userFiltered.values).toContain('user-1');

    await taskThinRepository.fetchUserOverviewAssignedTaskRows(
      snapshotId,
      {},
      {
        ...baseSort,
        by: 'unknown' as AssignedSortBy,
        dir: 'desc',
      },
      { page: 1, pageSize: 20 }
    );
    const fallbackSort = latestQuery();
    expect(fallbackSort.sql).toContain('created_date DESC NULLS LAST');

    expect(tmPrisma.$queryRaw).toHaveBeenCalled();
  });

  test('covers completed sort options and date filters', async () => {
    const baseSort = getDefaultUserOverviewSort().completed;
    const sortKeys: CompletedSortBy[] = [
      'caseId',
      'createdDate',
      'taskName',
      'assignedDate',
      'dueDate',
      'completedDate',
      'handlingTimeDays',
      'withinDue',
      'totalAssignments',
      'assignee',
      'location',
    ];

    const expectedSqlBySort: Record<CompletedSortBy, string> = {
      caseId: 'case_id',
      createdDate: 'created_date',
      taskName: 'task_name',
      assignedDate: 'first_assigned_date',
      dueDate: 'due_date',
      completedDate: 'completed_date',
      handlingTimeDays: 'handling_time_days',
      withinDue: 'is_within_sla',
      totalAssignments: 'COALESCE(number_of_reassignments, 0) + 1',
      assignee: 'assignee',
      location: 'location',
    };

    for (const key of sortKeys) {
      const filters = { completedFrom: new Date('2024-01-01'), completedTo: new Date('2024-01-10') };
      await taskThinRepository.fetchUserOverviewCompletedTaskRows(
        snapshotId,
        filters,
        { ...baseSort, by: key, dir: 'asc' },
        { page: 1, pageSize: 20 }
      );
      const query = latestQuery();
      expect(query.sql).toContain(expectedSqlBySort[key]);
      expect(query.sql).toContain('ASC NULLS LAST');
      expect(query.sql).toContain("termination_reason = 'completed'");
      expect(query.sql).toContain("state IN ('COMPLETED', 'TERMINATED')");
      expect(query.sql).toContain('completed_date >=');
      expect(query.sql).toContain('completed_date <=');
      expect(query.values).toEqual(expect.arrayContaining([filters.completedFrom, filters.completedTo]));
    }

    await taskThinRepository.fetchUserOverviewCompletedTaskRows(
      snapshotId,
      { completedFrom: new Date('2024-01-01'), completedTo: new Date('2024-01-10') },
      { ...baseSort, by: 'unknown' as CompletedSortBy, dir: 'desc' },
      { page: 1, pageSize: 20 }
    );
    const fallbackSort = latestQuery();
    expect(fallbackSort.sql).toContain('completed_date DESC NULLS LAST');

    expect(tmPrisma.$queryRaw).toHaveBeenCalled();
  });

  test('adds user filters for completed-by-date and completed-by-task-name queries', async () => {
    await taskThinRepository.fetchUserOverviewCompletedByDateRows(snapshotId, { user: ['user-1'] });
    await taskThinRepository.fetchUserOverviewCompletedByTaskNameRows(snapshotId, { user: ['user-1'] });

    expect(tmPrisma.$queryRaw).toHaveBeenCalled();
  });

  test('includes case ID filters when fetching completed task audits', async () => {
    await taskThinRepository.fetchCompletedTaskAuditRows(
      snapshotId,
      { completedFrom: new Date('2024-01-01') },
      'CASE-123'
    );
    const query = latestQuery();

    expect(query.sql).toContain('case_id =');
    expect(query.values).toContain('CASE-123');
    expect(tmPrisma.$queryRaw).toHaveBeenCalled();
  });

  test('builds user overview where clauses for user-only filters', () => {
    const whereClause = __testing.buildUserOverviewWhere(snapshotId, { user: ['user-1'] }, []);

    expect(whereClause.sql).toContain('WHERE');
  });

  test('builds completed task conditions with and without case id', () => {
    const withoutCaseId = __testing.buildCompletedTaskConditions({
      completedFrom: new Date('2024-01-01'),
      completedTo: new Date('2024-01-10'),
    });
    const withCaseId = __testing.buildCompletedTaskConditions(
      {
        completedFrom: new Date('2024-01-01'),
        completedTo: new Date('2024-01-10'),
      },
      'CASE-42'
    );

    expect(withoutCaseId.map(condition => condition.sql).join(' ')).not.toContain('case_id =');
    expect(withCaseId.map(condition => condition.sql).join(' ')).toContain('case_id =');
    expect(withCaseId.flatMap(condition => condition.values)).toContain('CASE-42');
  });

  test('covers critical task sort options and user filtering', async () => {
    const outstandingSort = getDefaultOutstandingSort().criticalTasks;
    const sortKeys = [
      'caseId',
      'caseType',
      'location',
      'taskName',
      'createdDate',
      'dueDate',
      'priority',
      'agentName',
    ] as const;

    const expectedSqlBySort: Record<(typeof sortKeys)[number], string> = {
      caseId: 'case_id',
      caseType: 'case_type_label',
      location: 'location',
      taskName: 'task_name',
      createdDate: 'created_date',
      dueDate: 'due_date',
      priority: 'major_priority',
      agentName: 'assignee',
    };

    for (const key of sortKeys) {
      await taskThinRepository.fetchOutstandingCriticalTaskRows(
        snapshotId,
        { user: ['user-1'] },
        { ...outstandingSort, by: key },
        { page: 1, pageSize: 20 }
      );
      const query = latestQuery();
      expect(query.sql).toContain(expectedSqlBySort[key]);
      expect(query.sql).toContain('NULLS LAST');
      expect(query.sql).toContain("state NOT IN ('COMPLETED', 'TERMINATED')");
    }

    await taskThinRepository.fetchOutstandingCriticalTaskRows(
      snapshotId,
      { user: ['user-1'] },
      { ...outstandingSort, by: 'unknown' as typeof outstandingSort.by, dir: 'desc' },
      { page: 1, pageSize: 20 }
    );
    const fallbackSort = latestQuery();
    expect(fallbackSort.sql).toContain('due_date DESC NULLS LAST');

    expect(tmPrisma.$queryRaw).toHaveBeenCalled();
  });

  test('caps LIMIT/OFFSET values for oversized pagination requests', async () => {
    const sort = getDefaultOutstandingSort().criticalTasks;

    await taskThinRepository.fetchOutstandingCriticalTaskRows(snapshotId, {}, sort, { page: 999, pageSize: 50 });
    const firstQuery = (tmPrisma.$queryRaw as jest.Mock).mock.calls[0][0];
    expect(firstQuery.values.slice(-2)).toEqual([50, 450]);

    (tmPrisma.$queryRaw as jest.Mock).mockClear();
    await taskThinRepository.fetchOutstandingCriticalTaskRows(snapshotId, {}, sort, { page: 2, pageSize: 9000 });
    const secondQuery = (tmPrisma.$queryRaw as jest.Mock).mock.calls[0][0];
    expect(secondQuery.values.slice(-2)).toEqual([500, 0]);
  });

  test('normalises pagination with non-finite and negative page sizes', async () => {
    const sort = getDefaultOutstandingSort().criticalTasks;

    await taskThinRepository.fetchOutstandingCriticalTaskRows(snapshotId, {}, sort, { page: 7, pageSize: Number.NaN });
    const nonFinite = latestQuery();
    expect(nonFinite.values.slice(-2)).toEqual([1, 6]);

    await taskThinRepository.fetchOutstandingCriticalTaskRows(snapshotId, {}, sort, { page: 1, pageSize: -20 });
    const negative = latestQuery();
    expect(negative.values.slice(-2)).toEqual([1, 0]);

    await taskThinRepository.fetchOutstandingCriticalTaskRows(snapshotId, {}, sort, { page: 2, pageSize: 2.9 });
    const decimal = latestQuery();
    expect(decimal.values.slice(-2)).toEqual([2, 2]);
  });

  test('includes full priority and within-due CASE ordering SQL', async () => {
    const userSort = getDefaultUserOverviewSort();
    const outstandingSort = getDefaultOutstandingSort().criticalTasks;

    await taskThinRepository.fetchUserOverviewAssignedTaskRows(
      snapshotId,
      {},
      { ...userSort.assigned, by: 'priority', dir: 'asc' },
      { page: 1, pageSize: 20 }
    );
    const assignedPriorityQuery = latestQuery();
    expect(assignedPriorityQuery.sql).toContain('major_priority <= 2000 THEN 4');
    expect(assignedPriorityQuery.sql).toContain('major_priority < 5000 THEN 3');
    expect(assignedPriorityQuery.sql).toContain('major_priority = 5000 AND due_date = CURRENT_DATE THEN 2');
    expect(assignedPriorityQuery.sql).toContain('ASC NULLS LAST');

    await taskThinRepository.fetchUserOverviewCompletedTaskRows(
      snapshotId,
      {},
      { ...userSort.completed, by: 'withinDue', dir: 'desc' },
      { page: 1, pageSize: 20 }
    );
    const completedWithinDueQuery = latestQuery();
    expect(completedWithinDueQuery.sql).toContain("WHEN is_within_sla = 'Yes' THEN 1");
    expect(completedWithinDueQuery.sql).toContain("WHEN is_within_sla = 'No' THEN 2");
    expect(completedWithinDueQuery.sql).toContain('ELSE 3');
    expect(completedWithinDueQuery.sql).toContain('DESC NULLS LAST');

    await taskThinRepository.fetchOutstandingCriticalTaskRows(
      snapshotId,
      {},
      { ...outstandingSort, by: 'priority', dir: 'desc' },
      { page: 1, pageSize: 20 }
    );
    const criticalPriorityQuery = latestQuery();
    expect(criticalPriorityQuery.sql).toContain('major_priority <= 2000 THEN 4');
    expect(criticalPriorityQuery.sql).toContain('DESC NULLS LAST');
  });

  test('returns zero when count queries return no rows', async () => {
    (tmPrisma.$queryRaw as jest.Mock).mockResolvedValueOnce([]);
    (tmPrisma.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    const assignedTotal = await taskThinRepository.fetchUserOverviewAssignedTaskCount(snapshotId, { user: ['user-1'] });
    const completedTotal = await taskThinRepository.fetchUserOverviewCompletedTaskCount(snapshotId, {
      user: ['user-1'],
      completedFrom: new Date('2024-02-01'),
      completedTo: new Date('2024-02-28'),
    });

    const assignedCountQuery = (tmPrisma.$queryRaw as jest.Mock).mock.calls[0][0];
    const completedCountQuery = (tmPrisma.$queryRaw as jest.Mock).mock.calls[1][0];

    expect(assignedTotal).toBe(0);
    expect(completedTotal).toBe(0);
    expect(assignedCountQuery.sql).toContain('COUNT(*)::int AS total');
    expect(assignedCountQuery.sql).toContain("state = 'ASSIGNED'");
    expect(assignedCountQuery.sql).toContain('assignee IN');
    expect(assignedCountQuery.values).toContain('user-1');
    expect(completedCountQuery.sql).toContain("termination_reason = 'completed'");
    expect(completedCountQuery.sql).toContain("state IN ('COMPLETED', 'TERMINATED')");
    expect(completedCountQuery.sql).toContain('completed_date >=');
    expect(completedCountQuery.sql).toContain('completed_date <=');
    expect(completedCountQuery.sql).toContain('assignee IN');
  });

  test('builds completed by date and task-name aggregate queries with filters', async () => {
    const completedFrom = new Date('2024-03-01');
    const completedTo = new Date('2024-03-15');
    const filters = { completedFrom, completedTo, user: ['user-1'] };

    await taskThinRepository.fetchUserOverviewCompletedByDateRows(snapshotId, filters);
    const completedByDateQuery = latestQuery();
    expect(completedByDateQuery.sql).toContain('completed_date IS NOT NULL');
    expect(completedByDateQuery.sql).toContain('SUM(tasks)::int AS tasks');
    expect(completedByDateQuery.sql).toContain('SUM(within_due)::int AS within_due');
    expect(completedByDateQuery.sql).toContain('SUM(handling_time_sum)::numeric AS handling_time_sum');
    expect(completedByDateQuery.sql).toContain('GROUP BY completed_date');
    expect(completedByDateQuery.sql).toContain('ORDER BY completed_date');
    expect(completedByDateQuery.sql).toContain('assignee IN');
    expect(completedByDateQuery.values).toEqual(expect.arrayContaining([completedFrom, completedTo, 'user-1']));

    await taskThinRepository.fetchUserOverviewCompletedByTaskNameRows(snapshotId, filters);
    const completedByTaskNameQuery = latestQuery();
    expect(completedByTaskNameQuery.sql).toContain('completed_date IS NOT NULL');
    expect(completedByTaskNameQuery.sql).toContain('SUM(tasks)::int AS tasks');
    expect(completedByTaskNameQuery.sql).toContain('SUM(days_beyond_sum)::numeric AS days_beyond_sum');
    expect(completedByTaskNameQuery.sql).toContain('GROUP BY task_name');
    expect(completedByTaskNameQuery.sql).toContain('ORDER BY tasks DESC NULLS LAST, task_name ASC');
    expect(completedByTaskNameQuery.sql).toContain('assignee IN');
    expect(completedByTaskNameQuery.values).toEqual(expect.arrayContaining([completedFrom, completedTo, 'user-1']));
  });

  test('builds open task, summary, wait-time and due-by-date queries', async () => {
    const filters = { region: ['North'], location: ['Leeds'] };

    await taskThinRepository.fetchOpenTasksByNameRows(snapshotId, filters);
    const byNameQuery = latestQuery();
    expect(byNameQuery.sql).toContain("priority_bucket IN ('Urgent', 'High', 'Medium', 'Low')");
    expect(byNameQuery.sql).toContain('FROM analytics.mv_open_tasks_by_name_snapshots');
    expect(byNameQuery.sql).toContain('GROUP BY task_name');

    await taskThinRepository.fetchOpenTasksByRegionLocationRows(snapshotId, filters);
    const byRegionLocationQuery = latestQuery();
    expect(byRegionLocationQuery.sql).toContain('FROM analytics.mv_open_tasks_by_region_location_snapshots');
    expect(byRegionLocationQuery.sql).toContain('GROUP BY region, location');
    expect(byRegionLocationQuery.sql).toContain('ORDER BY location ASC, region ASC');

    await taskThinRepository.fetchOpenTasksSummaryRows(snapshotId, filters);
    const summaryQuery = latestQuery();
    expect(summaryQuery.sql).toContain("SUM(CASE WHEN state = 'ASSIGNED' THEN task_count ELSE 0 END)::int AS assigned");
    expect(summaryQuery.sql).toContain(
      "SUM(CASE WHEN state = 'ASSIGNED' THEN 0 ELSE task_count END)::int AS unassigned"
    );
    expect(summaryQuery.sql).toContain('FROM analytics.mv_open_tasks_summary_snapshots');

    await taskThinRepository.fetchWaitTimeByAssignedDateRows(snapshotId, filters);
    const waitTimeQuery = latestQuery();
    expect(waitTimeQuery.sql).toContain('WHEN SUM(assigned_task_count) = 0 THEN 0');
    expect(waitTimeQuery.sql).toContain('SUM(total_wait_time_days) / SUM(assigned_task_count)::numeric');
    expect(waitTimeQuery.sql).toContain('GROUP BY reference_date');

    await taskThinRepository.fetchTasksDueByDateRows(snapshotId, filters);
    const tasksDueQuery = latestQuery();
    expect(tasksDueQuery.sql).toContain("date_role = 'due'");
    expect(tasksDueQuery.sql).toContain("WHEN task_status = 'open' THEN task_count");
    expect(tasksDueQuery.sql).toContain("WHEN task_status = 'completed' THEN task_count");
    expect(tasksDueQuery.sql).toContain('ORDER BY reference_date');
  });

  test('buildUserOverviewWhere appends user filters to base clauses', () => {
    const whereClause = __testing.buildUserOverviewWhere(snapshotId, { user: ['user-1'] }, [
      Prisma.sql`state = 'ASSIGNED'`,
    ]);

    expect(whereClause.sql).toContain('WHERE');
    expect(whereClause.sql).toContain('AND');
    expect(whereClause.sql).toContain('assignee IN');
    expect(whereClause.values).toContain('user-1');
  });

  test('emits audit and assignee lookup SQL', async () => {
    (tmPrisma.$queryRaw as jest.Mock).mockResolvedValueOnce([]);
    (tmPrisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ value: 'user-1' }, { value: 'user-2' }]);

    await taskThinRepository.fetchCompletedTaskAuditRows(
      snapshotId,
      { completedFrom: new Date('2024-04-01'), completedTo: new Date('2024-04-30') },
      'CASE-100'
    );
    const auditQuery = (tmPrisma.$queryRaw as jest.Mock).mock.calls[0][0];

    const assigneeIds = await taskThinRepository.fetchAssigneeIds(snapshotId);
    const assigneeQuery = (tmPrisma.$queryRaw as jest.Mock).mock.calls[1][0];

    expect(auditQuery.sql).toContain("termination_reason = 'completed'");
    expect(auditQuery.sql).toContain("to_char(completed_date, 'YYYY-MM-DD') AS completed_date");
    expect(auditQuery.sql).toContain('outcome');
    expect(auditQuery.sql).toContain('ORDER BY completed_date DESC NULLS LAST');
    expect(auditQuery.values).toContain('CASE-100');
    expect(assigneeQuery.sql).toContain('SELECT DISTINCT assignee AS value');
    expect(assigneeQuery.sql).toContain('assignee IS NOT NULL');
    expect(assigneeIds).toEqual(['user-1', 'user-2']);
  });
});
