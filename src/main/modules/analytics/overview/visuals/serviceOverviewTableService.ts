import { taskFactsRepository } from '../../shared/repositories';
import { emptyServiceOverviewRow } from '../../shared/series';
import { AnalyticsFilters, OverviewResponse, ServiceOverviewRow } from '../../shared/types';
import { calculatePercent, toNumber } from '../../shared/utils';

function withAssignedPct(row: ServiceOverviewRow): ServiceOverviewRow {
  const assignedPct = calculatePercent(row.assigned, row.open);
  return { ...row, assignedPct };
}

class ServiceOverviewTableService {
  async fetchServiceOverview(filters: AnalyticsFilters): Promise<OverviewResponse> {
    const rows = await taskFactsRepository.fetchServiceOverviewRows(filters);

    const serviceRows = rows.map(row => {
      const mapped: ServiceOverviewRow = {
        service: row.service,
        open: toNumber(row.open_tasks),
        assigned: toNumber(row.assigned_tasks),
        assignedPct: 0,
        urgent: toNumber(row.urgent),
        high: toNumber(row.high),
        medium: toNumber(row.medium),
        low: toNumber(row.low),
      };
      return withAssignedPct(mapped);
    });

    const totals = serviceRows.reduce((acc, row) => {
      acc.open += row.open;
      acc.assigned += row.assigned;
      acc.urgent += row.urgent;
      acc.high += row.high;
      acc.medium += row.medium;
      acc.low += row.low;
      return acc;
    }, emptyServiceOverviewRow('Total'));

    return { serviceRows, totals: withAssignedPct(totals) };
  }
}

export const serviceOverviewTableService = new ServiceOverviewTableService();
