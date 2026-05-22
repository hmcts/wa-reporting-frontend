import { OverviewFilterOptionsRows } from './types';
import { FilterFactsQueryParams, fetchFilterOptionsRows } from './filterFactsQueryHelpers';

const TABLE_NAME = 'analytics.snapshot_completed_filter_facts';

export class SnapshotCompletedFilterFactsRepository {
  async fetchFilterOptionsRows(
    snapshotId: number,
    params?: FilterFactsQueryParams
  ): Promise<OverviewFilterOptionsRows> {
    return fetchFilterOptionsRows({ tableName: TABLE_NAME, supportsAssigneeFacet: false }, snapshotId, params);
  }
}

export const snapshotCompletedFilterFactsRepository = new SnapshotCompletedFilterFactsRepository();
