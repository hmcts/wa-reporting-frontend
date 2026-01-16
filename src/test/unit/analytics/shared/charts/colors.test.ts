import { assignmentColors, chartColors } from '../../../../../main/modules/analytics/shared/charts/colors';

describe('chart colors', () => {
  test('uses GOV.UK palette tokens', () => {
    expect(chartColors.urgent).toBe('#d4351c');
    expect(chartColors.low).toBe('#1d70b8');
  });

  test('assignment colors reuse chart palette', () => {
    expect(assignmentColors.assigned).toBe(chartColors.low);
    expect(assignmentColors.unassigned).toBe(chartColors.notProvided);
  });
});
