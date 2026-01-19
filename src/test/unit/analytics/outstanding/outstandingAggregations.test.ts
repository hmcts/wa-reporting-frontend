import { outstandingService } from '../../../../main/modules/analytics/outstanding/service';
import { Task } from '../../../../main/modules/analytics/shared/types';

describe('buildOutstanding', () => {
  test('summarises outstanding tasks and priorities', () => {
    const tasks: Task[] = [
      {
        caseId: 'CASE-1',
        taskId: 'TASK-1',
        service: 'Service A',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        priority: 'urgent',
        status: 'open',
        createdDate: '2024-01-01',
      },
      {
        caseId: 'CASE-2',
        taskId: 'TASK-2',
        service: 'Service A',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        priority: 'high',
        status: 'assigned',
        createdDate: '2024-01-02',
        assignedDate: '2024-01-03',
        dueDate: '2024-01-10',
      },
      {
        caseId: 'CASE-3',
        taskId: 'TASK-3',
        service: 'Service B',
        roleCategory: 'Admin',
        region: 'South',
        location: 'London',
        taskName: 'Notify',
        priority: 'low',
        status: 'completed',
        createdDate: '2024-01-03',
      },
    ];

    const metrics = outstandingService.buildOutstanding(tasks);

    expect(metrics.summary.open).toBe(2);
    expect(metrics.summary.assigned).toBe(1);
    expect(metrics.summary.unassigned).toBe(1);
    expect(metrics.summary.assignedPct).toBe(50);
    expect(metrics.summary.unassignedPct).toBe(50);
    expect(metrics.summary.urgent).toBe(1);
    expect(metrics.summary.high).toBe(1);
    expect(metrics.summary.low).toBe(0);
    expect(metrics.openByName).toHaveLength(1);
    expect(metrics.criticalTasks.length).toBeGreaterThan(0);
  });

  test('handles empty and malformed dates without throwing', () => {
    const tasks: Task[] = [
      {
        caseId: 'CASE-4',
        taskId: 'TASK-4',
        service: 'Service C',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        priority: 'low',
        status: 'assigned',
        createdDate: 'bad-date',
        assignedDate: 'also-bad',
        dueDate: undefined,
      },
    ];

    const metrics = outstandingService.buildOutstanding(tasks);

    expect(metrics.summary.open).toBe(1);
    expect(metrics.timelines.openByCreated).toHaveLength(0);
    expect(metrics.timelines.waitTimeByAssigned).toHaveLength(0);
    expect(metrics.timelines.tasksDueByPriority).toHaveLength(0);
  });

  test('produces totals and percentages when no tasks or with due dates', () => {
    const metricsEmpty = outstandingService.buildOutstanding([]);
    expect(metricsEmpty.summary.assignedPct).toBe(0);
    expect(metricsEmpty.summary.unassignedPct).toBe(0);

    const metricsDue = outstandingService.buildOutstanding([
      {
        caseId: 'CASE-5',
        taskId: 'TASK-5',
        service: 'Service D',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Check',
        status: 'assigned',
        priority: 'low',
        createdDate: '2024-01-01',
        assignedDate: '2024-01-02',
        dueDate: '2024-01-03',
      },
      {
        caseId: 'CASE-6',
        taskId: 'TASK-6',
        service: 'Service D',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Check',
        status: 'assigned',
        priority: 'medium',
        createdDate: '2024-01-01',
        assignedDate: '2024-01-02',
        dueDate: '2024-01-04',
      },
      {
        caseId: 'CASE-7',
        taskId: 'TASK-7',
        service: 'Service D',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Check',
        status: 'completed',
        priority: 'low',
        createdDate: '2024-01-02',
        completedDate: '2024-01-03',
        dueDate: '2024-01-05',
      },
      {
        caseId: 'CASE-8',
        taskId: 'TASK-8',
        service: 'Service D',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Check',
        status: 'assigned',
        priority: 'low',
        createdDate: '2024-01-02',
        assignedDate: '2024-01-03',
        dueDate: 'invalid-date',
      },
      {
        caseId: 'CASE-9',
        taskId: 'TASK-9',
        service: 'Service D',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Check',
        status: 'open',
        priority: 'low',
        createdDate: '2024-01-02',
      },
    ]);

    expect(metricsDue.timelines.tasksDueByPriority).toHaveLength(2);
    expect(metricsDue.timelines.dueByDate[0].completed + metricsDue.timelines.dueByDate[0].open).toBeGreaterThan(0);
    expect(metricsDue.summary.open).toBeGreaterThan(0);
    expect(
      metricsDue.summary.urgent + metricsDue.summary.high + metricsDue.summary.medium + metricsDue.summary.low
    ).toBe(4);
  });

  test('defaults missing location/region and ignores missing wait time inputs', () => {
    const tasks: Task[] = [
      {
        caseId: 'CASE-14',
        taskId: 'TASK-14',
        service: 'Service F',
        roleCategory: 'Ops',
        region: '',
        location: '',
        taskName: 'Follow-up',
        status: 'assigned',
        priority: 'urgent',
        createdDate: '',
        assignedDate: '2024-03-02',
        dueDate: '2024-03-10',
      },
      {
        caseId: 'CASE-15',
        taskId: 'TASK-15',
        service: 'Service F',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Follow-up',
        status: 'assigned',
        priority: 'high',
        createdDate: '2024-03-01',
        assignedDate: undefined,
        dueDate: '2024-03-11',
      },
      {
        caseId: 'CASE-16',
        taskId: 'TASK-16',
        service: 'Service F',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Follow-up',
        status: 'assigned',
        priority: 'low',
        createdDate: '2024-03-01',
        assignedDate: '2024-03-02',
        dueDate: '2024-03-12',
      },
      {
        caseId: 'CASE-17',
        taskId: 'TASK-17',
        service: 'Service F',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Follow-up',
        status: 'assigned',
        priority: 'high',
        createdDate: '2024-03-01',
        assignedDate: '2024-03-02',
        dueDate: '2024-03-12',
      },
    ];

    const metrics = outstandingService.buildOutstanding(tasks);

    const unknownRow = metrics.outstandingByLocation.find(row => row.location === 'Unknown');
    expect(unknownRow?.region).toBe('Unknown');
    expect(metrics.timelines.waitTimeByAssigned.length).toBeGreaterThan(0);
  });

  test('counts priority mix for due dates and open-by-name', () => {
    const tasks: Task[] = [
      {
        caseId: 'CASE-10',
        taskId: 'TASK-10',
        service: 'Service E',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Bundle',
        status: 'assigned',
        priority: 'urgent',
        createdDate: '2024-02-01',
        assignedDate: '2024-02-02',
        dueDate: '2024-02-10',
      },
      {
        caseId: 'CASE-11',
        taskId: 'TASK-11',
        service: 'Service E',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Bundle',
        status: 'assigned',
        priority: 'high',
        createdDate: '2024-02-01',
        assignedDate: '2024-02-02',
        dueDate: '2024-02-10',
      },
      {
        caseId: 'CASE-12',
        taskId: 'TASK-12',
        service: 'Service E',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Bundle',
        status: 'assigned',
        priority: 'medium',
        createdDate: '2024-02-01',
        assignedDate: '2024-02-02',
        dueDate: '2024-02-10',
      },
      {
        caseId: 'CASE-13',
        taskId: 'TASK-13',
        service: 'Service E',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Bundle',
        status: 'assigned',
        priority: 'low',
        createdDate: '2024-02-01',
        assignedDate: '2024-02-02',
        dueDate: '2024-02-10',
      },
    ];

    const metrics = outstandingService.buildOutstanding(tasks);
    const priorityPoint = metrics.timelines.tasksDueByPriority.find(point => point.date === '2024-02-10');
    expect(priorityPoint?.urgent).toBe(1);
    expect(priorityPoint?.high).toBe(1);
    expect(priorityPoint?.medium).toBe(1);
    expect(priorityPoint?.low).toBe(1);
    const openByName = metrics.openByName.find(row => row.name === 'Bundle');
    expect(openByName?.urgent).toBe(1);
    expect(openByName?.low).toBe(1);
  });

  test('handles wait time skip and critical task defaults', () => {
    const tasks: Task[] = [
      {
        caseId: 'CASE-20',
        taskId: 'TASK-20',
        service: 'Service F',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Assemble',
        status: 'assigned',
        priority: 'urgent',
        createdDate: 'bad-date',
        assignedDate: '2024-03-01',
      },
      {
        caseId: 'CASE-21',
        taskId: 'TASK-21',
        service: 'Service F',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Assemble',
        status: 'assigned',
        priority: 'low',
        createdDate: '2024-03-01',
        assignedDate: '2024-03-02',
        dueDate: undefined,
      },
    ];

    const metrics = outstandingService.buildOutstanding(tasks);
    expect(metrics.timelines.waitTimeByAssigned).toHaveLength(1);
    expect(metrics.criticalTasks[0].priority).toBe('urgent');
  });

  test('counts priorities and sorts locations by region', () => {
    const tasks: Task[] = [
      {
        caseId: 'CASE-30',
        taskId: 'TASK-30',
        service: 'Service G',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        status: 'open',
        priority: 'low',
        createdDate: '2024-05-01',
      },
      {
        caseId: 'CASE-31',
        taskId: 'TASK-31',
        service: 'Service G',
        roleCategory: 'Ops',
        region: 'South',
        location: 'Leeds',
        taskName: 'Review',
        status: 'open',
        priority: 'low',
        createdDate: '2024-05-02',
      },
    ];

    const metrics = outstandingService.buildOutstanding(tasks);
    const openByName = metrics.openByName.find(row => row.name === 'Review');
    expect(openByName?.low).toBe(2);

    expect(metrics.outstandingByLocation).toHaveLength(2);
    expect(metrics.outstandingByLocation[0].region).toBe('North');
    expect(metrics.outstandingByLocation[1].region).toBe('South');
  });

  test('sorts outstanding locations by location when different', () => {
    const tasks: Task[] = [
      {
        caseId: 'CASE-40',
        taskId: 'TASK-40',
        service: 'Service H',
        roleCategory: 'Ops',
        region: 'North',
        location: 'York',
        taskName: 'Check',
        status: 'open',
        priority: 'high',
        createdDate: '2024-06-01',
      },
      {
        caseId: 'CASE-41',
        taskId: 'TASK-41',
        service: 'Service H',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Check',
        status: 'open',
        priority: 'high',
        createdDate: '2024-06-02',
      },
    ];

    const metrics = outstandingService.buildOutstanding(tasks);

    expect(metrics.outstandingByLocation[0].location).toBe('Leeds');
    expect(metrics.outstandingByLocation[1].location).toBe('York');
  });

  test('ignores unknown priorities for breakdowns', () => {
    const tasks: Task[] = [
      {
        caseId: 'CASE-50',
        taskId: 'TASK-50',
        service: 'Service I',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Triage',
        status: 'open',
        priority: 'unknown' as Task['priority'],
        createdDate: '2024-07-01',
        dueDate: '2024-07-10',
      },
    ];

    const metrics = outstandingService.buildOutstanding(tasks);
    const priorityPoint = metrics.timelines.tasksDueByPriority.find(point => point.date === '2024-07-10');

    expect(priorityPoint?.urgent).toBe(0);
    expect(priorityPoint?.high).toBe(0);
    expect(metrics.openByName[0].urgent).toBe(0);
    expect(metrics.outstandingByLocation[0].urgent).toBe(0);
  });

  test('calculates wait time averages from assigned dates', () => {
    const tasks: Task[] = [
      {
        caseId: 'CASE-100',
        taskId: 'TASK-100',
        service: 'Service A',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        status: 'assigned',
        priority: 'low',
        createdDate: '2024-01-01',
        assignedDate: '2024-01-01',
        dueDate: '2024-01-10',
        totalAssignments: 1,
      },
    ];

    const metrics = outstandingService.buildOutstanding(tasks);

    expect(metrics.timelines.waitTimeByAssigned).toHaveLength(1);
    expect(metrics.timelines.waitTimeByAssigned[0].averageWaitDays).toBe(0);
  });
});
