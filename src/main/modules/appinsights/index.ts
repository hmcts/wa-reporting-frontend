import config from 'config';

const appInsights = require('applicationinsights');

export class AppInsights {
  enable(): void {
    if (config.get('appInsights.connectionString')) {
      appInsights.setup(config.get('appInsights.connectionString')).setSendLiveMetrics(true).start();

      appInsights.defaultClient.context.tags[appInsights.defaultClient.context.keys.cloudRole] = 'wa-reporting-frontend';
      appInsights.defaultClient.trackTrace({
        message: 'App insights activated',
      });
    }
  }
}
