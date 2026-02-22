import { criticalTasksTableService } from '../../../../../main/modules/analytics/outstanding/visuals/criticalTasksTableService';
import { taskThinRepository } from '../../../../../main/modules/analytics/shared/repositories';
import { caseWorkerProfileService } from '../../../../../main/modules/analytics/shared/services';

jest.mock('../../../../../main/modules/analytics/shared/repositories', () => ({
  taskThinRepository: {
    fetchOutstandingCriticalTaskRows: jest.fn(),
    fetchOutstandingCriticalTaskCount: jest.fn(),
  },
}));

jest.mock('../../../../../main/modules/analytics/shared/services', () => ({
  caseWorkerProfileService: { fetchCaseWorkerProfileNames: jest.fn() },
}));

describe('criticalTasksTableService', () => {
  const snapshotId = 304;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('maps rows into critical task view models', async () => {
    (taskThinRepository.fetchOutstandingCriticalTaskCount as jest.Mock).mockResolvedValue(3);
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
        priority: 'High',
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
        priority: 'High',
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
        priority: 'High',
        assignee: 'user-2',
      },
    ]);
    (caseWorkerProfileService.fetchCaseWorkerProfileNames as jest.Mock).mockResolvedValue({
      'user-1': 'Sam Taylor',
    });

    const result = await criticalTasksTableService.fetchCriticalTasksPage(
      snapshotId,
      {},
      { by: 'dueDate', dir: 'asc' },
      1,
      10
    );

    expect(result).toEqual({
      rows: [
        {
          caseId: '123',
          caseType: 'Benefit',
          location: 'Leeds',
          taskName: 'Review',
          createdDate: '2024-01-01',
          dueDate: undefined,
          priority: 'High',
          agentName: '',
        },
        {
          caseId: '124',
          caseType: 'Benefit',
          location: 'Leeds',
          taskName: 'Validate',
          createdDate: '2024-01-02',
          dueDate: undefined,
          priority: 'High',
          agentName: 'Sam Taylor',
        },
        {
          caseId: '125',
          caseType: 'Benefit',
          location: 'Leeds',
          taskName: 'Check',
          createdDate: '2024-01-03',
          dueDate: undefined,
          priority: 'High',
          agentName: 'Judge',
        },
      ],
      totalResults: 3,
      page: 1,
    });
    expect(taskThinRepository.fetchOutstandingCriticalTaskRows).toHaveBeenCalledWith(
      snapshotId,
      {},
      { by: 'dueDate', dir: 'asc' },
      {
        page: 1,
        pageSize: 10,
      }
    );
  });

  test('uses Judge when mapped profile name is blank', async () => {
    (taskThinRepository.fetchOutstandingCriticalTaskCount as jest.Mock).mockResolvedValue(1);
    (taskThinRepository.fetchOutstandingCriticalTaskRows as jest.Mock).mockResolvedValue([
      {
        case_id: '126',
        task_id: 't4',
        task_name: 'Escalate',
        case_type_label: 'Benefit',
        region: 'North',
        location: 'Leeds',
        created_date: '2024-01-04',
        due_date: null,
        priority: 'Urgent',
        assignee: 'user-3',
      },
    ]);
    (caseWorkerProfileService.fetchCaseWorkerProfileNames as jest.Mock).mockResolvedValue({
      'user-3': '   ',
    });

    const result = await criticalTasksTableService.fetchCriticalTasksPage(
      snapshotId,
      {},
      { by: 'dueDate', dir: 'asc' },
      1,
      10
    );

    expect(result.rows[0]?.agentName).toBe('Judge');
  });

  test('clamps oversized critical task page requests to the 500-result window', async () => {
    (taskThinRepository.fetchOutstandingCriticalTaskCount as jest.Mock).mockResolvedValue(15000);
    (taskThinRepository.fetchOutstandingCriticalTaskRows as jest.Mock).mockResolvedValue([]);
    (caseWorkerProfileService.fetchCaseWorkerProfileNames as jest.Mock).mockResolvedValue({});

    const result = await criticalTasksTableService.fetchCriticalTasksPage(
      snapshotId,
      {},
      { by: 'dueDate', dir: 'asc' },
      999
    );

    expect(taskThinRepository.fetchOutstandingCriticalTaskRows).toHaveBeenCalledWith(
      snapshotId,
      {},
      { by: 'dueDate', dir: 'asc' },
      {
        page: 10,
        pageSize: 50,
      }
    );
    expect(result.page).toBe(10);
  });

  test('returns early with empty rows when no critical tasks exist', async () => {
    (taskThinRepository.fetchOutstandingCriticalTaskCount as jest.Mock).mockResolvedValue(0);
    (caseWorkerProfileService.fetchCaseWorkerProfileNames as jest.Mock).mockResolvedValue({});

    const result = await criticalTasksTableService.fetchCriticalTasksPage(
      snapshotId,
      {},
      { by: 'dueDate', dir: 'asc' },
      99
    );

    expect(taskThinRepository.fetchOutstandingCriticalTaskRows).not.toHaveBeenCalled();
    expect(result).toEqual({
      rows: [],
      totalResults: 0,
      page: 1,
    });
  });
});
