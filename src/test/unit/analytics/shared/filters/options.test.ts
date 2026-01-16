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
});
