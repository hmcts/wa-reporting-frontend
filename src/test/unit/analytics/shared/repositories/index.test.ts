import * as repositories from '../../../../../main/modules/analytics/shared/repositories';
import { caseWorkerProfileRepository } from '../../../../../main/modules/analytics/shared/repositories/caseWorkerProfileRepository';
import { regionRepository } from '../../../../../main/modules/analytics/shared/repositories/regionRepository';
import { snapshotBatchesRepository } from '../../../../../main/modules/analytics/shared/repositories/snapshotBatchesRepository';
import { snapshotCompletedDashboardRepository } from '../../../../../main/modules/analytics/shared/repositories/snapshotCompletedDashboardRepository';
import { snapshotCompletedDashboardFactsRepository } from '../../../../../main/modules/analytics/shared/repositories/snapshotCompletedDashboardFactsRepository';
import { snapshotCompletedDailyMetricsFactsRepository } from '../../../../../main/modules/analytics/shared/repositories/snapshotCompletedDailyMetricsFactsRepository';
import { snapshotCompletedRegionLocationFactsRepository } from '../../../../../main/modules/analytics/shared/repositories/snapshotCompletedRegionLocationFactsRepository';
import { snapshotCompletedTaskRowsRepository } from '../../../../../main/modules/analytics/shared/repositories/snapshotCompletedTaskRowsRepository';
import { snapshotOpenDueDailyFactsRepository } from '../../../../../main/modules/analytics/shared/repositories/snapshotOpenDueDailyFactsRepository';
import { snapshotOpenTaskRowsRepository } from '../../../../../main/modules/analytics/shared/repositories/snapshotOpenTaskRowsRepository';
import { snapshotStateRepository } from '../../../../../main/modules/analytics/shared/repositories/snapshotStateRepository';
import { snapshotTaskEventsRepository } from '../../../../../main/modules/analytics/shared/repositories/snapshotTaskEventsRepository';
import { snapshotTaskEventServiceDailyFactsRepository } from '../../../../../main/modules/analytics/shared/repositories/snapshotTaskEventServiceDailyFactsRepository';
import { snapshotUserCompletedDailyTotalsRepository } from '../../../../../main/modules/analytics/shared/repositories/snapshotUserCompletedDailyTotalsRepository';
import { snapshotUserCompletedFactsRepository } from '../../../../../main/modules/analytics/shared/repositories/snapshotUserCompletedFactsRepository';
import { snapshotUserCompletedRepository } from '../../../../../main/modules/analytics/shared/repositories/snapshotUserCompletedRepository';
import { snapshotUserCompletedSlicerDailyFactsRepository } from '../../../../../main/modules/analytics/shared/repositories/snapshotUserCompletedSlicerDailyFactsRepository';

describe('repositories index', () => {
  test('re-exports repositories from source modules', () => {
    expect(repositories.caseWorkerProfileRepository).toBe(caseWorkerProfileRepository);
    expect(repositories.regionRepository).toBe(regionRepository);
    expect(repositories.snapshotBatchesRepository).toBe(snapshotBatchesRepository);
    expect(repositories.snapshotCompletedDashboardRepository).toBe(snapshotCompletedDashboardRepository);
    expect(repositories.snapshotCompletedDashboardFactsRepository).toBe(snapshotCompletedDashboardFactsRepository);
    expect(repositories.snapshotCompletedDailyMetricsFactsRepository).toBe(
      snapshotCompletedDailyMetricsFactsRepository
    );
    expect(repositories.snapshotCompletedRegionLocationFactsRepository).toBe(
      snapshotCompletedRegionLocationFactsRepository
    );
    expect(repositories.snapshotCompletedTaskRowsRepository).toBe(snapshotCompletedTaskRowsRepository);
    expect(repositories.snapshotOpenDueDailyFactsRepository).toBe(snapshotOpenDueDailyFactsRepository);
    expect(repositories.snapshotOpenTaskRowsRepository).toBe(snapshotOpenTaskRowsRepository);
    expect(repositories.snapshotStateRepository).toBe(snapshotStateRepository);
    expect(repositories.snapshotTaskEventsRepository).toBe(snapshotTaskEventsRepository);
    expect(repositories.snapshotTaskEventServiceDailyFactsRepository).toBe(
      snapshotTaskEventServiceDailyFactsRepository
    );
    expect(repositories.snapshotUserCompletedDailyTotalsRepository).toBe(snapshotUserCompletedDailyTotalsRepository);
    expect(repositories.snapshotUserCompletedFactsRepository).toBe(snapshotUserCompletedFactsRepository);
    expect(repositories.snapshotUserCompletedRepository).toBe(snapshotUserCompletedRepository);
    expect(repositories.snapshotUserCompletedSlicerDailyFactsRepository).toBe(
      snapshotUserCompletedSlicerDailyFactsRepository
    );
  });
});
