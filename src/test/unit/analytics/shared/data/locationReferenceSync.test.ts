const mockConfigHas = jest.fn();
const mockConfigGet = jest.fn();
const mockLrdQueryRaw = jest.fn();
const mockTmTransaction = jest.fn();
const mockTxQueryRaw = jest.fn();
const mockTxExecuteRaw = jest.fn();
const mockGetLogger = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('config', () => ({
  has: (...args: unknown[]) => mockConfigHas(...args),
  get: (...args: unknown[]) => mockConfigGet(...args),
}));

jest.mock('../../../../../main/modules/analytics/shared/data/prisma', () => ({
  lrdPrisma: { $queryRaw: (...args: unknown[]) => mockLrdQueryRaw(...args) },
  tmPrisma: { $transaction: (...args: unknown[]) => mockTmTransaction(...args) },
}));

jest.mock('../../../../../main/modules/logging', () => ({
  Logger: {
    getLogger: (...args: unknown[]) =>
      mockGetLogger(...args) ??
      ({
        info: mockLoggerInfo,
        error: mockLoggerError,
      } as never),
  },
}));

const sqlText = (query: { strings?: readonly string[]; sql?: string }): string =>
  query.strings?.join('') ?? query.sql ?? '';

const sqlValues = (query: { values?: unknown[] }): unknown[] => query.values ?? [];

describe('locationReferenceSync', () => {
  const loadModule = () => require('../../../../../main/modules/analytics/shared/data/locationReferenceSync');
  const runTransaction = async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({ $queryRaw: mockTxQueryRaw, $executeRaw: mockTxExecuteRaw });

  beforeEach(() => {
    mockConfigHas.mockReset();
    mockConfigGet.mockReset();
    mockLrdQueryRaw.mockReset();
    mockTmTransaction.mockReset();
    mockTxQueryRaw.mockReset();
    mockTxExecuteRaw.mockReset();
    mockGetLogger.mockReset();
    mockLoggerInfo.mockReset();
    mockLoggerError.mockReset();
    mockGetLogger.mockReturnValue({
      info: mockLoggerInfo,
      error: mockLoggerError,
    });
    mockConfigHas.mockReturnValue(true);
    mockConfigGet.mockReturnValue({ enabled: true, intervalSeconds: 900 });
    mockTmTransaction.mockImplementation(runTransaction);
    mockTxQueryRaw.mockResolvedValue([{ acquired: true }]);
    mockTxExecuteRaw.mockResolvedValue(0);
  });

  test('builds and stores case-type and generic EPIMMS lookup rows from LRD', async () => {
    const { syncLocationReferenceData } = loadModule();
    mockLrdQueryRaw
      .mockResolvedValueOnce([
        {
          epimms_id: '100',
          ccd_case_type: 'CivilCaseType',
          service_code: 'AAA',
          court_type_id: 'civil',
          site_name: 'Leeds Crown Court',
          region_id: '1',
        },
        {
          epimms_id: '200',
          ccd_case_type: 'WaCaseType',
          service_code: 'WA',
          court_type_id: 'tribunal',
          site_name: 'London Tribunal',
          region_id: null,
        },
      ])
      .mockResolvedValueOnce([{ epimms_id: '300', site_name: 'York Crown Court', region_id: '2' }]);

    await syncLocationReferenceData();

    expect(mockGetLogger).toHaveBeenCalledWith('location-reference-sync');
    expect(mockLrdQueryRaw).toHaveBeenCalledTimes(2);
    const caseTypeLookupQuery = mockLrdQueryRaw.mock.calls[0][0];
    expect(sqlText(caseTypeLookupQuery)).toContain('FROM court_venue cv');
    expect(sqlText(caseTypeLookupQuery)).toContain('court_type_service_assoc ctsa');
    expect(sqlText(caseTypeLookupQuery)).toContain('service_to_ccd_case_type_assoc assoc');
    expect(sqlText(caseTypeLookupQuery)).toContain('GROUP BY');
    expect(sqlText(caseTypeLookupQuery)).toContain('COUNT(DISTINCT cv.court_type_id) = 1');
    expect(sqlText(caseTypeLookupQuery)).toContain('COUNT(DISTINCT cv.site_name) = 1');

    const epimmsLookupQuery = mockLrdQueryRaw.mock.calls[1][0];
    expect(sqlText(epimmsLookupQuery)).toContain('FROM court_venue cv');
    expect(sqlText(epimmsLookupQuery)).toContain('GROUP BY cv.epimms_id');
    expect(sqlText(epimmsLookupQuery)).toContain('HAVING COUNT(DISTINCT cv.site_name) = 1');
    expect(sqlText(epimmsLookupQuery)).not.toContain('ccd_case_type');

    expect(mockTmTransaction).toHaveBeenCalledTimes(1);
    const lockQuery = mockTxQueryRaw.mock.calls[0][0];
    expect(sqlText(lockQuery)).toContain('pg_try_advisory_xact_lock');
    expect(sqlValues(lockQuery)).toEqual(['analytics_location_reference_sync_lock']);

    expect(mockTxExecuteRaw).toHaveBeenCalledTimes(5);
    expect(sqlText(mockTxExecuteRaw.mock.calls[0][0])).toContain('DELETE FROM analytics.court_venue_case_type_lookup');
    expect(sqlText(mockTxExecuteRaw.mock.calls[1][0])).toContain('DELETE FROM analytics.court_venue_epimms_lookup');

    const caseTypeInsert = mockTxExecuteRaw.mock.calls[2][0];
    expect(sqlText(caseTypeInsert)).toContain('INSERT INTO analytics.court_venue_case_type_lookup');
    expect(sqlValues(caseTypeInsert)).toEqual([
      '100',
      'CivilCaseType',
      'AAA',
      'civil',
      'Leeds Crown Court',
      '1',
      '200',
      'WaCaseType',
      'WA',
      'tribunal',
      'London Tribunal',
      null,
    ]);

    const epimmsInsert = mockTxExecuteRaw.mock.calls[3][0];
    expect(sqlText(epimmsInsert)).toContain('INSERT INTO analytics.court_venue_epimms_lookup');
    expect(sqlValues(epimmsInsert)).toEqual(['300', 'York Crown Court', '2']);

    const syncStateUpsert = mockTxExecuteRaw.mock.calls[4][0];
    expect(sqlText(syncStateUpsert)).toContain('INSERT INTO analytics.location_reference_sync_state');
    expect(sqlText(syncStateUpsert)).toContain('ON CONFLICT (singleton_id) DO UPDATE');
    expect(sqlValues(syncStateUpsert)).toEqual([2, 1]);
    expect(mockLoggerInfo).toHaveBeenCalledWith('Synced location reference data', {
      caseTypeLookupRows: 2,
      epimmsLookupRows: 1,
    });
  });

  test('skips analytics writes when the advisory lock is unavailable', async () => {
    const { syncLocationReferenceData } = loadModule();
    mockLrdQueryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mockTxQueryRaw.mockResolvedValueOnce([{ acquired: false }]);

    await syncLocationReferenceData();

    expect(mockTxQueryRaw).toHaveBeenCalledTimes(1);
    expect(mockLrdQueryRaw).not.toHaveBeenCalled();
    expect(mockTxExecuteRaw).not.toHaveBeenCalled();
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      'Skipping location reference sync because advisory lock was not acquired'
    );
    expect(mockLoggerInfo).not.toHaveBeenCalledWith('Synced location reference data', expect.any(Object));
  });

  test('skips analytics writes when the advisory lock query returns no rows', async () => {
    const { syncLocationReferenceData } = loadModule();
    mockTxQueryRaw.mockResolvedValueOnce([]);

    await syncLocationReferenceData();

    expect(mockLrdQueryRaw).not.toHaveBeenCalled();
    expect(mockTxExecuteRaw).not.toHaveBeenCalled();
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      'Skipping location reference sync because advisory lock was not acquired'
    );
  });

  test('still records sync state when lookup result sets are empty', async () => {
    const { syncLocationReferenceData } = loadModule();
    mockLrdQueryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await syncLocationReferenceData();

    expect(mockTxExecuteRaw).toHaveBeenCalledTimes(3);
    expect(sqlText(mockTxExecuteRaw.mock.calls[0][0])).toContain('DELETE FROM analytics.court_venue_case_type_lookup');
    expect(sqlText(mockTxExecuteRaw.mock.calls[1][0])).toContain('DELETE FROM analytics.court_venue_epimms_lookup');
    expect(sqlText(mockTxExecuteRaw.mock.calls[2][0])).toContain('INSERT INTO analytics.location_reference_sync_state');
    expect(sqlValues(mockTxExecuteRaw.mock.calls[2][0])).toEqual([0, 0]);
  });

  test('skips bootstrap sync and interval registration when disabled', async () => {
    const { bootstrapLocationReferenceSync } = loadModule();
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    mockConfigGet.mockReturnValue({ enabled: false, intervalSeconds: 900 });

    await bootstrapLocationReferenceSync();

    expect(mockConfigHas).toHaveBeenCalledWith('analytics.locationReferenceSync');
    expect(mockConfigGet).toHaveBeenCalledWith('analytics.locationReferenceSync');
    expect(mockLrdQueryRaw).not.toHaveBeenCalled();
    expect(mockTmTransaction).not.toHaveBeenCalled();
    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(mockLoggerInfo).toHaveBeenCalledWith('Location reference sync disabled; skipping startup sync');

    setIntervalSpy.mockRestore();
  });

  test('logs startup sync failures and still registers the periodic sync', async () => {
    const { bootstrapLocationReferenceSync } = loadModule();
    const unref = jest.fn();
    const setIntervalSpy = jest.spyOn(global, 'setInterval').mockReturnValue({ unref } as unknown as NodeJS.Timeout);
    const startupError = new Error('lrd unavailable');
    mockConfigGet.mockReturnValue({ enabled: true, intervalSeconds: 120 });
    mockLrdQueryRaw.mockRejectedValueOnce(startupError);

    await bootstrapLocationReferenceSync();

    expect(mockConfigHas).toHaveBeenCalledWith('analytics.locationReferenceSync');
    expect(mockConfigGet).toHaveBeenCalledWith('analytics.locationReferenceSync');
    expect(mockLoggerError).toHaveBeenCalledWith(
      'Failed to sync location reference data during startup',
      expect.objectContaining({ errorMessage: 'lrd unavailable' })
    );
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 120000);
    expect(unref).toHaveBeenCalled();

    setIntervalSpy.mockRestore();
  });

  test('logs non-Error startup sync failures with a generic error payload', async () => {
    const { bootstrapLocationReferenceSync } = loadModule();
    const setIntervalSpy = jest
      .spyOn(global, 'setInterval')
      .mockReturnValue({ unref: jest.fn() } as unknown as NodeJS.Timeout);
    mockLrdQueryRaw.mockRejectedValueOnce('lrd unavailable');

    await bootstrapLocationReferenceSync();

    expect(mockLoggerError).toHaveBeenCalledWith('Failed to sync location reference data during startup', {
      error: 'lrd unavailable',
    });

    setIntervalSpy.mockRestore();
  });

  test('logs periodic sync failures', async () => {
    const { bootstrapLocationReferenceSync } = loadModule();
    let intervalCallback: (() => void) | undefined;
    const setIntervalSpy = jest.spyOn(global, 'setInterval').mockImplementation(callback => {
      intervalCallback = callback as () => void;
      return { unref: jest.fn() } as unknown as NodeJS.Timeout;
    });
    mockLrdQueryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await bootstrapLocationReferenceSync();

    mockLrdQueryRaw.mockRejectedValueOnce(new Error('periodic lrd unavailable'));
    intervalCallback?.();
    await new Promise(resolve => setImmediate(resolve));

    expect(mockLoggerError).toHaveBeenCalledWith(
      'Failed to sync location reference data on interval',
      expect.objectContaining({ errorMessage: 'periodic lrd unavailable' })
    );

    setIntervalSpy.mockRestore();
  });

  test('uses default config when the optional location reference config is absent', async () => {
    const { bootstrapLocationReferenceSync } = loadModule();
    const unref = jest.fn();
    const setIntervalSpy = jest.spyOn(global, 'setInterval').mockReturnValue({ unref } as unknown as NodeJS.Timeout);
    mockConfigHas.mockReturnValue(false);
    mockLrdQueryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await bootstrapLocationReferenceSync();

    expect(mockConfigHas).toHaveBeenCalledWith('analytics.locationReferenceSync');
    expect(mockConfigGet).not.toHaveBeenCalledWith('analytics.locationReferenceSync');
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10800000);

    setIntervalSpy.mockRestore();
  });
});
