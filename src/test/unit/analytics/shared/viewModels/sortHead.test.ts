import { buildSortHeadCell } from '../../../../../main/modules/analytics/shared/viewModels/sortHead';

describe('buildSortHeadCell', () => {
  test('returns inactive sort metadata by default', () => {
    const cell = buildSortHeadCell({
      label: 'Case ID',
      sortKey: 'caseId',
      activeSort: { by: 'priority', dir: 'asc' },
    });

    expect(cell.text).toBe('Case ID');
    expect(cell.attributes).toEqual({
      'data-sort-key': 'caseId',
      'aria-sort': 'none',
    });
    expect(cell.attributes?.['data-sort-dir']).toBeUndefined();
  });

  test('returns inactive sort metadata with default direction when configured', () => {
    const cell = buildSortHeadCell({
      label: 'Priority',
      sortKey: 'priority',
      defaultDir: 'desc',
      activeSort: { by: 'dueDate', dir: 'asc' },
    });

    expect(cell.attributes).toEqual({
      'data-sort-key': 'priority',
      'data-sort-default-dir': 'desc',
      'aria-sort': 'none',
    });
  });

  test('returns active ascending sort metadata', () => {
    const cell = buildSortHeadCell({
      label: 'Case ID',
      sortKey: 'caseId',
      format: 'numeric',
      activeSort: { by: 'caseId', dir: 'asc' },
    });

    expect(cell.format).toBe('numeric');
    expect(cell.attributes).toEqual({
      'data-sort-key': 'caseId',
      'data-sort-dir': 'asc',
      'aria-sort': 'ascending',
    });
  });

  test('returns active descending sort metadata', () => {
    const cell = buildSortHeadCell({
      label: 'Priority',
      sortKey: 'priority',
      activeSort: { by: 'priority', dir: 'desc' },
    });

    expect(cell.attributes).toEqual({
      'data-sort-key': 'priority',
      'data-sort-dir': 'desc',
      'aria-sort': 'descending',
    });
  });
});
