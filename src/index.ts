import type { Environment } from './types';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import {
  getCachedResponse,
  getCacheKey,
  setCachedResponse,
  shouldCache,
} from './lib/cache';
import {
  buildForwardPath,
  extractVersion,
  findServiceByPath,
  forwardRequest,
} from './lib/router';
import { authMiddleware, optionalAuthMiddleware } from './middleware/auth';
import { createCorsMiddleware } from './middleware/cors';

const app = new Hono<{ Bindings: Environment }>();

app.use(logger());

app.use('/api/*', async (c, next) => {
  const corsMiddleware = createCorsMiddleware(c.env);
  return corsMiddleware(c, next);
});

app.get('/', c => c.json({ status: 'ok', service: 'core-api-gateway' }));

app.get('/health', c =>
  c.json({ status: 'healthy', timestamp: new Date().toISOString() })
);

app.all('/api/:version{v[0-9]+}/auth/*', optionalAuthMiddleware, async c => {
  const path = c.req.path;
  const version = extractVersion(path);
  const service = findServiceByPath(path);

  if (!service || !version) {
    return c.json({ error: 'Not Found', message: 'Service not found' }, 404);
  }

  const forwardPath = buildForwardPath(path);
  return forwardRequest(c.req.raw, service, c.env, forwardPath, version);
});

app.all('/api/:version{v[0-9]+}/:service/*', authMiddleware, async c => {
  const path = c.req.path;
  const version = extractVersion(path);
  const service = findServiceByPath(path);

  if (!service || !version) {
    return c.json({ error: 'Not Found', message: 'Service not found' }, 404);
  }

  const forwardPath = buildForwardPath(path);

  if (c.req.method === 'GET') {
    const cacheKey = getCacheKey(c.req.raw, service.path, version);
    const cachedResponse = await getCachedResponse(c.env, cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    const response = await forwardRequest(
      c.req.raw,
      service,
      c.env,
      forwardPath,
      version
    );

    if (shouldCache(c.req.raw, response)) {
      return setCachedResponse(c.env, cacheKey, response);
    }

    return response;
  }

  return forwardRequest(c.req.raw, service, c.env, forwardPath, version);
});

app.all('/api/:version{v[0-9]+}/:service', authMiddleware, async c => {
  const path = c.req.path;
  const version = extractVersion(path);
  const service = findServiceByPath(path);

  if (!service || !version) {
    return c.json({ error: 'Not Found', message: 'Service not found' }, 404);
  }

  return forwardRequest(c.req.raw, service, c.env, '/', version);
});

app.notFound(c => {
  return c.json({ error: 'Not Found', message: 'Route not found' }, 404);
});

app.onError((err, c) => {
  console.error('Gateway error:', err);
  return c.json({ error: 'Internal Server Error', message: err.message }, 500);
});

export default app;
