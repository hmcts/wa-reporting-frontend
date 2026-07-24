describe('PropertiesVolume module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('loads properties in production', () => {
    const addTo = jest.fn();
    const config = {};

    jest.doMock('@hmcts/properties-volume', () => ({ addTo }));
    jest.doMock('config', () => config);

    jest.isolateModules(() => {
      const { loadPropertiesVolume } = require('../../../../main/modules/properties-volume');
      loadPropertiesVolume('production');
    });

    expect(addTo).toHaveBeenCalledWith(config);
  });

  it('uses NODE_ENV when called before the app is created', () => {
    const addTo = jest.fn();
    const config = {};
    process.env.NODE_ENV = 'production';

    jest.doMock('@hmcts/properties-volume', () => ({ addTo }));
    jest.doMock('config', () => config);

    jest.isolateModules(() => {
      const { loadPropertiesVolume } = require('../../../../main/modules/properties-volume');
      loadPropertiesVolume();
    });

    expect(addTo).toHaveBeenCalledWith(config);
  });

  it('defaults to development when NODE_ENV is missing', () => {
    const addTo = jest.fn();
    delete process.env.NODE_ENV;

    jest.doMock('@hmcts/properties-volume', () => ({ addTo }));
    jest.doMock('config', () => ({}));

    jest.isolateModules(() => {
      const { loadPropertiesVolume } = require('../../../../main/modules/properties-volume');
      loadPropertiesVolume();
    });

    expect(addTo).not.toHaveBeenCalled();
  });
});
