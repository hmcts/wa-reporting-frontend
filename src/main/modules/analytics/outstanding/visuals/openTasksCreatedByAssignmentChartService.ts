import { taskFactsRepository } from '../../shared/repositories';
import { emptyAssignmentSeriesPoint } from '../../shared/series';
import { AnalyticsFilters, AssignmentSeriesPoint } from '../../shared/types';
import { calculatePercent, groupByDateKey, toNumber } from '../../shared/utils';

type AssignmentKey = 'assigned' | 'unassigned';

const assignmentMap: Record<string, AssignmentKey> = {
  Assigned: 'assigned',
  Unassigned: 'unassigned',
};

class OpenTasksCreatedByAssignmentChartService {
  async fetchOpenTasksCreatedByAssignment(filters: AnalyticsFilters): Promise<AssignmentSeriesPoint[]> {
    const rows = await taskFactsRepository.fetchOpenTasksCreatedByAssignmentRows(filters);
    return groupByDateKey(
      rows,
      row => row.date_key,
      emptyAssignmentSeriesPoint,
      (point, row) => {
        const key = assignmentMap[row.assignment_state];
        if (!key) {
          return false;
        }
        point[key] += toNumber(row.total);
        point.open = point.assigned + point.unassigned;
        const assignedPct = calculatePercent(point.assigned, point.open);
        point.assignedPct = assignedPct;
        point.unassignedPct = 100 - assignedPct;
        return true;
      }
    );
  }
}

export const openTasksCreatedByAssignmentChartService = new OpenTasksCreatedByAssignmentChartService();
