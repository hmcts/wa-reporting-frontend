import { OverviewFilterOptionsRows } from './types';
import { FilterFactsQueryParams, fetchFilterOptionsRows } from './filterFactsQueryHelpers';

const TABLE_NAME = 'analytics.snapshot_overview_filter_facts';

export class SnapshotOverviewFilterFactsRepository {
  async fetchFilterOptionsRows(
    snapshotId: number,
    params?: FilterFactsQueryParams
  ): Promise<OverviewFilterOptionsRows> {
    return fetchFilterOptionsRows({ tableName: TABLE_NAME, supportsAssigneeFacet: false }, snapshotId, params);
  }
}

export const snapshotOverviewFilterFactsRepository = new SnapshotOverviewFilterFactsRepository();
