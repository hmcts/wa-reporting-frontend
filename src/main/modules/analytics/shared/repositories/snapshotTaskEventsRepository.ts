import { AnalyticsFilters } from '../types';

import { hasSelectedFilter } from './filterSelection';
import { snapshotTaskEventDailyFactsRepository } from './snapshotTaskEventDailyFactsRepository';
import { snapshotTaskEventServiceDailyFactsRepository } from './snapshotTaskEventServiceDailyFactsRepository';
import { TaskEventsByServiceDbRow } from './types';

const SERVICE_ROLLUP_UNSUPPORTED_FILTER_KEYS = [
  'roleCategory',
  'region',
  'location',
  'taskName',
  'workType',
  'user',
] as const;

function canUseServiceDailyRollup(filters: AnalyticsFilters): boolean {
  return !hasSelectedFilter(filters, SERVICE_ROLLUP_UNSUPPORTED_FILTER_KEYS);
}

export class SnapshotTaskEventsRepository {
  async fetchTaskEventsByServiceRows(
    snapshotId: number,
    filters: AnalyticsFilters,
    range: { from: Date; to: Date }
  ): Promise<TaskEventsByServiceDbRow[]> {
    return canUseServiceDailyRollup(filters)
      ? snapshotTaskEventServiceDailyFactsRepository.fetchTaskEventsByServiceRows(snapshotId, filters, range)
      : snapshotTaskEventDailyFactsRepository.fetchTaskEventsByServiceRows(snapshotId, filters, range);
  }
}

export const snapshotTaskEventsRepository = new SnapshotTaskEventsRepository();
