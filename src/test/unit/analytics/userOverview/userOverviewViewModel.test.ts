import { Task, TaskPriority, TaskStatus, UserTaskRow } from '../../../../main/modules/analytics/shared/types';
import { getDefaultUserOverviewSort } from '../../../../main/modules/analytics/shared/userOverviewSort';
import { UserOverviewMetrics } from '../../../../main/modules/analytics/userOverview/service';
import { buildUserOverviewViewModel } from '../../../../main/modules/analytics/userOverview/viewModel';

const buildTasks = (rows: UserTaskRow[], status: TaskStatus): Task[] =>
  rows.map(row => ({
    caseId: row.caseId,
    taskId: row.caseId,
    service: 'Service',
    roleCategory: 'Role',
    region: 'Region',
    location: row.location,
    taskName: row.taskName,
    priority: row.priority as TaskPriority,
    status,
    createdDate: row.createdDate,
    assignedDate: row.assignedDate,
    dueDate: row.dueDate,
    completedDate: row.completedDate,
    handlingTimeDays: row.handlingTimeDays,
    totalAssignments: row.totalAssignments,
    assigneeName: row.assigneeName,
    withinSla: row.withinDue,
  }));

describe('buildUserOverviewViewModel', () => {
  test('builds priority and row data', () => {
    const overview: UserOverviewMetrics = {
      assigned: [
        {
          caseId: '123',
          taskName: 'Task A',
          createdDate: '2024-01-01',
          assignedDate: '2024-01-02',
          dueDate: '2024-01-03',
          completedDate: undefined,
          priority: 'urgent',
          totalAssignments: 1,
          assigneeName: 'User One',
          location: 'Leeds',
          status: 'open',
        },
      ],
      completed: [
        {
          caseId: '456',
          taskName: 'Task B',
          createdDate: '2024-01-01',
          assignedDate: '2024-01-02',
          dueDate: '2024-01-03',
          completedDate: '2024-01-04',
          handlingTimeDays: 2.5,
          priority: 'high',
          totalAssignments: 2,
          assigneeName: 'User Two',
          location: 'London',
          status: 'completed',
        },
      ],
      prioritySummary: { urgent: 1, high: 2, medium: 0, low: 0 },
      completedSummary: { total: 1, withinDueYes: 1, withinDueNo: 0 },
      completedByDate: [],
    };
    const completedByDate = [
      { date: '2024-01-04', tasks: 1, withinDue: 0, beyondDue: 1, handlingTimeSum: 2.5, handlingTimeCount: 1 },
    ];
    const completedByTaskName = [
      {
        taskName: 'Task B',
        tasks: 1,
        handlingTimeSum: 2.5,
        handlingTimeCount: 1,
        daysBeyondSum: 1,
        daysBeyondCount: 1,
      },
    ];
    const allTasks = [
      {
        service: 'Service A',
        roleCategory: 'Ops',
        region: 'North',
        location: 'Leeds',
        taskName: 'Task A',
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

    const viewModel = buildUserOverviewViewModel({
      filters: {},
      overview,
      allTasks,
      assignedTasks: buildTasks(overview.assigned, 'assigned'),
      completedTasks: buildTasks(overview.completed, 'completed'),
      completedComplianceSummary: {
        total: overview.completedSummary.total,
        withinDueYes: overview.completedSummary.withinDueYes,
        withinDueNo: overview.completedSummary.withinDueNo,
      },
      completedByDate,
      completedByTaskName,
      filterOptions,
      locationDescriptions: {},
      sort: getDefaultUserOverviewSort(),
      assignedPage: 1,
      completedPage: 1,
    });

    expect(viewModel.assignedSummaryRows[0].key.text).toBe('Total assigned');
    expect(viewModel.assignedSummaryRows[1].key.text).toBe('Urgent');
    expect(viewModel.assignedRows[0].caseId).toBe('123');
    expect(viewModel.assignedRows[0].assigneeName).toBe('User One');
    expect(viewModel.completedSummaryRows[0].key.text).toBe('Completed');
    expect(viewModel.completedByDateRows[0][0].text).toBe('2024-01-04');
    expect(viewModel.completedByDateRows[0][1].text).toBe('1');
    expect(viewModel.completedByDateRows[0][1].attributes?.['data-sort-value']).toBe('1');
    expect(viewModel.completedByDateRows[0][5].text).toBe('2.50');
    expect(viewModel.completedByDateTotalsRow[0].attributes?.['data-total-row']).toBe('true');
    expect(viewModel.completedByTaskNameRows[0][0].text).toBe('Task B');
    expect(viewModel.completedByTaskNameRows[0][1].text).toBe('1');
    expect(viewModel.completedByTaskNameRows[0][2].text).toBe('2.50');
    expect(viewModel.completedByTaskNameRows[0][3].text).toBe('1.00');
    expect(viewModel.completedByTaskNameTotalsRow[0].text).toBe('Total');
    expect(viewModel.completedByTaskNameTotalsRow[0].attributes?.['data-total-row']).toBe('true');
    expect(viewModel.assignedHead[1].attributes?.['data-sort-dir']).toBe('desc');
    expect(viewModel.assignedHead[0].attributes?.['data-sort-key']).toBe('caseId');
    expect(viewModel.assignedHead[0].text).toBe('Case ID');
    expect(viewModel.assignedPagination.page).toBe(1);
    expect(viewModel.completedPagination.page).toBe(1);
  });

  test('hydrates date picker values and default user options', () => {
    const overview: UserOverviewMetrics = {
      assigned: [],
      completed: [],
      prioritySummary: { urgent: 0, high: 0, medium: 0, low: 0 },
      completedSummary: { total: 0, withinDueYes: 0, withinDueNo: 0 },
      completedByDate: [],
    };

    const viewModel = buildUserOverviewViewModel({
      filters: {
        completedFrom: new Date('2024-02-01'),
        completedTo: new Date('2024-02-15'),
      },
      overview,
      allTasks: [],
      assignedTasks: buildTasks(overview.assigned, 'assigned'),
      completedTasks: buildTasks(overview.completed, 'completed'),
      completedComplianceSummary: {
        total: overview.completedSummary.total,
        withinDueYes: overview.completedSummary.withinDueYes,
        withinDueNo: overview.completedSummary.withinDueNo,
      },
      completedByDate: [],
      completedByTaskName: [],
      filterOptions: {
        services: [],
        roleCategories: [],
        regions: [],
        locations: [],
        taskNames: [],
        users: [],
      },
      locationDescriptions: {},
      sort: getDefaultUserOverviewSort(),
      assignedPage: 1,
      completedPage: 1,
    });

    expect(viewModel.completedFromValue).toBe('01/02/2024');
    expect(viewModel.completedToValue).toBe('15/02/2024');
    expect(viewModel.userOptions[0].text).toBe('All users');
  });

  test('uses provided user options and renders fallback dates', () => {
    const overview: UserOverviewMetrics = {
      assigned: [
        {
          caseId: '123',
          taskName: 'Task A',
          createdDate: '2024-01-01',
          assignedDate: '2024-01-02',
          dueDate: undefined,
          completedDate: undefined,
          priority: 'urgent',
          totalAssignments: 1,
          assigneeName: undefined,
          location: 'Leeds',
          status: 'open',
        },
      ],
      completed: [
        {
          caseId: '456',
          taskName: 'Task B',
          createdDate: '2024-01-01',
          assignedDate: '2024-01-02',
          dueDate: '2024-01-03',
          completedDate: undefined,
          priority: 'high',
          totalAssignments: 2,
          location: 'London',
          status: 'completed',
        },
      ],
      prioritySummary: { urgent: 0, high: 1, medium: 0, low: 0 },
      completedSummary: { total: 1, withinDueYes: 0, withinDueNo: 1 },
      completedByDate: [],
    };
    const completedByDate = [
      { date: '2024-01-04', tasks: 2, withinDue: 0, beyondDue: 2, handlingTimeSum: 0, handlingTimeCount: 0 },
    ];

    const viewModel = buildUserOverviewViewModel({
      filters: {},
      overview,
      allTasks: [],
      assignedTasks: buildTasks(overview.assigned, 'assigned'),
      completedTasks: buildTasks(overview.completed, 'completed'),
      completedComplianceSummary: {
        total: overview.completedSummary.total,
        withinDueYes: overview.completedSummary.withinDueYes,
        withinDueNo: overview.completedSummary.withinDueNo,
      },
      completedByDate,
      completedByTaskName: [],
      filterOptions: {
        services: [],
        roleCategories: [],
        regions: [],
        locations: [],
        taskNames: [],
        users: [{ value: 'user-1', text: 'User One' }],
      },
      locationDescriptions: {},
      sort: getDefaultUserOverviewSort(),
      assignedPage: 1,
      completedPage: 1,
    });

    expect(viewModel.userOptions[0].value).toBe('user-1');
    expect(viewModel.assignedRows[0].dueDate).toBe('-');
    expect(viewModel.completedRows[0].completedDate).toBe('-');
  });

  test('renders placeholders when no days beyond values are provided', () => {
    const overview: UserOverviewMetrics = {
      assigned: [],
      completed: [
        {
          caseId: '789',
          taskName: 'Task C',
          createdDate: '2024-01-01',
          assignedDate: '2024-01-02',
          dueDate: 'invalid-date',
          completedDate: 'invalid-date',
          priority: 'low',
          totalAssignments: 1,
          assigneeName: 'User Three',
          location: 'Leeds',
          status: 'completed',
        },
      ],
      prioritySummary: { urgent: 0, high: 0, medium: 0, low: 1 },
      completedSummary: { total: 1, withinDueYes: 0, withinDueNo: 1 },
      completedByDate: [],
    };
    const completedByTaskName = [
      {
        taskName: 'Task C',
        tasks: 1,
        handlingTimeSum: 0,
        handlingTimeCount: 0,
        daysBeyondSum: 0,
        daysBeyondCount: 0,
      },
    ];

    const viewModel = buildUserOverviewViewModel({
      filters: {},
      overview,
      allTasks: [],
      assignedTasks: buildTasks(overview.assigned, 'assigned'),
      completedTasks: buildTasks(overview.completed, 'completed'),
      completedComplianceSummary: {
        total: overview.completedSummary.total,
        withinDueYes: overview.completedSummary.withinDueYes,
        withinDueNo: overview.completedSummary.withinDueNo,
      },
      completedByDate: [],
      completedByTaskName,
      filterOptions: {
        services: [],
        roleCategories: [],
        regions: [],
        locations: [],
        taskNames: [],
        users: [],
      },
      locationDescriptions: {},
      sort: getDefaultUserOverviewSort(),
      assignedPage: 1,
      completedPage: 1,
    });

    expect(viewModel.completedByTaskNameRows[0][3].text).toBe('-');
  });

  test('renders fallback dates and sorts completed task names', () => {
    const overview: UserOverviewMetrics = {
      assigned: [
        {
          caseId: '111',
          taskName: 'Task Z',
          createdDate: '2024-01-01',
          assignedDate: undefined,
          dueDate: undefined,
          completedDate: undefined,
          priority: 'low',
          totalAssignments: 1,
          assigneeName: undefined,
          location: 'Leeds',
          status: 'open',
        },
      ],
      completed: [
        {
          caseId: '222',
          taskName: 'Task B',
          createdDate: '2024-01-02',
          assignedDate: undefined,
          dueDate: undefined,
          completedDate: '2024-01-03',
          priority: 'high',
          totalAssignments: 1,
          assigneeName: 'User',
          location: 'Leeds',
          status: 'completed',
          withinDue: false,
        },
        {
          caseId: '333',
          taskName: 'Task A',
          createdDate: '2024-01-02',
          assignedDate: undefined,
          dueDate: undefined,
          completedDate: '2024-01-03',
          priority: 'high',
          totalAssignments: 1,
          assigneeName: 'User',
          location: 'Leeds',
          status: 'completed',
          withinDue: true,
        },
      ],
      prioritySummary: { urgent: 0, high: 2, medium: 0, low: 1 },
      completedSummary: { total: 2, withinDueYes: 1, withinDueNo: 1 },
      completedByDate: [],
    };
    const completedByDate = [
      { date: '2024-01-03', tasks: 0, withinDue: 0, beyondDue: 0, handlingTimeSum: 0, handlingTimeCount: 0 },
    ];
    const completedByTaskName = [
      {
        taskName: 'Task B',
        tasks: 2,
        handlingTimeSum: 0,
        handlingTimeCount: 0,
        daysBeyondSum: 0,
        daysBeyondCount: 0,
      },
      {
        taskName: 'Task A',
        tasks: 2,
        handlingTimeSum: 0,
        handlingTimeCount: 0,
        daysBeyondSum: 0,
        daysBeyondCount: 0,
      },
    ];

    const viewModel = buildUserOverviewViewModel({
      filters: {},
      overview,
      allTasks: [],
      assignedTasks: buildTasks(overview.assigned, 'assigned'),
      completedTasks: buildTasks(overview.completed, 'completed'),
      completedComplianceSummary: {
        total: overview.completedSummary.total,
        withinDueYes: overview.completedSummary.withinDueYes,
        withinDueNo: overview.completedSummary.withinDueNo,
      },
      completedByDate,
      completedByTaskName,
      filterOptions: {
        services: [],
        roleCategories: [],
        regions: [],
        locations: [],
        taskNames: [],
        users: [],
      },
      locationDescriptions: {},
      sort: getDefaultUserOverviewSort(),
      assignedPage: 1,
      completedPage: 1,
    });

    expect(viewModel.assignedRows[0].assignedDate).toBe('-');
    expect(viewModel.assignedRows[0].dueDate).toBe('-');
    expect(viewModel.completedRows[0].assignedDate).toBe('-');
    expect(viewModel.completedRows[0].dueDate).toBe('-');
    expect(viewModel.completedRows[0].withinDue).toBe('No');
    expect(viewModel.completedByTaskNameRows[0][0].text).toBe('Task A');
    expect(viewModel.completedByDateRows[0][3].text).toBe('0%');
  });
});
