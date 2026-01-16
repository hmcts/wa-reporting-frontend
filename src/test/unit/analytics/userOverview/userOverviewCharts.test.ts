import {
  buildUserCompletedByDateChart,
  buildUserCompletedComplianceChart,
  buildUserPriorityChart,
} from '../../../../main/modules/analytics/userOverview/visuals/charts';

describe('userOverviewCharts', () => {
  test('buildUserPriorityChart uses summary values', () => {
    const config = JSON.parse(buildUserPriorityChart({ urgent: 1, high: 2, medium: 3, low: 4 }));
    expect(config.data[0].values).toEqual([1, 2, 3, 4]);
  });

  test('buildUserCompletedByDateChart uses date series', () => {
    const config = JSON.parse(
      buildUserCompletedByDateChart([
        {
          date: '2024-01-01',
          tasks: 3,
          withinDue: 2,
          beyondDue: 1,
          handlingTimeSum: 6,
          handlingTimeCount: 2,
        },
      ])
    );
    expect(config.data[0].x).toEqual(['2024-01-01']);
    expect(config.data[0].y).toEqual([2]);
    expect(config.data[1].y).toEqual([1]);
    expect(config.data[2].y).toEqual([3]);
    expect(config.data[2].yaxis).toBe('y2');
  });

  test('buildUserCompletedComplianceChart uses summary values', () => {
    const config = JSON.parse(buildUserCompletedComplianceChart({ withinDueYes: 3, withinDueNo: 1 }));
    expect(config.data[0].values).toEqual([3, 1]);
  });
});
