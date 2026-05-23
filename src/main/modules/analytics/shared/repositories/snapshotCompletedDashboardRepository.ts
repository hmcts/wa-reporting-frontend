import { AnalyticsFilters } from '../types';

import { AnalyticsQueryOptions } from './filters';
import { SHARED_FILTER_KEYS, hasActiveExcludeRoleCategories, hasSelectedFilter } from './filterSelection';
import { snapshotCompletedDailyMetricsFactsRepository } from './snapshotCompletedDailyMetricsFactsRepository';
import { snapshotCompletedDashboardFactsRepository } from './snapshotCompletedDashboardFactsRepository';
import { snapshotCompletedRegionLocationFactsRepository } from './snapshotCompletedRegionLocationFactsRepository';
import {
  CompletedByNameRow,
  CompletedProcessingHandlingTimeRow,
  CompletedRegionLocationAggregateRow,
  CompletedSummaryRow,
  CompletedTimelineRow,
} from './types';

const REGION_LOCATION_ROLLUP_UNSUPPORTED_FILTER_KEYS = ['service', 'roleCategory', 'taskName', 'workType'] as const;

function canUseCompletedDailyMetricsRollup(filters: AnalyticsFilters, queryOptions?: AnalyticsQueryOptions): boolean {
  return (
    !hasActiveExcludeRoleCategories(queryOptions?.excludeRoleCategories) &&
    !hasSelectedFilter(filters, SHARED_FILTER_KEYS)
  );
}

function canUseCompletedRegionLocationRollup(filters: AnalyticsFilters): boolean {
  return !hasSelectedFilter(filters, REGION_LOCATION_ROLLUP_UNSUPPORTED_FILTER_KEYS);
}

export class SnapshotCompletedDashboardRepository {
  async fetchCompletedSummaryRows(
    snapshotId: number,
    filters: AnalyticsFilters,
    range?: { from?: Date; to?: Date },
    queryOptions?: AnalyticsQueryOptions
  ): Promise<CompletedSummaryRow[]> {
    return canUseCompletedDailyMetricsRollup(filters, queryOptions)
      ? snapshotCompletedDailyMetricsFactsRepository.fetchCompletedSummaryRows(snapshotId, range)
      : snapshotCompletedDashboardFactsRepository.fetchCompletedSummaryRows(snapshotId, filters, range, queryOptions);
  }

  async fetchCompletedTimelineRows(
    snapshotId: number,
    filters: AnalyticsFilters,
    range?: { from?: Date; to?: Date }
  ): Promise<CompletedTimelineRow[]> {
    return canUseCompletedDailyMetricsRollup(filters)
      ? snapshotCompletedDailyMetricsFactsRepository.fetchCompletedTimelineRows(snapshotId, range)
      : snapshotCompletedDashboardFactsRepository.fetchCompletedTimelineRows(snapshotId, filters, range);
  }

  async fetchCompletedProcessingHandlingTimeRows(
    snapshotId: number,
    filters: AnalyticsFilters,
    range?: { from?: Date; to?: Date }
  ): Promise<CompletedProcessingHandlingTimeRow[]> {
    return canUseCompletedDailyMetricsRollup(filters)
      ? snapshotCompletedDailyMetricsFactsRepository.fetchCompletedProcessingHandlingTimeRows(snapshotId, range)
      : snapshotCompletedDashboardFactsRepository.fetchCompletedProcessingHandlingTimeRows(snapshotId, filters, range);
  }

  async fetchCompletedByNameRows(
    snapshotId: number,
    filters: AnalyticsFilters,
    range?: { from?: Date; to?: Date }
  ): Promise<CompletedByNameRow[]> {
    return snapshotCompletedDashboardFactsRepository.fetchCompletedByNameRows(snapshotId, filters, range);
  }

  async fetchCompletedRegionLocationRows(
    snapshotId: number,
    filters: AnalyticsFilters,
    range?: { from?: Date; to?: Date }
  ): Promise<CompletedRegionLocationAggregateRow[]> {
    return canUseCompletedRegionLocationRollup(filters)
      ? snapshotCompletedRegionLocationFactsRepository.fetchCompletedRegionLocationRows(snapshotId, filters, range)
      : snapshotCompletedDashboardFactsRepository.fetchCompletedRegionLocationRows(snapshotId, filters, range);
  }
}

export const snapshotCompletedDashboardRepository = new SnapshotCompletedDashboardRepository();
