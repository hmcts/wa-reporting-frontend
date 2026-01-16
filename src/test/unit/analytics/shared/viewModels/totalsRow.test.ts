import {
  buildTotalRow,
  buildTotalsRow,
  buildTotalsRowWithLabelColumns,
} from '../../../../../main/modules/analytics/shared/viewModels/totalsRow';

describe('buildTotalsRow', () => {
  test('formats numeric values and preserves strings', () => {
    const row = buildTotalsRow('Total', [1000, '10%', '']);

    expect(row[0].text).toBe('Total');
    expect(row[1].text).toBe('1,000');
    expect(row[2].text).toBe('10%');
    expect(row[3].text).toBe('');
  });

  test('buildTotalsRowWithLabelColumns adds prefixes and trailing blanks', () => {
    const row = buildTotalsRowWithLabelColumns('Total', 2, [1, 2], 1);

    expect(row).toEqual([{ text: 'Total' }, { text: '' }, { text: '1' }, { text: '2' }, { text: '' }]);
  });

  test('buildTotalsRowWithLabelColumns preserves string values', () => {
    const row = buildTotalsRowWithLabelColumns('Total', 1, ['N/A']);

    expect(row).toEqual([{ text: 'Total' }, { text: 'N/A' }]);
  });

  test('buildTotalRow uses the Total label', () => {
    const row = buildTotalRow([5]);

    expect(row[0].text).toBe('Total');
    expect(row[1].text).toBe('5');
  });
});
