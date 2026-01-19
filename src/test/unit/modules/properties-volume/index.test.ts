import type { Application } from 'express';

describe('PropertiesVolume module', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('adds secrets to config when not in development', () => {
    const addTo = jest.fn();
    const has = jest.fn((key: string) => key === 'secrets.wa.app-insights-connection-string');
    const config = { has };
    const set = jest.fn();
    const get = jest.fn(() => 'secret-value');

    jest.doMock('@hmcts/properties-volume', () => ({ addTo }));
    jest.doMock('config', () => config);
    jest.doMock('lodash', () => ({ get, set }));

    const app = { locals: { ENV: 'production' } } as unknown as Application;

    jest.isolateModules(() => {
      const { PropertiesVolume } = require('../../../../main/modules/properties-volume');
      new PropertiesVolume().enableFor(app);
    });

    expect(addTo).toHaveBeenCalledWith(config);
    expect(set).toHaveBeenCalledWith(config, 'appInsights.connectionString', 'secret-value');
  });

  it('does nothing in development', () => {
    const addTo = jest.fn();
    const has = jest.fn();

    jest.doMock('@hmcts/properties-volume', () => ({ addTo }));
    jest.doMock('config', () => ({ has }));
    jest.doMock('lodash', () => ({ get: jest.fn(), set: jest.fn() }));

    const app = { locals: { ENV: 'development' } } as unknown as Application;

    jest.isolateModules(() => {
      const { PropertiesVolume } = require('../../../../main/modules/properties-volume');
      new PropertiesVolume().enableFor(app);
    });

    expect(addTo).not.toHaveBeenCalled();
    expect(has).not.toHaveBeenCalled();
  });
});
