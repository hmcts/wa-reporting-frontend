import { tmPrisma } from '../../../../../main/modules/analytics/shared/data/prisma';
import { taskFactsRepository } from '../../../../../main/modules/analytics/shared/repositories/taskFactsRepository';

jest.mock('../../../../../main/modules/analytics/shared/data/prisma', () => ({
  tmPrisma: { $queryRaw: jest.fn() },
}));

describe('taskFactsRepository', () => {
  const snapshotId = 501;

  const queryCall = (indexFromEnd = 0): { sql: string; values: unknown[] } => {
    const calls = (tmPrisma.$queryRaw as jest.Mock).mock.calls;
    return calls[calls.length - 1 - indexFromEnd][0];
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (tmPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);
  });

  test('executes repository queries with date ranges', async () => {
    const range = { from: new Date('2024-01-01'), to: new Date('2024-01-31') };

    await taskFactsRepository.fetchServiceOverviewRows(snapshotId, {});
    await taskFactsRepository.fetchTaskEventsByServiceRows(snapshotId, {}, range);
    await taskFactsRepository.fetchOverviewFilterOptionsRows(snapshotId);
    await taskFactsRepository.fetchOpenTasksCreatedByAssignmentRows(snapshotId, {});
    await taskFactsRepository.fetchTasksDuePriorityRows(snapshotId, {});
    await taskFactsRepository.fetchCompletedSummaryRows(snapshotId, {}, range);
    await taskFactsRepository.fetchCompletedTimelineRows(snapshotId, {}, range);
    await taskFactsRepository.fetchCompletedProcessingHandlingTimeRows(snapshotId, {}, range);
    await taskFactsRepository.fetchCompletedByNameRows(snapshotId, {}, range);
    await taskFactsRepository.fetchCompletedByLocationRows(snapshotId, {}, range);
    await taskFactsRepository.fetchCompletedByRegionRows(snapshotId, {}, range);

    expect(tmPrisma.$queryRaw).toHaveBeenCalled();
  });

  test('handles optional ranges when none are provided', async () => {
    await taskFactsRepository.fetchCompletedSummaryRows(snapshotId, {}, undefined);
    await taskFactsRepository.fetchCompletedTimelineRows(snapshotId, {}, undefined);
    await taskFactsRepository.fetchCompletedProcessingHandlingTimeRows(snapshotId, {}, undefined);
    await taskFactsRepository.fetchCompletedByNameRows(snapshotId, {}, undefined);
    await taskFactsRepository.fetchCompletedByLocationRows(snapshotId, {}, undefined);
    await taskFactsRepository.fetchCompletedByRegionRows(snapshotId, {}, undefined);

    expect(tmPrisma.$queryRaw).toHaveBeenCalledTimes(6);
  });

  test('builds task events query with explicit date range filters', async () => {
    const from = new Date('2024-01-01');
    const to = new Date('2024-01-31');

    await taskFactsRepository.fetchTaskEventsByServiceRows(snapshotId, { service: ['A'] }, { from, to });
    const query = queryCall();

    expect(query.sql).toContain('reference_date >=');
    expect(query.sql).toContain('reference_date <=');
    expect(query.sql).toContain("date_role IN ('created', 'completed', 'cancelled')");
    expect(query.sql).toContain('snapshot_id =');
    expect(query.values).toEqual(expect.arrayContaining([snapshotId, from, to]));
  });

  test('builds completed summary query for open-ended ranges', async () => {
    const from = new Date('2024-02-01');
    const to = new Date('2024-02-15');

    await taskFactsRepository.fetchCompletedSummaryRows(snapshotId, {}, { from });
    const fromQuery = queryCall();
    expect(fromQuery.sql).toContain('reference_date >=');
    expect(fromQuery.sql).not.toContain('reference_date <=');
    expect(fromQuery.values).toEqual(expect.arrayContaining([snapshotId, from]));

    await taskFactsRepository.fetchCompletedSummaryRows(snapshotId, {}, { to });
    const toQuery = queryCall();
    expect(toQuery.sql).toContain('reference_date <=');
    expect(toQuery.sql).not.toContain('reference_date >=');
    expect(toQuery.values).toEqual(expect.arrayContaining([snapshotId, to]));
  });

  test('fetchOverviewFilterOptionsRows executes all distinct filter lookups', async () => {
    await taskFactsRepository.fetchOverviewFilterOptionsRows(snapshotId);

    expect(tmPrisma.$queryRaw).toHaveBeenCalledTimes(7);
    const sqlStatements = (tmPrisma.$queryRaw as jest.Mock).mock.calls.map(call => call[0].sql);

    expect(sqlStatements.some(sql => sql.includes('jurisdiction_label AS value'))).toBe(true);
    expect(sqlStatements.some(sql => sql.includes('role_category_label AS value'))).toBe(true);
    expect(sqlStatements.some(sql => sql.includes('region AS value'))).toBe(true);
    expect(sqlStatements.some(sql => sql.includes('location AS value'))).toBe(true);
    expect(sqlStatements.some(sql => sql.includes('task_name AS value'))).toBe(true);
    expect(sqlStatements.some(sql => sql.includes('facts.work_type AS value'))).toBe(true);
    expect(sqlStatements.some(sql => sql.includes('assignee AS value'))).toBe(true);
    expect(sqlStatements.some(sql => sql.includes('LEFT JOIN cft_task_db.work_types'))).toBe(true);
  });

  test('uses completed-date filtering for processing and handling time', async () => {
    const from = new Date('2024-03-01');
    const to = new Date('2024-03-10');

    await taskFactsRepository.fetchCompletedProcessingHandlingTimeRows(snapshotId, {}, { from, to });
    const query = queryCall();

    expect(query.sql).toContain("termination_reason = 'completed'");
    expect(query.sql).toContain("state IN ('COMPLETED', 'TERMINATED')");
    expect(query.sql).toContain('completed_date IS NOT NULL');
    expect(query.sql).toContain('completed_date >=');
    expect(query.sql).toContain('completed_date <=');
    expect(query.values).toEqual(expect.arrayContaining([from, to]));
  });

  test('applies due/open filters and priority bucket in due-priority query', async () => {
    await taskFactsRepository.fetchTasksDuePriorityRows(snapshotId, { region: ['North'] });
    const query = queryCall();

    expect(query.sql).toContain("date_role = 'due'");
    expect(query.sql).toContain("task_status = 'open'");
    expect(query.sql).toContain('priority');
    expect(query.sql).toContain('GROUP BY reference_date');
  });

  test('builds service overview query using bucketed CTE and assignment totals', async () => {
    await taskFactsRepository.fetchServiceOverviewRows(snapshotId, { service: ['Service A'], roleCategory: ['Ops'] });
    const query = queryCall();

    expect(query.sql).toContain('WITH bucketed AS');
    expect(query.sql).toContain('jurisdiction_label AS service');
    expect(query.sql).toContain(
      "SUM(CASE WHEN assignment_state = 'Assigned' THEN task_count ELSE 0 END)::int AS assigned_tasks"
    );
    expect(query.sql).toContain("SUM(CASE WHEN priority_bucket = 'Urgent' THEN task_count ELSE 0 END)::int AS urgent");
    expect(query.sql).toContain("date_role = 'due'");
    expect(query.sql).toContain("task_status = 'open'");
    expect(query.sql).toContain('GROUP BY jurisdiction_label');
    expect(query.sql).toContain('ORDER BY service ASC');
  });

  test('builds created-by-assignment query with grouping by date and assignment state', async () => {
    await taskFactsRepository.fetchOpenTasksCreatedByAssignmentRows(snapshotId, { region: ['North'] });
    const query = queryCall();

    expect(query.sql).toContain("date_role = 'created'");
    expect(query.sql).toContain("task_status = 'open'");
    expect(query.sql).toContain("to_char(reference_date, 'YYYY-MM-DD') AS date_key");
    expect(query.sql).toContain('assignment_state');
    expect(query.sql).toContain('GROUP BY reference_date, assignment_state');
    expect(query.sql).toContain('ORDER BY reference_date');
  });

  test('builds timeline query with open-ended range combinations', async () => {
    const from = new Date('2024-04-01');
    const to = new Date('2024-04-15');

    await taskFactsRepository.fetchCompletedTimelineRows(snapshotId, {}, { from });
    const fromQuery = queryCall();
    expect(fromQuery.sql).toContain('reference_date >=');
    expect(fromQuery.sql).not.toContain('reference_date <=');
    expect(fromQuery.sql).toContain('GROUP BY reference_date');
    expect(fromQuery.sql).toContain('ORDER BY reference_date');
    expect(fromQuery.values).toEqual(expect.arrayContaining([from]));

    await taskFactsRepository.fetchCompletedTimelineRows(snapshotId, {}, { to });
    const toQuery = queryCall();
    expect(toQuery.sql).toContain('reference_date <=');
    expect(toQuery.sql).not.toContain('reference_date >=');
    expect(toQuery.values).toEqual(expect.arrayContaining([to]));
  });

  test('builds completed by name/location/region queries and range filters', async () => {
    const from = new Date('2024-05-01');
    const to = new Date('2024-05-31');

    await taskFactsRepository.fetchCompletedByNameRows(snapshotId, { service: ['Service A'] }, { from, to });
    const byNameQuery = queryCall();
    expect(byNameQuery.sql).toContain('task_name');
    expect(byNameQuery.sql).toContain('SUM(task_count)::int AS total');
    expect(byNameQuery.sql).toContain('SUM(CASE WHEN sla_flag IS TRUE THEN task_count ELSE 0 END)::int AS within');
    expect(byNameQuery.sql).toContain('GROUP BY task_name');
    expect(byNameQuery.sql).toContain('ORDER BY total DESC');
    expect(byNameQuery.values).toEqual(expect.arrayContaining([from, to]));

    await taskFactsRepository.fetchCompletedByLocationRows(snapshotId, { region: ['North'] }, { from, to });
    const byLocationQuery = queryCall();
    expect(byLocationQuery.sql).toContain('location');
    expect(byLocationQuery.sql).toContain('region');
    expect(byLocationQuery.sql).toContain('SUM(handling_time_days_sum)::double precision AS handling_time_days_sum');
    expect(byLocationQuery.sql).toContain('SUM(processing_time_days_count)::int AS processing_time_days_count');
    expect(byLocationQuery.sql).toContain('GROUP BY location, region');
    expect(byLocationQuery.sql).toContain('ORDER BY location ASC, region ASC');
    expect(byLocationQuery.values).toEqual(expect.arrayContaining([from, to]));

    await taskFactsRepository.fetchCompletedByRegionRows(snapshotId, { region: ['North'] }, { from, to });
    const byRegionQuery = queryCall();
    expect(byRegionQuery.sql).toContain('region');
    expect(byRegionQuery.sql).toContain('SUM(task_count)::int AS total');
    expect(byRegionQuery.sql).toContain('SUM(processing_time_days_sum)::double precision AS processing_time_days_sum');
    expect(byRegionQuery.sql).toContain('GROUP BY region');
    expect(byRegionQuery.sql).toContain('ORDER BY region ASC');
    expect(byRegionQuery.values).toEqual(expect.arrayContaining([from, to]));
  });

  test('builds processing/handling query with aggregate columns and optional range bounds', async () => {
    const from = new Date('2024-06-01');
    const to = new Date('2024-06-20');

    await taskFactsRepository.fetchCompletedProcessingHandlingTimeRows(snapshotId, {}, { from });
    const fromQuery = queryCall();
    expect(fromQuery.sql).toContain('AVG(handling_time_days)');
    expect(fromQuery.sql).toContain('STDDEV_POP(processing_time_days)');
    expect(fromQuery.sql).toContain('COUNT(processing_time_days)::int AS processing_count');
    expect(fromQuery.sql).toContain('completed_date >=');
    expect(fromQuery.sql).not.toContain('completed_date <=');
    expect(fromQuery.values).toEqual(expect.arrayContaining([from]));

    await taskFactsRepository.fetchCompletedProcessingHandlingTimeRows(snapshotId, {}, { to });
    const toQuery = queryCall();
    expect(toQuery.sql).toContain('completed_date <=');
    expect(toQuery.sql).not.toContain('completed_date >=');
    expect(toQuery.values).toEqual(expect.arrayContaining([to]));
  });
});
