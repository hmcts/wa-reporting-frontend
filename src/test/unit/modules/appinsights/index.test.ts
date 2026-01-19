describe('AppInsights module', () => {
  const setup = jest.fn().mockReturnThis();
  const setSendLiveMetrics = jest.fn().mockReturnThis();
  const start = jest.fn();
  const trackTrace = jest.fn();

  type MockClient = {
    context: { tags: Record<string, string>; keys: { cloudRole: string } };
    trackTrace: jest.Mock;
  };

  const mockClient: MockClient = {
    context: { tags: {}, keys: { cloudRole: 'role' } },
    trackTrace,
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    jest.doMock('config', () => ({
      get: jest.fn((key: string) => (key === 'appInsights.connectionString' ? 'conn' : undefined)),
    }));

    jest.doMock('applicationinsights', () => ({
      setup,
      setSendLiveMetrics,
      start,
      defaultClient: mockClient,
    }));
  });

  it('initialises application insights when connection string is set', () => {
    const { AppInsights: AppInsightsModule } = require('../../../../main/modules/appinsights');
    const instance = new AppInsightsModule();

    instance.enable();

    expect(setup).toHaveBeenCalledWith('conn');
    expect(setSendLiveMetrics).toHaveBeenCalledWith(true);
    expect(start).toHaveBeenCalled();
    expect(mockClient.trackTrace).toHaveBeenCalledWith({ message: 'App insights activated' });
    expect(mockClient.context.tags.role).toBe('wa-reporting-frontend');
  });

  it('does nothing when connection string is missing', () => {
    jest.doMock('config', () => ({
      get: jest.fn(() => undefined),
    }));

    const { AppInsights: AppInsightsModule } = require('../../../../main/modules/appinsights');
    const instance = new AppInsightsModule();

    instance.enable();

    expect(setup).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });
});
