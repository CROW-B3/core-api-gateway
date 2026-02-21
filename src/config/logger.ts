import type { Environment } from '../types';
import log from 'loglevel';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function resolveLogLevel(env: Environment): LogLevel {
  const environment = env.ENVIRONMENT || 'prod';

  if (environment === 'local') return 'debug';
  if (environment === 'dev') return 'info';

  return 'warn';
}

export function createLogger(env: Environment) {
  const level = resolveLogLevel(env);
  log.setLevel(level);
  return log;
}
