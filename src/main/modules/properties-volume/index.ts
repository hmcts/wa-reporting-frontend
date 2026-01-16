import * as propertiesVolume from '@hmcts/properties-volume';
import config from 'config';
import { Application } from 'express';
import { get, set } from 'lodash';

export class PropertiesVolume {
  enableFor(server: Application): void {
    if (server.locals.ENV !== 'development') {
      propertiesVolume.addTo(config);

      this.setSecret('secrets.wa.AppInsightsConnectionString', 'appInsights.connectionString');

      this.setSecret('secrets.wa.redis-hostname', 'session.redis.host');
      this.setSecret('secrets.wa.redis-port', 'session.redis.port');
      this.setSecret('secrets.wa.redis-key', 'session.redis.key');

      this.setSecret('secrets.wa.idam-client-secret', 'idam.clientSecret');
      this.setSecret('secrets.wa.session-secret', 'session.secret');
    }
  }

  private setSecret(fromPath: string, toPath: string): void {
    if (config.has(fromPath)) {
      set(config, toPath, get(config, fromPath));
    }
  }
}
