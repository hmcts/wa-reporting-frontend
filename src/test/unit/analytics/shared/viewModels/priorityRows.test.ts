import { buildPriorityRows } from '../../../../../main/modules/analytics/shared/viewModels/priorityRows';

describe('buildPriorityRows', () => {
  test('formats priority numbers', () => {
    const rows = buildPriorityRows({ urgent: 10, high: 2, medium: 0, low: 5 });

    expect(rows).toEqual([
      { label: 'Urgent', value: '10' },
      { label: 'High', value: '2' },
      { label: 'Medium', value: '0' },
      { label: 'Low', value: '5' },
    ]);
  });
});
