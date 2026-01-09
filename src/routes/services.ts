import type { Context } from 'hono';
import type { Environment } from '../types';
import {
  getCachedResponse,
  getCacheKey,
  setCachedResponse,
  shouldCache,
} from '../lib/cache';
import {
  buildForwardPath,
  extractVersion,
  findServiceByPath,
  forwardRequest,
} from '../lib/router';

export async function handleServiceRequest(
  c: Context<{ Bindings: Environment }>
) {
  const path = c.req.path;
  const version = extractVersion(path);
  const service = findServiceByPath(path);

  if (!service || !version) {
    return c.json({ error: 'Not Found', message: 'Service not found' }, 404);
  }

  const forwardPath = buildForwardPath(path);

  // TODO: refactor cache logic into a cleaner helper function
  if (c.req.method === 'GET') {
    const cacheKey = getCacheKey(c.req.raw, service.path, version);
    const cachedResponse = await getCachedResponse(c.env, cacheKey);
    if (cachedResponse) return cachedResponse;

    const response = await forwardRequest(
      c.req.raw,
      service,
      c.env,
      forwardPath,
      version
    );
    if (shouldCache(c.req.raw, response))
      return setCachedResponse(c.env, cacheKey, response);
    return response;
  }

  return forwardRequest(c.req.raw, service, c.env, forwardPath, version);
}

export async function handleServiceRootRequest(
  c: Context<{ Bindings: Environment }>
) {
  const path = c.req.path;
  const version = extractVersion(path);
  const service = findServiceByPath(path);

  if (!service || !version) {
    return c.json({ error: 'Not Found', message: 'Service not found' }, 404);
  }

  return forwardRequest(c.req.raw, service, c.env, '/', version);
}
