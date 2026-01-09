import log from 'loglevel';

log.setLevel('debug');

export const logger = {
  debug: (msg: string, data?: unknown) =>
    log.debug(`[gateway] ${msg}`, data ?? ''),
  info: (msg: string, data?: unknown) =>
    log.info(`[gateway] ${msg}`, data ?? ''),
  warn: (msg: string, data?: unknown) =>
    log.warn(`[gateway] ${msg}`, data ?? ''),
  error: (msg: string, data?: unknown) =>
    log.error(`[gateway] ${msg}`, data ?? ''),
};
