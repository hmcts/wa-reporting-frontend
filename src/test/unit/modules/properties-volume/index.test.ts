import type { Application } from 'express';

describe('PropertiesVolume module', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('adds secrets to config when not in development', () => {
    const addTo = jest.fn();
    const config = {};

    jest.doMock('@hmcts/properties-volume', () => ({ addTo }));
    jest.doMock('config', () => config);

    const app = { locals: { ENV: 'production' } } as unknown as Application;

    jest.isolateModules(() => {
      const { PropertiesVolume } = require('../../../../main/modules/properties-volume');
      new PropertiesVolume().enableFor(app);
    });

    expect(addTo).toHaveBeenCalledWith(config);
  });

  it('does nothing in development', () => {
    const addTo = jest.fn();

    jest.doMock('@hmcts/properties-volume', () => ({ addTo }));
    jest.doMock('config', () => ({}));

    const app = { locals: { ENV: 'development' } } as unknown as Application;

    jest.isolateModules(() => {
      const { PropertiesVolume } = require('../../../../main/modules/properties-volume');
      new PropertiesVolume().enableFor(app);
    });

    expect(addTo).not.toHaveBeenCalled();
  });
});
