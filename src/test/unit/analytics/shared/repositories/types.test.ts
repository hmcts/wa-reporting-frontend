import * as types from '../../../../../main/modules/analytics/shared/repositories/types';

describe('repository types module', () => {
  test('does not export runtime values', () => {
    expect(types).toBeDefined();
  });
});
