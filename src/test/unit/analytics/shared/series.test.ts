import {
  emptyAssignmentSeriesPoint,
  emptyOutstandingSummary,
  emptyPrioritySeriesPoint,
  emptyServiceOverviewRow,
  emptyTaskEventsByServiceRow,
} from '../../../../main/modules/analytics/shared/series';

describe('analytics series helpers', () => {
  test('builds empty series and summary objects', () => {
    expect(emptyAssignmentSeriesPoint('2024-01-01')).toEqual({
      date: '2024-01-01',
      open: 0,
      assigned: 0,
      unassigned: 0,
      assignedPct: 0,
      unassignedPct: 0,
    });
    expect(emptyPrioritySeriesPoint('2024-01-02')).toEqual({
      date: '2024-01-02',
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
    });
    expect(emptyOutstandingSummary()).toEqual({
      open: 0,
      assigned: 0,
      unassigned: 0,
      assignedPct: 0,
      unassignedPct: 0,
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
    });
    expect(emptyServiceOverviewRow('Service A')).toEqual({
      service: 'Service A',
      open: 0,
      assigned: 0,
      assignedPct: 0,
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
    });
    expect(emptyTaskEventsByServiceRow('Service B')).toEqual({
      service: 'Service B',
      completed: 0,
      cancelled: 0,
      created: 0,
    });
  });
});
