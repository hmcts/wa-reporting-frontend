import { criticalTasksTableService } from '../../../../../main/modules/analytics/outstanding/visuals/criticalTasksTableService';
import { taskThinRepository } from '../../../../../main/modules/analytics/shared/repositories';
import { caseWorkerProfileService } from '../../../../../main/modules/analytics/shared/services';

jest.mock('../../../../../main/modules/analytics/shared/repositories', () => ({
  taskThinRepository: { fetchOutstandingCriticalTaskRows: jest.fn() },
}));

jest.mock('../../../../../main/modules/analytics/shared/services', () => ({
  caseWorkerProfileService: { fetchCaseWorkerProfileNames: jest.fn() },
}));

describe('criticalTasksTableService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('maps rows into critical task view models', async () => {
    (taskThinRepository.fetchOutstandingCriticalTaskRows as jest.Mock).mockResolvedValue([
      {
        case_id: '123',
        task_id: 't1',
        task_name: 'Review',
        case_type_label: 'Benefit',
        region: 'North',
        location: 'Leeds',
        created_date: '2024-01-01',
        due_date: null,
        priority: 'high',
        assignee: null,
      },
      {
        case_id: '124',
        task_id: 't2',
        task_name: 'Validate',
        case_type_label: 'Benefit',
        region: 'North',
        location: 'Leeds',
        created_date: '2024-01-02',
        due_date: null,
        priority: 'high',
        assignee: 'user-1',
      },
      {
        case_id: '125',
        task_id: 't3',
        task_name: 'Check',
        case_type_label: 'Benefit',
        region: 'North',
        location: 'Leeds',
        created_date: '2024-01-03',
        due_date: null,
        priority: 'high',
        assignee: 'user-2',
      },
    ]);
    (caseWorkerProfileService.fetchCaseWorkerProfileNames as jest.Mock).mockResolvedValue({
      'user-1': 'Sam Taylor',
    });

    const result = await criticalTasksTableService.fetchCriticalTasks({}, { by: 'dueDate', dir: 'asc' });

    expect(result).toEqual([
      {
        caseId: '123',
        caseType: 'Benefit',
        location: 'Leeds',
        taskName: 'Review',
        createdDate: '2024-01-01',
        dueDate: undefined,
        priority: 'high',
        agentName: '',
      },
      {
        caseId: '124',
        caseType: 'Benefit',
        location: 'Leeds',
        taskName: 'Validate',
        createdDate: '2024-01-02',
        dueDate: undefined,
        priority: 'high',
        agentName: 'Sam Taylor',
      },
      {
        caseId: '125',
        caseType: 'Benefit',
        location: 'Leeds',
        taskName: 'Check',
        createdDate: '2024-01-03',
        dueDate: undefined,
        priority: 'high',
        agentName: 'user-2',
      },
    ]);
  });
});
