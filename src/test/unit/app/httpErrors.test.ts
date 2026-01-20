import { HTTPError as RootHTTPError } from '../../../main/HttpError';
import { HTTPError as AppHTTPError } from '../../../main/app/errors/HttpError';

describe('HTTPError', () => {
  it('stores message and status for root HTTPError', () => {
    const err = new RootHTTPError('failure', 418);

    expect(err.message).toBe('failure');
    expect(err.status).toBe(418);
  });

  it('stores message and status for app HTTPError', () => {
    const err = new AppHTTPError(400, 'bad request');

    expect(err.message).toBe('bad request');
    expect(err.status).toBe(400);
  });

  it('allows an empty message in app HTTPError', () => {
    const err = new AppHTTPError(401);

    expect(err.message).toBe('');
    expect(err.status).toBe(401);
  });
});
