import { initializeOpenTelemetry } from './modules/opentelemetry';

const { Logger } = require('./modules/logging');
const { app } = require('./app');
const telemetry = initializeOpenTelemetry();

const logger = Logger.getLogger('server');
logger.info(`OpenTelemetry ${telemetry.enabled ? 'enabled' : 'disabled'}`);

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

  const shutdown = async (exitCode: number) => {
    try {
      await telemetry.shutdown();
    } catch (error) {
      logger.error('❌ Failed to flush telemetry during shutdown', error);
    }
    process.exit(exitCode);
  };

  // Force shutdown after timeout
  const forcedShutdownTimeout = setTimeout(() => {
    logger.error('❌ Forced shutdown after timeout');
    void shutdown(1);
  }, 10000);

  server.close(() => {
    clearTimeout(forcedShutdownTimeout);
    logger.info('✅ Server closed successfully');
    void shutdown(0);
  });
}

process.on('SIGINT', gracefulShutdownHandler);
process.on('SIGTERM', gracefulShutdownHandler);
