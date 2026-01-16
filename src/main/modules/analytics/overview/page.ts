import {
  fetchFilterOptionsWithFallback,
  resolveDateRangeWithDefaults,
  settledValueWithError,
} from '../shared/pageUtils';
import { AnalyticsFilters } from '../shared/types';
import { logDbError } from '../shared/utils';

import { overviewService } from './service';
import { buildOverviewViewModel } from './viewModel';
import { serviceOverviewTableService } from './visuals/serviceOverviewTableService';
import { taskEventsByServiceChartService } from './visuals/taskEventsByServiceChartService';

type OverviewPageViewModel = ReturnType<typeof buildOverviewViewModel>;

export async function buildOverviewPage(filters: AnalyticsFilters): Promise<OverviewPageViewModel> {
  let overview = overviewService.buildOverview([]);
  try {
    const dbOverview = await serviceOverviewTableService.fetchServiceOverview(filters);
    if (dbOverview.serviceRows.length > 0) {
      overview = dbOverview;
    }
  } catch (error) {
    logDbError('Failed to fetch service overview from database', error);
  }

  const eventsRange = resolveDateRangeWithDefaults({ from: filters.eventsFrom, to: filters.eventsTo, daysBack: 30 });
  let taskEventsRows: {
    service: string;
    completed: number;
    cancelled: number;
    created: number;
  }[] = [];
  let taskEventsTotals = { service: 'Total', completed: 0, cancelled: 0, created: 0 };

  const allTasks: { service: string; roleCategory: string; region: string; location: string; taskName: string }[] = [];
  const [eventsResult, filtersResult] = await Promise.allSettled([
    taskEventsByServiceChartService.fetchTaskEventsByService(filters, eventsRange),
    fetchFilterOptionsWithFallback('Failed to fetch overview filter options from database'),
  ]);

  const eventsValue = settledValueWithError(eventsResult, 'Failed to fetch task events by service from database');
  if (eventsValue) {
    taskEventsRows = eventsValue.rows;
    taskEventsTotals = eventsValue.totals;
  }

  const filterOptions =
    filtersResult.status === 'fulfilled'
      ? filtersResult.value
      : await fetchFilterOptionsWithFallback('Failed to fetch overview filter options from database');

  return buildOverviewViewModel({
    filters,
    overview,
    filterOptions,
    allTasks,
    taskEventsRows,
    taskEventsTotals,
    eventsRange,
  });
}
