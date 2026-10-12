/* @jest-environment jsdom */
import { initAll as initMojAll } from '@ministryofjustice/frontend';
import { initAll } from 'govuk-frontend';

const initializeSessionTimeout = jest.fn();

jest.mock('../../../main/assets/scss/main.scss', () => ({}), { virtual: true });
jest.mock('govuk-frontend', () => ({ initAll: jest.fn() }));
jest.mock('@ministryofjustice/frontend', () => ({ initAll: jest.fn() }));
jest.mock('../../../main/assets/js/sessionTimeout', () => ({ initializeSessionTimeout }));

import '../../../main/assets/js/index';

describe('main frontend bootstrap', () => {
  it('initialises GOV.UK and MOJ frontends and the session timeout', () => {
    expect(initAll).toHaveBeenCalled();
    expect(initMojAll).toHaveBeenCalled();
    expect(initializeSessionTimeout).toHaveBeenCalled();
  });
});
