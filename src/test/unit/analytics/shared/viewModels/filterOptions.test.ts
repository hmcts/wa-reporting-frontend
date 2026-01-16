import {
  getUniqueOptions,
  getUserOptions,
} from '../../../../../main/modules/analytics/shared/viewModels/filterOptions';

describe('filterOptions helpers', () => {
  test('getUniqueOptions returns sorted unique values with an "All" option', () => {
    const options = getUniqueOptions(['Beta', undefined, 'Alpha', 'Alpha'], 'services');

    expect(options[0]).toEqual({ value: '', text: 'All services' });
    expect(options[1]).toEqual({ value: 'Alpha', text: 'Alpha' });
    expect(options[2]).toEqual({ value: 'Beta', text: 'Beta' });
  });

  test('getUserOptions merges name/id values', () => {
    const options = getUserOptions([
      { assigneeId: 'user-1', assigneeName: 'User One' },
      { assigneeId: 'user-2', assigneeName: 'User Two' },
    ]);

    expect(options[0].text).toBe('All users');
    expect(options.map(option => option.value)).toEqual(['', 'User One', 'User Two', 'user-1', 'user-2']);
  });
});
