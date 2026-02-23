import { overviewService } from '../../../../main/modules/analytics/overview/service';
import { Task } from '../../../../main/modules/analytics/shared/types';

describe('buildOverview', () => {
  test('aggregates open and assigned tasks by service', () => {
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
        priority: 'High',
        status: 'assigned',
        createdDate: '2024-01-02',
      },
      {
        caseId: 'CASE-3',
        taskId: 'TASK-3',
        service: 'Service B',
        roleCategory: 'Admin',
        region: 'South',
        location: 'London',
        taskName: 'Notify',
        priority: 'Low',
        status: 'completed',
        createdDate: '2024-01-03',
      },
    ];

    const overview = overviewService.buildOverview(tasks);

    expect(overview.serviceRows).toHaveLength(1);
    expect(overview.serviceRows[0].service).toBe('Service A');
    expect(overview.serviceRows[0].open).toBe(1);
    expect(overview.serviceRows[0].assigned).toBe(1);
    expect(overview.serviceRows[0].urgent).toBe(1);
    expect(overview.serviceRows[0].high).toBe(1);
    expect(overview.serviceRows[0].low).toBe(0);
    expect(overview.totals.open).toBe(1);
    expect(overview.totals.assigned).toBe(1);
  });

  test('handles no active tasks and calculates zero assignedPct', () => {
    const tasks: Task[] = [
      {
        caseId: 'CASE-10',
        taskId: 'TASK-10',
        service: 'Service C',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        priority: 'High',
        status: 'completed',
        createdDate: '2024-01-04',
      },
    ];

    const overview = overviewService.buildOverview(tasks);
    expect(overview.serviceRows).toHaveLength(0);
    expect(overview.totals.open).toBe(0);
    expect(overview.totals.assignedPct).toBe(0);
  });

  test('calculates percentages without urgent priorities', () => {
    const tasks: Task[] = [
      {
        caseId: 'CASE-11',
        taskId: 'TASK-11',
        service: 'Service D',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        priority: 'Low',
        status: 'assigned',
        createdDate: '2024-01-05',
      },
    ];

    const overview = overviewService.buildOverview(tasks);
    expect(overview.serviceRows[0].assignedPct).toBe(100);
    expect(overview.serviceRows[0].urgent).toBe(0);
    expect(overview.totals.assignedPct).toBe(100);
  });

  test('counts medium and low priorities', () => {
    const tasks: Task[] = [
      {
        caseId: 'CASE-12',
        taskId: 'TASK-12',
        service: 'Service E',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        priority: 'Medium',
        status: 'open',
        createdDate: '2024-01-06',
      },
      {
        caseId: 'CASE-13',
        taskId: 'TASK-13',
        service: 'Service E',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        priority: 'Low',
        status: 'assigned',
        createdDate: '2024-01-06',
      },
      {
        caseId: 'CASE-14',
        taskId: 'TASK-14',
        service: 'Service E',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        priority: 'Low',
        status: 'assigned',
        createdDate: '2024-01-06',
      },
    ];

    const overview = overviewService.buildOverview(tasks);
    expect(overview.serviceRows[0].medium).toBe(1);
    expect(overview.serviceRows[0].low).toBe(2);
    expect(overview.serviceRows[0].assignedPct).toBeCloseTo(66.6667, 4);
  });

  test('ignores unknown priorities in service breakdowns', () => {
    const tasks: Task[] = [
      {
        caseId: 'CASE-20',
        taskId: 'TASK-20',
        service: 'Service F',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        priority: 'unknown' as Task['priority'],
        status: 'open',
        createdDate: '2024-02-01',
      },
    ];

    const overview = overviewService.buildOverview(tasks);

    expect(overview.serviceRows[0].urgent).toBe(0);
    expect(overview.serviceRows[0].high).toBe(0);
    expect(overview.serviceRows[0].medium).toBe(0);
    expect(overview.serviceRows[0].low).toBe(0);
  });

  test('builds totals row with summed priorities and fixed label', () => {
    const tasks: Task[] = [
      {
        caseId: 'CASE-30',
        taskId: 'TASK-30',
        service: 'Service G',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        priority: 'Urgent',
        status: 'open',
        createdDate: '2024-03-01',
      },
      {
        caseId: 'CASE-31',
        taskId: 'TASK-31',
        service: 'Service H',
        roleCategory: 'Ops',
        region: 'South',
        location: 'London',
        taskName: 'Review',
        priority: 'High',
        status: 'assigned',
        createdDate: '2024-03-02',
      },
      {
        caseId: 'CASE-32',
        taskId: 'TASK-32',
        service: 'Service H',
        roleCategory: 'Ops',
        region: 'South',
        location: 'London',
        taskName: 'Review',
        priority: 'Medium',
        status: 'assigned',
        createdDate: '2024-03-03',
      },
      {
        caseId: 'CASE-33',
        taskId: 'TASK-33',
        service: 'Service H',
        roleCategory: 'Ops',
        region: 'South',
        location: 'London',
        taskName: 'Review',
        priority: 'Low',
        status: 'open',
        createdDate: '2024-03-04',
      },
    ];

    const overview = overviewService.buildOverview(tasks);

    expect(overview.totals.service).toBe('Total');
    expect(overview.totals.urgent).toBe(1);
    expect(overview.totals.high).toBe(1);
    expect(overview.totals.medium).toBe(1);
    expect(overview.totals.low).toBe(1);
  });
});
