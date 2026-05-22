import { AnalyticsFilters } from '../types';

import { AnalyticsQueryOptions } from './filters';
import { SHARED_FILTER_KEYS, hasSelectedFilter, hasSelectedValues } from './filterSelection';
import { snapshotUserCompletedDailyTotalsRepository } from './snapshotUserCompletedDailyTotalsRepository';
import { snapshotUserCompletedFactsRepository } from './snapshotUserCompletedFactsRepository';
import { snapshotUserCompletedSlicerDailyFactsRepository } from './snapshotUserCompletedSlicerDailyFactsRepository';
import { CompletedSummaryRow, UserOverviewCompletedByDateRow, UserOverviewCompletedByTaskNameRow } from './types';

function hasUserFilter(filters: AnalyticsFilters): boolean {
  return hasSelectedValues(filters.user);
}

function usesUserOverviewRoleExclusion(queryOptions?: AnalyticsQueryOptions): boolean {
  const excluded = queryOptions?.excludeRoleCategories;
  if (!excluded || excluded.length !== 1) {
    return false;
  }
  return excluded[0].trim().toUpperCase() === 'JUDICIAL';
}

function canUseUserOverviewCompletedRollups(filters: AnalyticsFilters, queryOptions?: AnalyticsQueryOptions): boolean {
  return !hasUserFilter(filters) && usesUserOverviewRoleExclusion(queryOptions);
}

export class SnapshotUserCompletedRepository {
  async fetchUserOverviewCompletedSummaryRows(
    snapshotId: number,
    filters: AnalyticsFilters,
    queryOptions?: AnalyticsQueryOptions
  ): Promise<CompletedSummaryRow[]> {
    if (!canUseUserOverviewCompletedRollups(filters, queryOptions)) {
      return snapshotUserCompletedFactsRepository.fetchUserOverviewCompletedSummaryRows(
        snapshotId,
        filters,
        queryOptions
      );
    }

    return hasSelectedFilter(filters, SHARED_FILTER_KEYS)
      ? snapshotUserCompletedSlicerDailyFactsRepository.fetchUserOverviewCompletedSummaryRows(snapshotId, filters)
      : snapshotUserCompletedDailyTotalsRepository.fetchUserOverviewCompletedSummaryRows(snapshotId, filters);
  }

  async fetchUserOverviewCompletedByDateRows(
    snapshotId: number,
    filters: AnalyticsFilters,
    queryOptions?: AnalyticsQueryOptions
  ): Promise<UserOverviewCompletedByDateRow[]> {
    if (!canUseUserOverviewCompletedRollups(filters, queryOptions)) {
      return snapshotUserCompletedFactsRepository.fetchUserOverviewCompletedByDateRows(
        snapshotId,
        filters,
        queryOptions
      );
    }

    return hasSelectedFilter(filters, SHARED_FILTER_KEYS)
      ? snapshotUserCompletedSlicerDailyFactsRepository.fetchUserOverviewCompletedByDateRows(snapshotId, filters)
      : snapshotUserCompletedDailyTotalsRepository.fetchUserOverviewCompletedByDateRows(snapshotId, filters);
  }

  async fetchUserOverviewCompletedByTaskNameRows(
    snapshotId: number,
    filters: AnalyticsFilters,
    queryOptions?: AnalyticsQueryOptions
  ): Promise<UserOverviewCompletedByTaskNameRow[]> {
    return canUseUserOverviewCompletedRollups(filters, queryOptions)
      ? snapshotUserCompletedSlicerDailyFactsRepository.fetchUserOverviewCompletedByTaskNameRows(snapshotId, filters)
      : snapshotUserCompletedFactsRepository.fetchUserOverviewCompletedByTaskNameRows(
          snapshotId,
          filters,
          queryOptions
        );
  }
}

export const snapshotUserCompletedRepository = new SnapshotUserCompletedRepository();
