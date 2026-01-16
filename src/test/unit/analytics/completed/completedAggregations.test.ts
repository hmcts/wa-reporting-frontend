import { __testing, completedService } from '../../../../main/modules/analytics/completed/service';
import { Task } from '../../../../main/modules/analytics/shared/types';

describe('buildCompleted', () => {
  test('summarises completed tasks and compliance', () => {
    const today = new Date().toISOString().slice(0, 10);
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
        status: 'completed',
        createdDate: '2024-01-01',
        completedDate: '2024-01-05',
        dueDate: '2024-01-06',
        handlingTimeDays: 2,
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
        status: 'completed',
        createdDate: '2024-01-02',
        completedDate: '2024-01-10',
        dueDate: '2024-01-04',
        handlingTimeDays: 3,
      },
      {
        caseId: 'CASE-4',
        taskId: 'TASK-4',
        service: 'Service A',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        priority: 'high',
        status: 'completed',
        createdDate: '2024-01-12',
        completedDate: today,
        withinSla: true,
      },
      {
        caseId: 'CASE-5',
        taskId: 'TASK-5',
        service: 'Service A',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        priority: 'high',
        status: 'completed',
        createdDate: '2024-01-12',
        completedDate: today,
        withinSla: false,
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
        status: 'open',
        createdDate: '2024-01-03',
      },
    ];

    const result = completedService.buildCompleted(tasks);

    expect(result.summary.completedInRange).toBe(4);
    expect(result.summary.withinDueYes).toBe(2);
    expect(result.summary.withinDueNo).toBe(2);
    expect(result.summary.completedToday).toBe(2);
    expect(result.summary.withinDueTodayYes).toBe(1);
    expect(result.summary.withinDueTodayNo).toBe(1);
    expect(result.completedByName).toHaveLength(1);
    expect(result.timeline.length).toBeGreaterThan(0);
  });

  test('handles invalid dates and missing handling times', () => {
    const tasks: Task[] = [
      {
        caseId: 'CASE-4',
        taskId: 'TASK-4',
        service: 'Service X',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Audit',
        priority: 'low',
        status: 'completed',
        createdDate: '2024-05-01',
        completedDate: 'not-a-date',
        dueDate: '2024-05-10',
      },
      {
        caseId: 'CASE-5',
        taskId: 'TASK-5',
        service: 'Service X',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Audit',
        priority: 'low',
        status: 'completed',
        createdDate: '2024-05-02',
        completedDate: '2024-05-03',
      },
      {
        caseId: 'CASE-6',
        taskId: 'TASK-6',
        service: 'Service X',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Audit',
        priority: 'high',
        status: 'completed',
        createdDate: '2024-05-04',
      },
      {
        caseId: 'CASE-7',
        taskId: 'TASK-7',
        service: 'Service X',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Audit',
        priority: 'low',
        status: 'completed',
        createdDate: '2024-05-05',
        completedDate: '2024-05-06',
        dueDate: '2024-05-07',
        handlingTimeDays: undefined,
      },
    ];

    const result = completedService.buildCompleted(tasks);

    expect(result.timeline).toHaveLength(2);
    expect(result.summary.withinDueYes).toBe(1);
    expect(result.summary.withinDueNo).toBe(3);
    expect(result.handlingTimeStats.averageDays).toBe(0);
  });

  test('sorts completed by name and groups region/location totals', () => {
    const tasks: Task[] = [
      {
        caseId: 'CASE-10',
        taskId: 'TASK-10',
        service: 'Service A',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Alpha',
        priority: 'low',
        status: 'completed',
        createdDate: '2024-06-01',
        completedDate: '2024-06-02',
        dueDate: '2024-06-03',
      },
      {
        caseId: 'CASE-11',
        taskId: 'TASK-11',
        service: 'Service A',
        roleCategory: 'Ops',
        region: 'South',
        location: 'Leeds',
        taskName: 'Beta',
        priority: 'low',
        status: 'completed',
        createdDate: '2024-06-01',
        completedDate: '2024-06-04',
        dueDate: '2024-06-03',
      },
      {
        caseId: 'CASE-12',
        taskId: 'TASK-12',
        service: 'Service A',
        roleCategory: 'Ops',
        region: 'Unknown',
        location: 'Unknown',
        taskName: 'Beta',
        priority: 'low',
        status: 'completed',
        createdDate: '2024-06-01',
        completedDate: '2024-06-05',
        dueDate: '2024-06-06',
        withinSla: true,
      },
      {
        caseId: 'CASE-13',
        taskId: 'TASK-13',
        service: 'Service A',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Gamma',
        priority: 'low',
        status: 'completed',
        createdDate: '2024-06-02',
        completedDate: '2024-06-03',
        dueDate: '2024-06-04',
      },
    ];

    const result = completedService.buildCompleted(tasks);
    expect(result.completedByName[0].taskName).toBe('Beta');
    expect(result.completedByName[1].taskName).toBe('Alpha');
    expect(result.completedByName[2].taskName).toBe('Gamma');

    const regions = completedService.buildCompletedByRegionLocation(tasks);
    expect(regions.byLocation).toHaveLength(3);
    expect(regions.byLocation[0].location).toBe('Leeds');
    expect(regions.byLocation[0].region).toBe('North');
    expect(regions.byLocation[2].location).toBe('Unknown');
    expect(regions.byRegion[0].region).toBe('North');
    expect(regions.byRegion[1].region).toBe('South');
    const unknownRow = regions.byRegion.find(row => row.region === 'Unknown');
    expect(unknownRow?.withinDue).toBe(1);
  });

  test('honours SLA flags and calculates handling stats', () => {
    const tasks: Task[] = [
      {
        caseId: 'CASE-20',
        taskId: 'TASK-20',
        service: 'Service A',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Alpha',
        priority: 'high',
        status: 'completed',
        createdDate: '2024-07-01',
        completedDate: '2024-07-02',
        dueDate: '2024-07-03',
        withinSla: true,
        handlingTimeDays: 1,
      },
      {
        caseId: 'CASE-21',
        taskId: 'TASK-21',
        service: 'Service A',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Alpha',
        priority: 'high',
        status: 'completed',
        createdDate: '2024-07-01',
        completedDate: '2024-07-05',
        dueDate: '2024-07-03',
        withinSla: false,
        handlingTimeDays: 4,
      },
      {
        caseId: 'CASE-22',
        taskId: 'TASK-22',
        service: 'Service A',
        roleCategory: 'Ops',
        region: undefined as unknown as string,
        location: undefined as unknown as string,
        taskName: 'Beta',
        priority: 'low',
        status: 'completed',
        createdDate: '2024-07-01',
        completedDate: 'bad-date',
        dueDate: '2024-07-03',
      },
    ];

    const completed = completedService.buildCompleted(tasks);
    const regions = completedService.buildCompletedByRegionLocation(tasks);

    expect(completed.summary.withinDueYes).toBe(1);
    expect(completed.summary.withinDueNo).toBe(2);
    expect(completed.handlingTimeStats.averageDays).toBe(2.5);
    expect(regions.byRegion[0].region).toBe('North');
  });

  test('builds processing and handling time series by date', () => {
    const tasks: Task[] = [
      {
        caseId: 'CASE-30',
        taskId: 'TASK-30',
        service: 'Service A',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Alpha',
        priority: 'high',
        status: 'completed',
        createdDate: '2024-08-01',
        completedDate: '2024-08-02',
        handlingTimeDays: 2,
        processingTimeDays: 1,
      },
      {
        caseId: 'CASE-31',
        taskId: 'TASK-31',
        service: 'Service A',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Alpha',
        priority: 'high',
        status: 'completed',
        createdDate: '2024-08-01',
        completedDate: '2024-08-02',
        handlingTimeDays: 4,
        processingTimeDays: 5,
      },
    ];

    const completed = completedService.buildCompleted(tasks);
    const point = completed.processingHandlingTime[0];

    expect(point.date).toBe('2024-08-02');
    expect(point.tasks).toBe(2);
    expect(point.handlingAverageDays).toBe(3);
    expect(point.handlingStdDevDays).toBe(1);
    expect(point.handlingSumDays).toBe(6);
    expect(point.handlingCount).toBe(2);
    expect(point.processingAverageDays).toBe(3);
    expect(point.processingStdDevDays).toBe(2);
    expect(point.processingSumDays).toBe(6);
    expect(point.processingCount).toBe(2);
  });

  test('calculates processing time stats when requested', () => {
    const stats = __testing.buildHandlingStats(
      [{ processingTimeDays: 4 } as Task, { processingTimeDays: 6 } as Task],
      'processingTime'
    );

    expect(stats.averageDays).toBe(5);
    expect(stats.lowerRange).toBe(4);
    expect(stats.upperRange).toBe(6);
  });
});
