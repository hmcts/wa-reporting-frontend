import { buildSelectOptions } from '../../../../../main/modules/analytics/shared/filters/options';

describe('buildSelectOptions', () => {
  test('builds unique sorted options with display map', () => {
    const options = buildSelectOptions(['Beta', undefined, 'Alpha', 'Alpha'], 'services', {
      Alpha: 'Alpha Service',
    });

    expect(options).toEqual([
      { value: '', text: 'All services' },
      { value: 'Alpha', text: 'Alpha Service' },
      { value: 'Beta', text: 'Beta' },
    ]);
  });

  test('builds unique sorted options from SelectOption rows', () => {
    const options = buildSelectOptions(
      [
        { value: 'id-b', text: 'Beta' },
        { value: '', text: '(Blank)' },
        { value: 'id-a', text: 'Alpha' },
        { value: 'id-a', text: 'Alpha (duplicate)' },
      ],
      'work types'
    );

    expect(options).toEqual([
      { value: '', text: 'All work types' },
      { value: 'id-a', text: 'Alpha' },
      { value: 'id-b', text: 'Beta' },
    ]);
  });
});
