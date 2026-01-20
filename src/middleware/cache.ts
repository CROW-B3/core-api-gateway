import type { Context, Next } from 'hono';
import type { Environment } from '../types';
import {
  getCachedResponse,
  getCacheKey,
  setCachedResponse,
  shouldCache,
} from '../lib/cache';
import { extractVersion, findServiceByPath } from '../lib/router';

export async function cacheMiddleware(
  c: Context<{ Bindings: Environment }>,
  next: Next
) {
  if (c.req.method !== 'GET') {
    return next();
  }

  const path = c.req.path;
  const version = extractVersion(path);
  const service = findServiceByPath(path);

  if (!service || !version) {
    return next();
  }

  const cacheKey = getCacheKey(c.req.raw, service.path, version);
  const cachedResponse = await getCachedResponse(c.env, cacheKey);
  if (cachedResponse) return cachedResponse;

  const response = await next();

  if (shouldCache(c.req.raw, response)) {
    return setCachedResponse(c.env, cacheKey, response);
  }

  return response;
}
