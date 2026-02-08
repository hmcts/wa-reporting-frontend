import * as propertiesVolume from '@hmcts/properties-volume';
import config from 'config';
import { Application } from 'express';
import { get, set } from 'lodash';

export class PropertiesVolume {
  enableFor(server: Application): void {
    if (server.locals.ENV !== 'development') {
      propertiesVolume.addTo(config);

      this.setSecret('secrets.wa.app-insights-connection-string', 'appInsights.connectionString');

      this.setSecret('secrets.wa.wa-reporting-redis-host', 'session.redis.host');
      this.setSecret('secrets.wa.wa-reporting-redis-port', 'session.redis.port');
      this.setSecret('secrets.wa.wa-reporting-redis-access-key', 'session.redis.key');

      this.setSecret('secrets.wa.idam-client-secret', 'idam.clientSecret');
      this.setSecret('secrets.wa.session-secret', 'session.secret');

      this.setSecret('secrets.wa.csrf-cookie-secret', 'csrfCookieSecret');

      this.setSecret('secrets.wa.cft-task-POSTGRES-USER-FLEXIBLE-REPLICA', 'database.tm.user');
      this.setSecret('secrets.wa.cft-task-POSTGRES-PASS-FLEXIBLE-REPLICA', 'database.tm.password');
      this.setSecret('secrets.wa.rd-caseworker-ref-api-POSTGRES-USER', 'database.crd.user');
      this.setSecret('secrets.wa.rd-caseworker-ref-api-POSTGRES-PASS', 'database.crd.password');
      this.setSecret('secrets.wa.rd-location-ref-api-POSTGRES-USER', 'database.lrd.user');
      this.setSecret('secrets.wa.rd-location-ref-api-POSTGRES-PASS', 'database.lrd.password');
    }
  }

  private setSecret(fromPath: string, toPath: string): void {
    if (config.has(fromPath)) {
      set(config, toPath, get(config, fromPath));
    }
  }
}
