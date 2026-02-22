import { OutstandingSort } from '../../shared/outstandingSort';
import { getCappedTotalPages, normalisePage } from '../../shared/pagination';
import { taskThinRepository } from '../../shared/repositories';
import { caseWorkerProfileService } from '../../shared/services';
import { AnalyticsFilters, CriticalTask } from '../../shared/types';
import { normaliseLabel } from '../../shared/utils';
import { CRITICAL_TASKS_PAGE_SIZE } from '../criticalTasksPagination';

type CriticalTasksPage = {
  rows: CriticalTask[];
  totalResults: number;
  page: number;
};

const UNMAPPED_ASSIGNEE_LABEL = 'Judge';

function resolveAgentName(assignee: string | null, caseWorkerNames: Record<string, string>): string {
  if (!assignee) {
    return '';
  }

  const mappedName = caseWorkerNames[assignee];
  if (!mappedName || mappedName.trim().length === 0) {
    return UNMAPPED_ASSIGNEE_LABEL;
  }

  return mappedName;
}

class CriticalTasksTableService {
  async fetchCriticalTasksPage(
    snapshotId: number,
    filters: AnalyticsFilters,
    sort: OutstandingSort['criticalTasks'],
    page: number,
    pageSize = CRITICAL_TASKS_PAGE_SIZE
  ): Promise<CriticalTasksPage> {
    const [totalResults, caseWorkerNames] = await Promise.all([
      taskThinRepository.fetchOutstandingCriticalTaskCount(snapshotId, filters),
      caseWorkerProfileService.fetchCaseWorkerProfileNames(),
    ]);
    const totalPages = getCappedTotalPages(totalResults, pageSize);
    const currentPage = normalisePage(page, totalPages);
    if (totalResults === 0) {
      return { rows: [], totalResults, page: currentPage };
    }
    const rows = await taskThinRepository.fetchOutstandingCriticalTaskRows(snapshotId, filters, sort, {
      page: currentPage,
      pageSize,
    });
    return {
      rows: rows.map(row => ({
        caseId: row.case_id,
        caseType: normaliseLabel(row.case_type_label),
        location: normaliseLabel(row.location),
        taskName: normaliseLabel(row.task_name),
        createdDate: normaliseLabel(row.created_date),
        dueDate: row.due_date ?? undefined,
        priority: row.priority,
        agentName: resolveAgentName(row.assignee, caseWorkerNames),
      })),
      totalResults,
      page: currentPage,
    };
  }
}

export const criticalTasksTableService = new CriticalTasksTableService();
