import { OutstandingSort } from '../../shared/outstandingSort';
import { taskThinRepository } from '../../shared/repositories';
import { caseWorkerProfileService } from '../../shared/services';
import { AnalyticsFilters, CriticalTask } from '../../shared/types';
import { normaliseLabel } from '../../shared/utils';

class CriticalTasksTableService {
  async fetchCriticalTasks(filters: AnalyticsFilters, sort: OutstandingSort['criticalTasks']): Promise<CriticalTask[]> {
    const rows = await taskThinRepository.fetchOutstandingCriticalTaskRows(filters, sort);
    const caseWorkerNames = await caseWorkerProfileService.fetchCaseWorkerProfileNames();
    return rows.map(row => ({
      caseId: row.case_id,
      caseType: normaliseLabel(row.case_type_label),
      location: normaliseLabel(row.location),
      taskName: normaliseLabel(row.task_name),
      createdDate: normaliseLabel(row.created_date),
      dueDate: row.due_date ?? undefined,
      priority: row.priority,
      agentName: row.assignee ? caseWorkerNames[row.assignee] ?? row.assignee : '',
    }));
  }
}

export const criticalTasksTableService = new CriticalTasksTableService();
