import type { Context, Next } from 'hono';
import type { Environment } from '../types';
import {
  buildCacheKey,
  fetchCachedResponse,
  shouldCacheResponse,
  storeCachedResponse,
} from '../lib/cache';
import { extractVersion, findServiceByPath } from '../lib/router';

export async function cacheMiddleware(
  context: Context<{ Bindings: Environment }>,
  next: Next
) {
  if (context.req.method !== 'GET') {
    return next();
  }

  const requestPath = context.req.path;
  const version = extractVersion(requestPath);
  const service = findServiceByPath(requestPath);

  if (!service || !version) {
    return next();
  }

  const cacheKey = buildCacheKey(context.req.raw, service.path, version);
  const cachedResponse = await fetchCachedResponse(context.env, cacheKey);
  if (cachedResponse) {
    return cachedResponse;
  }

  await next();

  const response = context.res;
  if (response && shouldCacheResponse(context.req.raw, response)) {
    // Clone the response before reading its body for caching,
    // so the original body stream remains available for the client.
    return storeCachedResponse(context.env, cacheKey, response.clone());
  }

  return response;
}
