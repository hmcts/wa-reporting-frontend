import { OverviewFilterOptionsRows } from './types';
import { FilterFactsQueryParams, fetchFilterOptionsRows } from './filterFactsQueryHelpers';

const TABLE_NAME = 'analytics.snapshot_user_filter_facts';

export class SnapshotUserFilterFactsRepository {
  async fetchFilterOptionsRows(
    snapshotId: number,
    params?: FilterFactsQueryParams
  ): Promise<OverviewFilterOptionsRows> {
    return fetchFilterOptionsRows({ tableName: TABLE_NAME, supportsAssigneeFacet: true }, snapshotId, params);
  }
}

export const snapshotUserFilterFactsRepository = new SnapshotUserFilterFactsRepository();
