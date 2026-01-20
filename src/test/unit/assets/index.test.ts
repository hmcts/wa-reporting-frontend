/* @jest-environment jsdom */
import { initAll as initMojAll } from '@ministryofjustice/frontend';
import { initAll } from 'govuk-frontend';

jest.mock('../../../main/assets/scss/main.scss', () => ({}), { virtual: true });
jest.mock('govuk-frontend', () => ({ initAll: jest.fn() }));
jest.mock('@ministryofjustice/frontend', () => ({ initAll: jest.fn() }));

import '../../../main/assets/js/index';

describe('main frontend bootstrap', () => {
  it('initialises GOV.UK and MOJ frontends', () => {
    expect(initAll).toHaveBeenCalled();
    expect(initMojAll).toHaveBeenCalled();
  });
});
