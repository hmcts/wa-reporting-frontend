import * as repositories from '../../../../../main/modules/analytics/shared/repositories';

describe('repositories index', () => {
  test('re-exports repositories', () => {
    expect(repositories.caseWorkerProfileRepository).toBeDefined();
    expect(repositories.regionRepository).toBeDefined();
    expect(repositories.courtVenueRepository).toBeDefined();
    expect(repositories.taskFactsRepository).toBeDefined();
    expect(repositories.taskThinRepository).toBeDefined();
  });
});
