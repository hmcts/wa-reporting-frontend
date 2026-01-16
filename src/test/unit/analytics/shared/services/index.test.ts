import * as services from '../../../../../main/modules/analytics/shared/services';

describe('services index', () => {
  test('re-exports analytics services', () => {
    expect(services.caseWorkerProfileService).toBeDefined();
    expect(services.courtVenueService).toBeDefined();
    expect(services.filterService).toBeDefined();
    expect(services.regionService).toBeDefined();
  });
});
