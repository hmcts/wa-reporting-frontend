import { __testing, buildCompletedViewModel } from '../../../../main/modules/analytics/completed/viewModel';
import { CompletedResponse, Task } from '../../../../main/modules/analytics/shared/types';

describe('buildCompletedViewModel', () => {
  test('builds rows and filter options', () => {
    const completed: CompletedResponse = {
      summary: {
        completedToday: 1,
        completedInRange: 3,
        withinDueYes: 2,
        withinDueNo: 1,
        withinDueTodayYes: 1,
        withinDueTodayNo: 0,
      },
      timeline: [{ date: '2024-01-02', completed: 3, withinDue: 2, beyondDue: 1 }],
      completedByName: [{ taskName: 'Review', tasks: 2, withinDue: 2, beyondDue: 0 }],
      handlingTimeStats: {
        metric: 'handlingTime',
        averageDays: 2,
        lowerRange: 1,
        upperRange: 3,
      },
      processingHandlingTime: [
        {
          date: '2024-01-02',
          tasks: 3,
          handlingAverageDays: 1.5,
          handlingStdDevDays: 0.5,
          handlingSumDays: 3,
          handlingCount: 2,
          processingAverageDays: 2.5,
          processingStdDevDays: 1.0,
          processingSumDays: 5,
          processingCount: 2,
        },
      ],
    };
    const allTasks = [
      {
        service: 'Service A',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Review',
        assigneeId: 'user-1',
        assigneeName: 'User One',
      },
    ] as Task[];
    const filterOptions = {
      services: [],
      roleCategories: [],
      regions: [],
      locations: [],
      taskNames: [],
      users: [],
    };

    const viewModel = buildCompletedViewModel({
      filters: {},
      completed,
      allTasks,
      filterOptions,
      completedByLocation: [],
      completedByRegion: [],
      regionDescriptions: {},
      locationDescriptions: {},
      taskAuditRows: [],
      taskAuditCaseId: '',
      selectedMetric: 'handlingTime',
    });

    expect(viewModel.serviceOptions[0].text).toBe('All services');
    expect(viewModel.timelineRows[0][0].text).toBe('2024-01-02');
    expect(viewModel.completedByNameRows[0][0].text).toBe('Review');
    expect(viewModel.processingHandlingRows[0][2].text).toBe('1.50');
    expect(viewModel.processingHandlingOverallAverage).toBe('1.50');
  });

  test('renders zero percentages and region/location metrics', () => {
    const completed: CompletedResponse = {
      summary: {
        completedToday: 0,
        completedInRange: 0,
        withinDueYes: 0,
        withinDueNo: 0,
        withinDueTodayYes: 0,
        withinDueTodayNo: 0,
      },
      timeline: [],
      completedByName: [{ taskName: 'Audit', tasks: 0, withinDue: 0, beyondDue: 0 }],
      handlingTimeStats: {
        metric: 'handlingTime',
        averageDays: 1.5,
        lowerRange: 1,
        upperRange: 2,
      },
      processingHandlingTime: [],
    };
    const completedByLocation = [
      {
        location: null,
        region: null,
        tasks: 2,
        withinDue: 1,
        beyondDue: 1,
        handlingTimeDays: undefined,
        processingTimeDays: 3.2,
      },
    ];
    const completedByRegion = [
      {
        region: null,
        tasks: 2,
        withinDue: 1,
        beyondDue: 1,
        handlingTimeDays: 2.5,
        processingTimeDays: undefined,
      },
    ];

    const viewModel = buildCompletedViewModel({
      filters: {},
      completed,
      allTasks: [],
      filterOptions: {
        services: [],
        roleCategories: [],
        regions: [],
        locations: [],
        taskNames: [],
        users: [],
      },
      completedByLocation,
      completedByRegion,
      regionDescriptions: {},
      locationDescriptions: {},
      taskAuditRows: [],
      taskAuditCaseId: '',
      selectedMetric: 'handlingTime',
    });

    expect(viewModel.completedByNameRows[0][3].text).toBe('0%');
    expect(viewModel.handlingRows[1].value.text).toBe('1.0');
    expect(viewModel.completedByRegionRows[0][0].text).toBe('Unknown');
    expect(viewModel.completedByRegionRows[0][4].text).toBe('2.5');
    expect(viewModel.completedByRegionRows[0][5].text).toBe('-');
    expect(viewModel.completedByRegionLocationRows[0][0].text).toBe('Unknown');
    expect(viewModel.completedByRegionLocationRows[0][1].text).toBe('Unknown');
    expect(viewModel.completedByRegionLocationRows[0][5].text).toBe('-');
    expect(viewModel.completedByRegionLocationRows[0][6].text).toBe('3.2');
  });

  test('maps region and location identifiers using description maps', () => {
    const completed: CompletedResponse = {
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
      handlingTimeStats: {
        metric: 'handlingTime',
        averageDays: 0,
        lowerRange: 0,
        upperRange: 0,
      },
      processingHandlingTime: [],
    };
    const completedByLocation = [
      {
        location: 'loc-1',
        region: 'reg-1',
        tasks: 1,
        withinDue: 1,
        beyondDue: 0,
        handlingTimeDays: undefined,
        processingTimeDays: undefined,
      },
    ];
    const completedByRegion = [
      {
        region: 'reg-1',
        tasks: 1,
        withinDue: 1,
        beyondDue: 0,
        handlingTimeDays: undefined,
        processingTimeDays: undefined,
      },
    ];

    const viewModel = buildCompletedViewModel({
      filters: {},
      completed,
      allTasks: [],
      filterOptions: {
        services: [],
        roleCategories: [],
        regions: [{ value: 'reg-1', text: 'North East' }],
        locations: [{ value: 'loc-1', text: 'Leeds Crown Court' }],
        taskNames: [],
        users: [],
      },
      completedByLocation,
      completedByRegion,
      regionDescriptions: { 'reg-1': 'North East' },
      locationDescriptions: { 'loc-1': 'Leeds Crown Court' },
      taskAuditRows: [],
      taskAuditCaseId: '',
      selectedMetric: 'handlingTime',
    });

    expect(viewModel.completedByRegionRows[0][0].text).toBe('North East');
    expect(viewModel.completedByLocationRows[0][0].text).toBe('Leeds Crown Court');
    expect(viewModel.completedByRegionLocationRows[0][0].text).toBe('North East');
    expect(viewModel.completedByRegionLocationRows[0][1].text).toBe('Leeds Crown Court');
  });

  test('uses rolling average fallbacks when helper returns empty', () => {
    jest.resetModules();
    jest.isolateModules(() => {
      jest.doMock('../../../../main/modules/analytics/shared/utils', () => ({
        ...jest.requireActual('../../../../main/modules/analytics/shared/utils'),
        buildRollingAverage: jest.fn(() => []),
      }));

      const {
        buildCompletedViewModel: buildCompletedViewModelWithMock,
      } = require('../../../../main/modules/analytics/completed/viewModel');
      const completed: CompletedResponse = {
        summary: {
          completedToday: 0,
          completedInRange: 1,
          withinDueYes: 0,
          withinDueNo: 1,
          withinDueTodayYes: 0,
          withinDueTodayNo: 0,
        },
        timeline: [{ date: '2024-03-01', completed: 1, withinDue: 0, beyondDue: 1 }],
        completedByName: [],
        handlingTimeStats: {
          metric: 'handlingTime',
          averageDays: 0,
          lowerRange: 0,
          upperRange: 0,
        },
        processingHandlingTime: [],
      };

      const viewModel = buildCompletedViewModelWithMock({
        filters: {},
        completed,
        allTasks: [],
        filterOptions: { services: [], roleCategories: [], regions: [], locations: [], taskNames: [], users: [] },
        completedByLocation: [],
        completedByRegion: [],
        regionDescriptions: {},
        locationDescriptions: {},
        taskAuditRows: [],
        taskAuditCaseId: '',
        selectedMetric: 'handlingTime',
      });

      expect(viewModel.timelineRows[0][5].text).toBe('0');
      expect(viewModel.timelineTotalsRow[5].text).toBe('0');
    });
  });

  test('exposes task audit data for templates', () => {
    const completed: CompletedResponse = {
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
      handlingTimeStats: {
        metric: 'handlingTime',
        averageDays: 0,
        lowerRange: 0,
        upperRange: 0,
      },
      processingHandlingTime: [],
    };

    const viewModel = buildCompletedViewModel({
      filters: {},
      completed,
      allTasks: [],
      filterOptions: {
        services: [],
        roleCategories: [],
        regions: [],
        locations: [],
        taskNames: [],
        users: [],
      },
      completedByLocation: [],
      completedByRegion: [],
      regionDescriptions: {},
      locationDescriptions: {},
      taskAuditRows: [
        {
          caseId: '123',
          taskName: 'Check',
          agentName: 'Agent One',
          completedDate: '2024-01-01',
          totalAssignments: 2,
          location: 'Leeds',
          status: 'COMPLETED',
        },
      ],
      taskAuditCaseId: '123',
      selectedMetric: 'handlingTime',
    });

    expect(viewModel.taskAuditCaseId).toBe('123');
    expect(viewModel.taskAuditRows[0].caseId).toBe('123');
    expect(viewModel.taskAuditEmptyState).toBe('No completed tasks match this case ID.');
  });

  test('uses a prompt when case ID is not provided', () => {
    const completed: CompletedResponse = {
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
      handlingTimeStats: {
        metric: 'handlingTime',
        averageDays: 0,
        lowerRange: 0,
        upperRange: 0,
      },
      processingHandlingTime: [],
    };

    const viewModel = buildCompletedViewModel({
      filters: {},
      completed,
      allTasks: [],
      filterOptions: {
        services: [],
        roleCategories: [],
        regions: [],
        locations: [],
        taskNames: [],
        users: [],
      },
      completedByLocation: [],
      completedByRegion: [],
      regionDescriptions: {},
      locationDescriptions: {},
      taskAuditRows: [],
      taskAuditCaseId: '',
      selectedMetric: 'handlingTime',
    });

    expect(viewModel.taskAuditEmptyState).toBe('Enter a case ID to see task audit results.');
  });

  test('formats handling and processing time columns for region/location rows', () => {
    const regionLookup = { South: 'South Region' };
    const locationLookup = { Leeds: 'Leeds Crown Court' };
    const regionRows = __testing.buildCompletedRegionRows(
      [
        { region: null, tasks: 1, withinDue: 1, beyondDue: 0, handlingTimeDays: 2.5, processingTimeDays: undefined },
        { region: 'South', tasks: 1, withinDue: 0, beyondDue: 1, handlingTimeDays: undefined, processingTimeDays: 1.2 },
      ],
      regionLookup
    );
    const locationRows = __testing.buildCompletedLocationRows(
      [
        {
          region: null,
          location: null,
          tasks: 1,
          withinDue: 1,
          beyondDue: 0,
          handlingTimeDays: 3.1,
          processingTimeDays: undefined,
        },
        {
          region: 'South',
          location: 'Leeds',
          tasks: 1,
          withinDue: 0,
          beyondDue: 1,
          handlingTimeDays: undefined,
          processingTimeDays: 2.4,
        },
      ],
      true,
      locationLookup,
      regionLookup
    );

    const unknownRegionRow = regionRows.find(row => row[0].text === 'Unknown');
    const southRegionRow = regionRows.find(row => row[0].text === 'South Region');
    const unknownLocationRow = locationRows.find(row => row[0].text === 'Unknown');
    const southLocationRow = locationRows.find(row => row[0].text === 'South Region');

    expect(unknownRegionRow?.[4].text).toBe('2.5');
    expect(unknownRegionRow?.[5].text).toBe('-');
    expect(southRegionRow?.[4].text).toBe('-');
    expect(southRegionRow?.[5].text).toBe('1.2');
    expect(unknownLocationRow?.[2].text).toBe('1');
    expect(unknownLocationRow?.[5].text).toBe('3.1');
    expect(unknownLocationRow?.[6].text).toBe('-');
    expect(southLocationRow?.[5].text).toBe('-');
    expect(southLocationRow?.[6].text).toBe('2.4');
    expect(southRegionRow?.[0].text).toBe('South Region');
    expect(southLocationRow?.[0].text).toBe('South Region');
    expect(southLocationRow?.[1].text).toBe('Leeds Crown Court');
  });

  test('sorts completed location rows by region then location when requested', () => {
    const rows = __testing.buildCompletedLocationRows(
      [
        {
          region: 'North',
          location: 'York',
          tasks: 1,
          withinDue: 1,
          beyondDue: 0,
          handlingTimeDays: undefined,
          processingTimeDays: undefined,
        },
        {
          region: 'North',
          location: 'Leeds',
          tasks: 1,
          withinDue: 1,
          beyondDue: 0,
          handlingTimeDays: undefined,
          processingTimeDays: undefined,
        },
      ],
      true,
      { York: 'York Court', Leeds: 'Leeds Crown Court' },
      { North: 'North Region' }
    );

    expect(rows[0][0].text).toBe('North Region');
    expect(rows[0][1].text).toBe('Leeds Crown Court');
    expect(rows[1][1].text).toBe('York Court');
  });
});
