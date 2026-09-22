import winston from 'winston';

const { combine, timestamp, colorize, printf, json } = winston.format;

const devFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
  const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
  return `${ts} [${level}]: ${message}${metaStr}`;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format:
    process.env.NODE_ENV === 'production'
      ? combine(timestamp(), json())
      : combine(colorize(), timestamp({ format: 'HH:mm:ss' }), devFormat),
  transports: [
    new winston.transports.Console(),
    // File transport for errors only
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      silent: process.env.NODE_ENV === 'test',
    }),
  ],
  // Do not crash on unhandled errors in logger
  exitOnError: false,
  silent: process.env.NODE_ENV === 'test',
});

export default logger;
