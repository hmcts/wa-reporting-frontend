import * as repositories from '../../../../../main/modules/analytics/shared/repositories';
import { caseWorkerProfileRepository } from '../../../../../main/modules/analytics/shared/repositories/caseWorkerProfileRepository';
import { courtVenueRepository } from '../../../../../main/modules/analytics/shared/repositories/courtVenueRepository';
import { regionRepository } from '../../../../../main/modules/analytics/shared/repositories/regionRepository';
import { snapshotBatchesRepository } from '../../../../../main/modules/analytics/shared/repositories/snapshotBatchesRepository';
import { snapshotCompletedDashboardFactsRepository } from '../../../../../main/modules/analytics/shared/repositories/snapshotCompletedDashboardFactsRepository';
import { snapshotCompletedTaskRowsRepository } from '../../../../../main/modules/analytics/shared/repositories/snapshotCompletedTaskRowsRepository';
import { snapshotOpenDueDailyFactsRepository } from '../../../../../main/modules/analytics/shared/repositories/snapshotOpenDueDailyFactsRepository';
import { snapshotOpenTaskRowsRepository } from '../../../../../main/modules/analytics/shared/repositories/snapshotOpenTaskRowsRepository';
import { snapshotStateTableRepository } from '../../../../../main/modules/analytics/shared/repositories/snapshotStateTableRepository';
import { snapshotUserCompletedFactsRepository } from '../../../../../main/modules/analytics/shared/repositories/snapshotUserCompletedFactsRepository';

describe('repositories index', () => {
  test('re-exports repositories from source modules', () => {
    expect(repositories.caseWorkerProfileRepository).toBe(caseWorkerProfileRepository);
    expect(repositories.regionRepository).toBe(regionRepository);
    expect(repositories.courtVenueRepository).toBe(courtVenueRepository);
    expect(repositories.snapshotBatchesRepository).toBe(snapshotBatchesRepository);
    expect(repositories.snapshotCompletedDashboardFactsRepository).toBe(snapshotCompletedDashboardFactsRepository);
    expect(repositories.snapshotCompletedTaskRowsRepository).toBe(snapshotCompletedTaskRowsRepository);
    expect(repositories.snapshotOpenDueDailyFactsRepository).toBe(snapshotOpenDueDailyFactsRepository);
    expect(repositories.snapshotOpenTaskRowsRepository).toBe(snapshotOpenTaskRowsRepository);
    expect(repositories.snapshotStateTableRepository).toBe(snapshotStateTableRepository);
    expect(repositories.snapshotUserCompletedFactsRepository).toBe(snapshotUserCompletedFactsRepository);
  });
});
