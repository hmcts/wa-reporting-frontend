import { tmPrisma } from '../../../../../main/modules/analytics/shared/data/prisma';
import { getDefaultOutstandingSort } from '../../../../../main/modules/analytics/shared/outstandingSort';
import { taskThinRepository } from '../../../../../main/modules/analytics/shared/repositories/taskThinRepository';
import {
  AssignedSortBy,
  CompletedSortBy,
  getDefaultUserOverviewSort,
} from '../../../../../main/modules/analytics/shared/userOverviewSort';

jest.mock('../../../../../main/modules/analytics/shared/data/prisma', () => ({
  tmPrisma: { $queryRaw: jest.fn() },
}));

describe('taskThinRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (tmPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);
  });

  test('executes core query methods', async () => {
    const sort = getDefaultUserOverviewSort();
    const outstandingSort = getDefaultOutstandingSort();
    await taskThinRepository.fetchUserOverviewAssignedTaskRows({}, sort.assigned);
    await taskThinRepository.fetchUserOverviewCompletedTaskRows({}, sort.completed);
    await taskThinRepository.fetchOutstandingCriticalTaskRows({}, outstandingSort.criticalTasks);
    await taskThinRepository.fetchOpenTasksByNameRows({});
    await taskThinRepository.fetchOpenTasksByRegionLocationRows({});
    await taskThinRepository.fetchOpenTasksSummaryRows({});
    await taskThinRepository.fetchWaitTimeByAssignedDateRows({});
    await taskThinRepository.fetchTasksDueByDateRows({});

    expect(tmPrisma.$queryRaw).toHaveBeenCalled();
  });

  test('maps assignee ids', async () => {
    (tmPrisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ value: 'user-1' }, { value: 'user-2' }]);

    const result = await taskThinRepository.fetchAssigneeIds();

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

    for (const key of sortKeys) {
      await taskThinRepository.fetchUserOverviewAssignedTaskRows({}, { ...baseSort, by: key, dir: 'asc' });
    }

    await taskThinRepository.fetchUserOverviewAssignedTaskRows(
      { user: ['user-1'] },
      { ...baseSort, by: 'caseId', dir: 'asc' }
    );

    await taskThinRepository.fetchUserOverviewAssignedTaskRows(
      {},
      {
        ...baseSort,
        by: 'unknown' as AssignedSortBy,
        dir: 'desc',
      }
    );

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

    for (const key of sortKeys) {
      await taskThinRepository.fetchUserOverviewCompletedTaskRows(
        { completedFrom: new Date('2024-01-01'), completedTo: new Date('2024-01-10') },
        { ...baseSort, by: key, dir: 'asc' }
      );
    }

    await taskThinRepository.fetchUserOverviewCompletedTaskRows(
      { completedFrom: new Date('2024-01-01'), completedTo: new Date('2024-01-10') },
      { ...baseSort, by: 'unknown' as CompletedSortBy, dir: 'desc' }
    );

    expect(tmPrisma.$queryRaw).toHaveBeenCalled();
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

    for (const key of sortKeys) {
      await taskThinRepository.fetchOutstandingCriticalTaskRows({ user: ['user-1'] }, { ...outstandingSort, by: key });
    }

    await taskThinRepository.fetchOutstandingCriticalTaskRows(
      { user: ['user-1'] },
      { ...outstandingSort, by: 'unknown' as typeof outstandingSort.by, dir: 'desc' }
    );

    expect(tmPrisma.$queryRaw).toHaveBeenCalled();
  });
});
