import { assignmentColors, chartColors } from '../../../../../main/modules/analytics/shared/charts/colors';

describe('chart colors', () => {
  test('uses GOV.UK palette tokens', () => {
    expect(chartColors.blue).toBe('#1d70b8');
    expect(chartColors.grey).toBe('#b1b4b6');
    expect(chartColors.green).toBe('#00703c');
    expect(chartColors.signalRed).toBe('#ca3535');
    expect(chartColors.purple).toBe('#98285d');
    expect(chartColors.blueDark).toBe('#16548a');
    expect(chartColors.blueLight).toBe('#8eb8dc');
    expect(chartColors.greyLight).toBe('#cecece');
    expect((chartColors as Record<string, string>).red).toBeUndefined();
    expect((chartColors as Record<string, string>).orange).toBeUndefined();
    expect((chartColors as Record<string, string>).yellow).toBeUndefined();
  });

  test('assignment colors reuse chart palette', () => {
    expect(assignmentColors.assigned).toBe(chartColors.blue);
    expect(assignmentColors.unassigned).toBe(chartColors.grey);
  });
});
