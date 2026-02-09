import winston from 'winston';

type LoggerInstance = winston.Logger;

const loggerCache = new Map<string, LoggerInstance>();

const getLogLevel = (): string => (process.env.LOG_LEVEL || 'INFO').toLowerCase();
const isJsonEnabled = (): boolean => process.env.JSON_PRINT === 'true';

const buildFormat = (): winston.Logform.Format => {
  const timestampFormat = winston.format.timestamp();
  if (isJsonEnabled()) {
    return winston.format.combine(timestampFormat, winston.format.json());
  }

  return winston.format.combine(
    timestampFormat,
    winston.format.printf(({ level, message, label, timestamp, ...meta }) => {
      const safeMessage = typeof message === 'string' ? message : JSON.stringify(message);
      const base = `${timestamp} ${level} [${label}] ${safeMessage}`;
      const metaKeys = Object.keys(meta);
      if (metaKeys.length === 0) {
        return base;
      }
      return `${base} ${JSON.stringify(meta)}`;
    })
  );
};

const createLogger = (name: string): LoggerInstance =>
  winston.createLogger({
    level: getLogLevel(),
    format: buildFormat(),
    defaultMeta: { label: name },
    transports: [new winston.transports.Console()],
  });

export class Logger {
  static getLogger(name: string): LoggerInstance {
    const existing = loggerCache.get(name);
    if (existing) {
      return existing;
    }
    const logger = createLogger(name);
    loggerCache.set(name, logger);
    return logger;
  }
}

export default Logger;
