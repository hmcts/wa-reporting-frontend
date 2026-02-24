import { OpenTasksByRegionLocationRow, taskFactsRepository } from '../../shared/repositories';
import { AnalyticsFilters, OutstandingByLocationRow, OutstandingByRegionRow } from '../../shared/types';
import { normaliseLabel, toNumber } from '../../shared/utils';

function mapLocationRows(rows: OpenTasksByRegionLocationRow[]): OutstandingByLocationRow[] {
  return rows
    .map(row => ({
      location: normaliseLabel(row.location),
      region: normaliseLabel(row.region),
      open: toNumber(row.open_tasks),
      urgent: toNumber(row.urgent),
      high: toNumber(row.high),
      medium: toNumber(row.medium),
      low: toNumber(row.low),
    }))
    .sort((a, b) => {
      const locationCompare = a.location.localeCompare(b.location);
      if (locationCompare !== 0) {
        return locationCompare;
      }
      return a.region.localeCompare(b.region);
    });
}

function buildRegionRows(locationRows: OutstandingByLocationRow[]): OutstandingByRegionRow[] {
  const map = new Map<string, OutstandingByRegionRow>();
  locationRows.forEach(row => {
    const entry = map.get(row.region) ?? {
      region: row.region,
      open: 0,
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    entry.open += row.open;
    entry.urgent += row.urgent;
    entry.high += row.high;
    entry.medium += row.medium;
    entry.low += row.low;
    map.set(row.region, entry);
  });

  return Array.from(map.values()).sort((a, b) => a.region.localeCompare(b.region));
}

class OpenTasksByRegionLocationTableService {
  async fetchOpenTasksByRegionLocation(
    snapshotId: number,
    filters: AnalyticsFilters
  ): Promise<{
    locationRows: OutstandingByLocationRow[];
    regionRows: OutstandingByRegionRow[];
  }> {
    const rows = await taskFactsRepository.fetchOpenTasksByRegionLocationRows(snapshotId, filters);
    const locationRows = mapLocationRows(rows);
    const regionRows = buildRegionRows(locationRows);
    return { locationRows, regionRows };
  }
}

export const openTasksByRegionLocationTableService = new OpenTasksByRegionLocationTableService();
