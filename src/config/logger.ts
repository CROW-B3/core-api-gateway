import type { Environment } from '../types';
import pino from 'pino';

const createProductionTransport = () => ({
  target: 'pino/file',
  options: { destination: 1 },
});

const createDevelopmentTransport = () => ({
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'HH:MM:ss',
    ignore: 'pid,hostname',
  },
});

function resolveLogLevel(env: Environment): pino.Level {
  const environment = env.ENVIRONMENT || 'prod';

  if (environment === 'local') return 'debug';
  if (environment === 'dev') return 'info';

  return 'warn';
}

function resolveTransport(env: Environment): pino.TransportSingleOptions {
  const environment = env.ENVIRONMENT || 'prod';
  const isDevelopmentEnvironment =
    environment === 'local' || environment === 'dev';

  return isDevelopmentEnvironment
    ? createDevelopmentTransport()
    : createProductionTransport();
}

export function createLogger(env: Environment): pino.Logger {
  return pino({
    level: resolveLogLevel(env),
    transport: resolveTransport(env),
    formatters: {
      level: label => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
