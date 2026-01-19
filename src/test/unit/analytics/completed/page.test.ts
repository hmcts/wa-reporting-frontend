import { buildCompletedPage } from '../../../../main/modules/analytics/completed/page';
import { completedService } from '../../../../main/modules/analytics/completed/service';
import { buildCompletedViewModel } from '../../../../main/modules/analytics/completed/viewModel';
import { completedByNameChartService } from '../../../../main/modules/analytics/completed/visuals/completedByNameChartService';
import { completedComplianceSummaryService } from '../../../../main/modules/analytics/completed/visuals/completedComplianceSummaryService';
import { completedProcessingHandlingTimeService } from '../../../../main/modules/analytics/completed/visuals/completedProcessingHandlingTimeService';
import { completedRegionLocationTableService } from '../../../../main/modules/analytics/completed/visuals/completedRegionLocationTableService';
import { completedTimelineChartService } from '../../../../main/modules/analytics/completed/visuals/completedTimelineChartService';
import { fetchFilterOptionsWithFallback } from '../../../../main/modules/analytics/shared/pageUtils';
import { taskThinRepository } from '../../../../main/modules/analytics/shared/repositories';
import {
  caseWorkerProfileService,
  courtVenueService,
  regionService,
} from '../../../../main/modules/analytics/shared/services';
import { AnalyticsFilters } from '../../../../main/modules/analytics/shared/types';

jest.mock('../../../../main/modules/analytics/completed/service', () => ({
  completedService: {
    buildCompleted: jest.fn(),
    buildCompletedByRegionLocation: jest.fn(),
  },
}));

jest.mock('../../../../main/modules/analytics/completed/viewModel', () => ({
  buildCompletedViewModel: jest.fn(),
}));

jest.mock('../../../../main/modules/analytics/completed/visuals/completedByNameChartService', () => ({
  completedByNameChartService: { fetchCompletedByName: jest.fn() },
}));

jest.mock('../../../../main/modules/analytics/completed/visuals/completedComplianceSummaryService', () => ({
  completedComplianceSummaryService: { fetchCompletedSummary: jest.fn() },
}));

jest.mock('../../../../main/modules/analytics/completed/visuals/completedProcessingHandlingTimeService', () => ({
  completedProcessingHandlingTimeService: { fetchCompletedProcessingHandlingTime: jest.fn() },
}));

jest.mock('../../../../main/modules/analytics/completed/visuals/completedRegionLocationTableService', () => ({
  completedRegionLocationTableService: { fetchCompletedByLocation: jest.fn(), fetchCompletedByRegion: jest.fn() },
}));

jest.mock('../../../../main/modules/analytics/completed/visuals/completedTimelineChartService', () => ({
  completedTimelineChartService: { fetchCompletedTimeline: jest.fn() },
}));

jest.mock('../../../../main/modules/analytics/shared/pageUtils', () => ({
  fetchFilterOptionsWithFallback: jest.fn(),
  normaliseDateRange: jest.requireActual('../../../../main/modules/analytics/shared/pageUtils').normaliseDateRange,
  settledArrayWithFallback: jest.requireActual('../../../../main/modules/analytics/shared/pageUtils')
    .settledArrayWithFallback,
  settledValueWithError: jest.requireActual('../../../../main/modules/analytics/shared/pageUtils')
    .settledValueWithError,
  settledValueWithFallback: jest.requireActual('../../../../main/modules/analytics/shared/pageUtils')
    .settledValueWithFallback,
}));

jest.mock('../../../../main/modules/analytics/shared/services', () => ({
  regionService: { fetchRegionDescriptions: jest.fn() },
  courtVenueService: { fetchCourtVenueDescriptions: jest.fn() },
  caseWorkerProfileService: { fetchCaseWorkerProfileNames: jest.fn() },
}));

jest.mock('../../../../main/modules/analytics/shared/repositories', () => ({
  taskThinRepository: { fetchCompletedTaskAuditRows: jest.fn() },
}));

describe('buildCompletedPage', () => {
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('builds the view model using database results when available', async () => {
    const filters: AnalyticsFilters = {
      completedFrom: new Date('2024-05-10'),
      completedTo: new Date('2024-05-01'),
    };

    const fallback = {
      summary: {
        completedToday: 0,
        completedInRange: 0,
        withinDueYes: 0,
        withinDueNo: 0,
        withinDueTodayYes: 0,
        withinDueTodayNo: 0,
      },
      timeline: [{ date: '2024-01-01', completed: 1, withinDue: 1, beyondDue: 0 }],
      completedByName: [{ taskName: 'Fallback', tasks: 1, withinDue: 1, beyondDue: 0 }],
      handlingTimeStats: { metric: 'handlingTime', averageDays: 0, lowerRange: 0, upperRange: 0 },
      processingHandlingTime: [],
    };
    const fallbackRegionLocation = {
      byLocation: [{ location: 'Fallback', region: 'North', tasks: 1, withinDue: 1, beyondDue: 0 }],
      byRegion: [{ region: 'North', tasks: 1, withinDue: 1, beyondDue: 0 }],
    };

    (completedService.buildCompleted as jest.Mock).mockReturnValue(fallback);
    (completedService.buildCompletedByRegionLocation as jest.Mock).mockReturnValue(fallbackRegionLocation);
    (fetchFilterOptionsWithFallback as jest.Mock).mockResolvedValue({
      services: [],
      roleCategories: [],
      regions: [],
      locations: [],
      taskNames: [],
      users: [],
    });
    (regionService.fetchRegionDescriptions as jest.Mock).mockResolvedValue({ North: 'North East' });
    (courtVenueService.fetchCourtVenueDescriptions as jest.Mock).mockResolvedValue({ Leeds: 'Leeds Crown Court' });
    (caseWorkerProfileService.fetchCaseWorkerProfileNames as jest.Mock).mockResolvedValue({});
    (completedComplianceSummaryService.fetchCompletedSummary as jest.Mock)
      .mockResolvedValueOnce({ total: 10, within: 7 })
      .mockResolvedValueOnce({ total: 2, within: 1 });
    (completedTimelineChartService.fetchCompletedTimeline as jest.Mock).mockResolvedValue([
      { date: '2024-05-01', completed: 2, withinDue: 1, beyondDue: 1 },
    ]);
    (completedProcessingHandlingTimeService.fetchCompletedProcessingHandlingTime as jest.Mock).mockResolvedValue([
      {
        date: '2024-05-01',
        tasks: 2,
        handlingAverageDays: 1,
        handlingStdDevDays: 0.5,
        handlingSumDays: 2,
        handlingCount: 2,
        processingAverageDays: 2,
        processingStdDevDays: 1,
        processingSumDays: 4,
        processingCount: 2,
      },
    ]);
    (completedByNameChartService.fetchCompletedByName as jest.Mock).mockResolvedValue([
      { taskName: 'Review', tasks: 2, withinDue: 1, beyondDue: 1 },
    ]);
    (completedRegionLocationTableService.fetchCompletedByLocation as jest.Mock).mockResolvedValue([
      { location: 'Leeds', region: 'North', tasks: 2, withinDue: 1, beyondDue: 1 },
    ]);
    (completedRegionLocationTableService.fetchCompletedByRegion as jest.Mock).mockResolvedValue([
      { region: 'North', tasks: 2, withinDue: 1, beyondDue: 1 },
    ]);
    (taskThinRepository.fetchCompletedTaskAuditRows as jest.Mock).mockResolvedValue([]);
    (buildCompletedViewModel as jest.Mock).mockReturnValue({ view: 'completed' });

    const viewModel = await buildCompletedPage(filters, 'handlingTime');

    expect(viewModel).toEqual({ view: 'completed' });
    expect(completedComplianceSummaryService.fetchCompletedSummary).toHaveBeenCalledWith(
      filters,
      expect.objectContaining({ from: new Date('2024-05-01'), to: new Date('2024-05-10') })
    );
    expect(buildCompletedViewModel).toHaveBeenCalledWith(
      expect.objectContaining({
        completed: expect.objectContaining({
          summary: expect.objectContaining({
            completedInRange: 10,
            withinDueYes: 7,
            withinDueNo: 3,
            completedToday: 2,
            withinDueTodayYes: 1,
            withinDueTodayNo: 1,
          }),
          timeline: [{ date: '2024-05-01', completed: 2, withinDue: 1, beyondDue: 1 }],
          completedByName: [{ taskName: 'Review', tasks: 2, withinDue: 1, beyondDue: 1 }],
          processingHandlingTime: [
            {
              date: '2024-05-01',
              tasks: 2,
              handlingAverageDays: 1,
              handlingStdDevDays: 0.5,
              handlingSumDays: 2,
              handlingCount: 2,
              processingAverageDays: 2,
              processingStdDevDays: 1,
              processingSumDays: 4,
              processingCount: 2,
            },
          ],
        }),
        completedByLocation: [{ location: 'Leeds', region: 'North', tasks: 2, withinDue: 1, beyondDue: 1 }],
        completedByRegion: [{ region: 'North', tasks: 2, withinDue: 1, beyondDue: 1 }],
        regionDescriptions: { North: 'North East' },
        locationDescriptions: { Leeds: 'Leeds Crown Court' },
        taskAuditRows: [],
        taskAuditCaseId: '',
        selectedMetric: 'handlingTime',
      })
    );
  });

  test('falls back to defaults when summaries or charts fail', async () => {
    const fallback = {
      summary: {
        completedToday: 0,
        completedInRange: 0,
        withinDueYes: 0,
        withinDueNo: 0,
        withinDueTodayYes: 0,
        withinDueTodayNo: 0,
      },
      timeline: [{ date: '2024-01-02', completed: 1, withinDue: 0, beyondDue: 1 }],
      completedByName: [{ taskName: 'Fallback', tasks: 1, withinDue: 0, beyondDue: 1 }],
      handlingTimeStats: { metric: 'handlingTime', averageDays: 0, lowerRange: 0, upperRange: 0 },
      processingHandlingTime: [],
    };
    const fallbackRegionLocation = {
      byLocation: [{ location: 'Fallback', region: 'Unknown', tasks: 1, withinDue: 0, beyondDue: 1 }],
      byRegion: [{ region: 'Unknown', tasks: 1, withinDue: 0, beyondDue: 1 }],
    };

    (completedService.buildCompleted as jest.Mock).mockReturnValue(fallback);
    (completedService.buildCompletedByRegionLocation as jest.Mock).mockReturnValue(fallbackRegionLocation);
    (fetchFilterOptionsWithFallback as jest.Mock).mockResolvedValue({
      services: [],
      roleCategories: [],
      regions: [],
      locations: [],
      taskNames: [],
      users: [],
    });
    (regionService.fetchRegionDescriptions as jest.Mock).mockResolvedValue({});
    (courtVenueService.fetchCourtVenueDescriptions as jest.Mock).mockResolvedValue({});
    (caseWorkerProfileService.fetchCaseWorkerProfileNames as jest.Mock).mockResolvedValue({});
    (completedComplianceSummaryService.fetchCompletedSummary as jest.Mock)
      .mockRejectedValueOnce(new Error('db'))
      .mockResolvedValueOnce(null);
    (completedTimelineChartService.fetchCompletedTimeline as jest.Mock).mockResolvedValue([]);
    (completedProcessingHandlingTimeService.fetchCompletedProcessingHandlingTime as jest.Mock).mockRejectedValue(
      new Error('db')
    );
    (completedByNameChartService.fetchCompletedByName as jest.Mock).mockRejectedValue(new Error('db'));
    (completedRegionLocationTableService.fetchCompletedByLocation as jest.Mock).mockResolvedValue([]);
    (completedRegionLocationTableService.fetchCompletedByRegion as jest.Mock).mockRejectedValue(new Error('db'));
    (taskThinRepository.fetchCompletedTaskAuditRows as jest.Mock).mockResolvedValue([]);
    (buildCompletedViewModel as jest.Mock).mockReturnValue({ view: 'completed-fallback' });

    await buildCompletedPage({}, 'handlingTime');

    expect(buildCompletedViewModel).toHaveBeenCalledWith(
      expect.objectContaining({
        completed: expect.objectContaining({
          summary: fallback.summary,
          timeline: fallback.timeline,
          completedByName: fallback.completedByName,
          processingHandlingTime: fallback.processingHandlingTime,
        }),
        completedByLocation: fallbackRegionLocation.byLocation,
        completedByRegion: fallbackRegionLocation.byRegion,
        regionDescriptions: {},
        locationDescriptions: {},
        taskAuditRows: [],
        taskAuditCaseId: '',
        selectedMetric: 'handlingTime',
      })
    );
  });

  test('maps task audit rows when a case ID is provided', async () => {
    const fallback = {
      summary: {
        completedToday: 0,
        completedInRange: 0,
        withinDueYes: 0,
        withinDueNo: 0,
        withinDueTodayYes: 0,
        withinDueTodayNo: 0,
      },
      timeline: [],
      completedByName: [],
      handlingTimeStats: { metric: 'handlingTime', averageDays: 0, lowerRange: 0, upperRange: 0 },
      processingHandlingTime: [],
    };
    const fallbackRegionLocation = { byLocation: [], byRegion: [] };

    (completedService.buildCompleted as jest.Mock).mockReturnValue(fallback);
    (completedService.buildCompletedByRegionLocation as jest.Mock).mockReturnValue(fallbackRegionLocation);
    (fetchFilterOptionsWithFallback as jest.Mock).mockResolvedValue({
      services: [],
      roleCategories: [],
      regions: [],
      locations: [],
      taskNames: [],
      users: [],
    });
    (regionService.fetchRegionDescriptions as jest.Mock).mockResolvedValue({ North: 'North East' });
    (courtVenueService.fetchCourtVenueDescriptions as jest.Mock).mockResolvedValue({ Leeds: 'Leeds Crown Court' });
    (caseWorkerProfileService.fetchCaseWorkerProfileNames as jest.Mock).mockResolvedValue({ 'user-1': 'Agent One' });
    (completedComplianceSummaryService.fetchCompletedSummary as jest.Mock)
      .mockResolvedValueOnce({ total: 0, within: 0 })
      .mockResolvedValueOnce({ total: 0, within: 0 });
    (completedTimelineChartService.fetchCompletedTimeline as jest.Mock).mockResolvedValue([]);
    (completedProcessingHandlingTimeService.fetchCompletedProcessingHandlingTime as jest.Mock).mockResolvedValue([]);
    (completedByNameChartService.fetchCompletedByName as jest.Mock).mockResolvedValue([]);
    (completedRegionLocationTableService.fetchCompletedByLocation as jest.Mock).mockResolvedValue([]);
    (completedRegionLocationTableService.fetchCompletedByRegion as jest.Mock).mockResolvedValue([]);
    (taskThinRepository.fetchCompletedTaskAuditRows as jest.Mock).mockResolvedValue([
      {
        case_id: 'CASE-123',
        task_name: null,
        assignee: 'user-1',
        completed_date: null,
        number_of_reassignments: 2,
        location: 'Leeds',
        termination_process_label: null,
      },
    ]);
    (buildCompletedViewModel as jest.Mock).mockReturnValue({ view: 'completed-audit' });

    await buildCompletedPage({}, 'handlingTime', 'CASE-123');

    expect(buildCompletedViewModel).toHaveBeenCalledWith(
      expect.objectContaining({
        taskAuditRows: [
          {
            caseId: 'CASE-123',
            taskName: '-',
            agentName: 'Agent One',
            completedDate: '-',
            totalAssignments: 3,
            location: 'Leeds Crown Court',
            status: '-',
          },
        ],
        taskAuditCaseId: 'CASE-123',
      })
    );
  });
});
