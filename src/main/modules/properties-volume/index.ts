import * as propertiesVolume from '@hmcts/properties-volume';
import config from 'config';

export const loadPropertiesVolume = (environment = process.env.NODE_ENV || 'development'): void => {
  if (environment === 'development') {
    return;
  }

  propertiesVolume.addTo(config);
};
