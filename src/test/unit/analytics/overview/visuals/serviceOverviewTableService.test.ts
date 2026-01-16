import { serviceOverviewTableService } from '../../../../../main/modules/analytics/overview/visuals/serviceOverviewTableService';
import { taskFactsRepository } from '../../../../../main/modules/analytics/shared/repositories';

jest.mock('../../../../../main/modules/analytics/shared/repositories', () => ({
  taskFactsRepository: { fetchServiceOverviewRows: jest.fn() },
}));

describe('serviceOverviewTableService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('maps rows and calculates totals with percentages', async () => {
    (taskFactsRepository.fetchServiceOverviewRows as jest.Mock).mockResolvedValue([
      {
        service: 'Service A',
        open_tasks: 10,
        assigned_tasks: 4,
        urgent: 1,
        high: 2,
        medium: 3,
        low: 4,
      },
      {
        service: 'Service B',
        open_tasks: 0,
        assigned_tasks: 0,
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      {
        service: 'Service C',
        open_tasks: null,
        assigned_tasks: undefined,
        urgent: null,
        high: undefined,
        medium: null,
        low: undefined,
      },
    ]);

    const result = await serviceOverviewTableService.fetchServiceOverview({});

    expect(result.serviceRows).toEqual([
      {
        service: 'Service A',
        open: 10,
        assigned: 4,
        assignedPct: 40,
        urgent: 1,
        high: 2,
        medium: 3,
        low: 4,
      },
      {
        service: 'Service B',
        open: 0,
        assigned: 0,
        assignedPct: 0,
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      {
        service: 'Service C',
        open: 0,
        assigned: 0,
        assignedPct: 0,
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
    ]);
    expect(result.totals).toEqual({
      service: 'Total',
      open: 10,
      assigned: 4,
      assignedPct: 40,
      urgent: 1,
      high: 2,
      medium: 3,
      low: 4,
    });
  });
});
