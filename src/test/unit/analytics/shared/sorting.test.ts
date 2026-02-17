import { sortByTotalThenName, sortPriorityBreakdowns } from '../../../../main/modules/analytics/shared/sorting';

describe('sorting helpers', () => {
  test('sortPriorityBreakdowns orders by urgent count, then total, then name', () => {
    const rows = [
      { name: 'C', urgent: 1, high: 0, medium: 1, low: 0 },
      { name: 'A', urgent: 1, high: 0, medium: 0, low: 0 },
      { name: 'B', urgent: 1, high: 1, medium: 0, low: 0 },
      { name: 'D', urgent: 0, high: 10, medium: 0, low: 0 },
    ];

    expect(sortPriorityBreakdowns(rows).map(row => row.name)).toEqual(['B', 'C', 'A', 'D']);
  });

  test('sortPriorityBreakdowns uses name for full ties', () => {
    const rows = [
      { name: 'Task B', urgent: 0, high: 1, medium: 2, low: 3 },
      { name: 'Task A', urgent: 0, high: 1, medium: 2, low: 3 },
    ];

    expect(sortPriorityBreakdowns(rows).map(row => row.name)).toEqual(['Task A', 'Task B']);
  });

  test('sortByTotalThenName orders descending by total then ascending by name', () => {
    const rows = [
      { name: 'B', value: 2 },
      { name: 'A', value: 2 },
      { name: 'C', value: 3 },
    ];

    const sorted = sortByTotalThenName(
      rows,
      row => row.value,
      row => row.name
    );

    expect(sorted.map(row => row.name)).toEqual(['C', 'A', 'B']);
  });
});
