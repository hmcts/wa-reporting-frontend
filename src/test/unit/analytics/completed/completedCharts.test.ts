import {
  buildCompletedByNameChart,
  buildComplianceChart,
  buildHandlingChart,
  buildTimelineChart,
} from '../../../../main/modules/analytics/completed/visuals/charts';

describe('completedCharts', () => {
  test('buildComplianceChart uses summary values', () => {
    const config = JSON.parse(buildComplianceChart({ withinDueYes: 2, withinDueNo: 1 }));
    expect(config.data[0].values).toEqual([2, 1]);
  });

  test('buildTimelineChart uses timeline data', () => {
    const config = JSON.parse(
      buildTimelineChart([
        { date: '2024-01-01', completed: 3, withinDue: 2, beyondDue: 1 },
        { date: '2024-01-02', completed: 1, withinDue: 1, beyondDue: 0 },
      ])
    );
    expect(config.data[0].x).toEqual(['2024-01-01', '2024-01-02']);
  });

  test('buildCompletedByNameChart uses task counts', () => {
    const config = JSON.parse(
      buildCompletedByNameChart([
        { taskName: 'Review', tasks: 4, withinDue: 3, beyondDue: 1 },
        { taskName: 'Audit', tasks: 2, withinDue: 1, beyondDue: 1 },
      ])
    );
    expect(config.data[0].x).toEqual([3, 1]);
    expect(config.layout.yaxis.categoryarray).toEqual(['Review', 'Audit']);
  });

  test('buildCompletedByNameChart sorts by name when totals tie', () => {
    const config = JSON.parse(
      buildCompletedByNameChart([
        { taskName: 'Beta', tasks: 2, withinDue: 1, beyondDue: 1 },
        { taskName: 'Alpha', tasks: 2, withinDue: 2, beyondDue: 0 },
      ])
    );

    expect(config.layout.yaxis.categoryarray).toEqual(['Alpha', 'Beta']);
  });

  test('buildHandlingChart uses average and ranges', () => {
    const config = JSON.parse(
      buildHandlingChart({ metric: 'handlingTime', averageDays: 2, lowerRange: 1, upperRange: 3 })
    );
    expect(config.data[0].y).toEqual([2]);
  });
});
