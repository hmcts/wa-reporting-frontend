import { AppInsights } from './modules/appinsights';

new AppInsights().enable();

const { Logger } = require('@hmcts/nodejs-logging');
const { app } = require('./app');

const logger = Logger.getLogger('server');

// used by shutdownCheck in readinessChecks
app.locals.shutdown = false;

const port: number = parseInt(process.env.PORT || '3100', 10);

const server = app.listen(port, () => {
  logger.info(`Application started: http://localhost:${port}`);
});

function gracefulShutdownHandler(signal: string) {
  logger.info(`⚠️ Caught ${signal}, gracefully shutting down. Setting readiness to DOWN`);
  // stop the server from accepting new connections
  app.locals.shutdown = true;
  app.emit('shutdown');

  server.close(() => {
    logger.info('✅ Server closed successfully');
    process.exit(0);
  });

  // Force shutdown after timeout
  setTimeout(() => {
    logger.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', gracefulShutdownHandler);
process.on('SIGTERM', gracefulShutdownHandler);
