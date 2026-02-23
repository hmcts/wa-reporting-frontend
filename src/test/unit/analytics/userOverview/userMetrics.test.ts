import { Task } from '../../../../main/modules/analytics/shared/types';
import { userOverviewService } from '../../../../main/modules/analytics/userOverview/service';

describe('buildUserOverview', () => {
  test('builds assigned/completed lists and priority summary', () => {
    const tasks: Task[] = [
      {
        caseId: 'CASE-1',
        taskId: 'TASK-1',
        service: 'Service A',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        priority: 'Urgent',
        status: 'assigned',
        createdDate: '2024-01-01',
        assigneeId: 'user-1',
        assigneeName: 'Alex Carter',
      },
      {
        caseId: 'CASE-2',
        taskId: 'TASK-2',
        service: 'Service A',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        priority: 'High',
        status: 'completed',
        createdDate: '2024-01-02',
        completedDate: '2024-01-03',
        withinSla: true,
        assigneeId: 'user-1',
        assigneeName: 'Alex Carter',
      },
    ];

    const overview = userOverviewService.buildUserOverview(tasks);

    expect(overview.assigned).toHaveLength(1);
    expect(overview.completed).toHaveLength(1);
    expect(overview.prioritySummary.urgent).toBe(1);
    expect(overview.completedSummary).toEqual({ total: 1, withinDueYes: 1, withinDueNo: 0 });
    expect(overview.completedByDate).toHaveLength(1);
    expect(overview.completedByDate[0].tasks).toBe(1);
  });

  test('aggregates completed by date with due status and handling time', () => {
    const tasks: Task[] = [
      {
        caseId: 'CASE-10',
        taskId: 'TASK-10',
        service: 'Service B',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        priority: 'High',
        status: 'completed',
        createdDate: '2024-05-01',
        completedDate: '2024-05-02',
        dueDate: '2024-05-03',
        handlingTimeDays: 2,
      },
      {
        caseId: 'CASE-11',
        taskId: 'TASK-11',
        service: 'Service B',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        priority: 'High',
        status: 'completed',
        createdDate: '2024-05-01',
        completedDate: '2024-05-02',
        dueDate: '2024-05-01',
        handlingTimeDays: 4,
      },
    ];

    const overview = userOverviewService.buildUserOverview(tasks);

    expect(overview.completedByDate).toHaveLength(1);
    expect(overview.completedByDate[0]).toMatchObject({
      date: '2024-05-02',
      tasks: 2,
      withinDue: 1,
      beyondDue: 1,
      handlingTimeSum: 6,
      handlingTimeCount: 2,
    });
  });

  test('skips invalid completed dates and excludes completed tasks from priorities', () => {
    const tasks: Task[] = [
      {
        caseId: 'CASE-3',
        taskId: 'TASK-3',
        service: 'Service Z',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        priority: 'Low',
        status: 'completed',
        createdDate: '2024-02-01',
        completedDate: 'not-a-date',
      },
    ];

    const overview = userOverviewService.buildUserOverview(tasks);
    expect(overview.completedByDate).toHaveLength(0);
    expect(overview.prioritySummary.low).toBe(0); // completed tasks excluded from assigned
    expect(overview.completedSummary).toEqual({ total: 1, withinDueYes: 0, withinDueNo: 1 });
  });

  test('aggregates multiple priorities and completed dates', () => {
    const tasks: Task[] = [
      {
        caseId: 'CASE-4',
        taskId: 'TASK-4',
        service: 'Service Z',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        priority: 'Medium',
        status: 'assigned',
        createdDate: '2024-03-01',
      },
      {
        caseId: 'CASE-4A',
        taskId: 'TASK-4A',
        service: 'Service Z',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        priority: 'Urgent',
        status: 'open',
        createdDate: '2024-03-01',
      },
      {
        caseId: 'CASE-4B',
        taskId: 'TASK-4B',
        service: 'Service Z',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        priority: 'High',
        status: 'assigned',
        createdDate: '2024-03-02',
      },
      {
        caseId: 'CASE-5',
        taskId: 'TASK-5',
        service: 'Service Z',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        priority: 'Low',
        status: 'assigned',
        createdDate: '2024-03-02',
      },
      {
        caseId: 'CASE-6',
        taskId: 'TASK-6',
        service: 'Service Z',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        priority: 'High',
        status: 'completed',
        createdDate: '2024-03-03',
        completedDate: '2024-03-04',
      },
      {
        caseId: 'CASE-7',
        taskId: 'TASK-7',
        service: 'Service Z',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        priority: 'Urgent',
        status: 'completed',
        createdDate: '2024-03-05',
        completedDate: '2024-03-05',
      },
    ];

    const overview = userOverviewService.buildUserOverview(tasks);
    expect(overview.prioritySummary.medium).toBe(1);
    expect(overview.prioritySummary.low).toBe(1);
    expect(overview.prioritySummary.high).toBe(1);
    expect(overview.prioritySummary.urgent).toBe(1);
    expect(overview.completedSummary).toEqual({ total: 2, withinDueYes: 0, withinDueNo: 2 });
    expect(overview.completedByDate).toHaveLength(2);
  });

  test('skips invalid completed date in completedByDate aggregation', () => {
    const tasks: Task[] = [
      {
        caseId: 'CASE-8',
        taskId: 'TASK-8',
        service: 'Service Z',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        priority: 'Low',
        status: 'completed',
        createdDate: '2024-04-01',
        completedDate: 'bad-date',
      },
      {
        caseId: 'CASE-9',
        taskId: 'TASK-9',
        service: 'Service Z',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        status: 'assigned',
        createdDate: '2024-04-02',
        priority: 'Low',
      },
      {
        caseId: 'CASE-9B',
        taskId: 'TASK-9B',
        service: 'Service Z',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        status: 'completed',
        priority: 'Low',
        createdDate: '2024-04-03',
        completedDate: undefined,
      },
      {
        caseId: 'CASE-9C',
        taskId: 'TASK-9C',
        service: 'Service Z',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        status: undefined,
        priority: 'Low',
        createdDate: '2024-04-04',
      },
    ];

    const overview = userOverviewService.buildUserOverview(tasks);
    expect(overview.completedByDate).toHaveLength(0);
    expect(overview.prioritySummary.urgent).toBe(0);
    expect(overview.prioritySummary.high).toBe(0);
    expect(overview.prioritySummary.medium).toBe(0);
    expect(overview.prioritySummary.low).toBe(1);
    expect(overview.completedSummary).toEqual({ total: 2, withinDueYes: 0, withinDueNo: 2 });
  });

  test('ignores tasks without assigned or completed status', () => {
    const tasks: Task[] = [
      {
        caseId: 'CASE-30',
        taskId: 'TASK-30',
        service: 'Service Z',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        priority: 'Low',
        createdDate: '2024-04-05',
      },
    ];

    const overview = userOverviewService.buildUserOverview(tasks);
    expect(overview.assigned).toHaveLength(0);
    expect(overview.completed).toHaveLength(0);
    expect(overview.completedSummary).toEqual({ total: 0, withinDueYes: 0, withinDueNo: 0 });
  });

  test('ignores unknown priorities in summary', () => {
    const tasks: Task[] = [
      {
        caseId: 'CASE-40',
        taskId: 'TASK-40',
        service: 'Service Z',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        priority: 'unknown' as Task['priority'],
        status: 'assigned',
        createdDate: '2024-04-06',
      },
    ];

    const overview = userOverviewService.buildUserOverview(tasks);
    expect(overview.prioritySummary.urgent).toBe(0);
    expect(overview.prioritySummary.high).toBe(0);
    expect(overview.prioritySummary.medium).toBe(0);
    expect(overview.prioritySummary.low).toBe(0);
  });
});
