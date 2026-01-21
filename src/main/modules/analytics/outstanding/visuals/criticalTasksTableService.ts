import { OutstandingSort } from '../../shared/outstandingSort';
import { normalisePage } from '../../shared/pagination';
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

class CriticalTasksTableService {
  async fetchCriticalTasksPage(
    filters: AnalyticsFilters,
    sort: OutstandingSort['criticalTasks'],
    page: number,
    pageSize = CRITICAL_TASKS_PAGE_SIZE
  ): Promise<CriticalTasksPage> {
    const [totalResults, caseWorkerNames] = await Promise.all([
      taskThinRepository.fetchOutstandingCriticalTaskCount(filters),
      caseWorkerProfileService.fetchCaseWorkerProfileNames(),
    ]);
    const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
    const currentPage = normalisePage(page, totalPages);
    if (totalResults === 0) {
      return { rows: [], totalResults, page: currentPage };
    }
    const rows = await taskThinRepository.fetchOutstandingCriticalTaskRows(filters, sort, {
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
        agentName: row.assignee ? (caseWorkerNames[row.assignee] ?? row.assignee) : '',
      })),
      totalResults,
      page: currentPage,
    };
  }
}

export const criticalTasksTableService = new CriticalTasksTableService();
