import type { Environment } from '../types';
import log from 'loglevel';

function resolveLogLevel(env: Environment): log.LogLevelDesc {
  const environment = env.ENVIRONMENT || 'prod';

  if (environment === 'local') return 'debug';
  if (environment === 'dev') return 'info';

  return 'warn';
}

export function createLogger(env: Environment) {
  log.setLevel(resolveLogLevel(env));
  return {
    debug: (msg: string, data?: unknown) =>
      log.debug(`[gateway] ${msg}`, data ?? ''),
    info: (msg: string, data?: unknown) =>
      log.info(`[gateway] ${msg}`, data ?? ''),
    warn: (msg: string, data?: unknown) =>
      log.warn(`[gateway] ${msg}`, data ?? ''),
    error: (msg: string, data?: unknown) =>
      log.error(`[gateway] ${msg}`, data ?? ''),
  };
}
