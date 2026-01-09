import type { Environment } from './types';
import { Hono } from 'hono';
import { cache } from 'hono/cache';
import { logger as honoLogger } from 'hono/logger';
import { logger } from './lib/logger';
import { authMiddleware } from './middleware/auth';
import { cacheMiddleware } from './middleware/cache';
import { createCorsMiddleware } from './middleware/cors';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { handleAuthRequest, handleAuthRootRequest } from './routes/auth';
import { handleServiceRequest } from './routes/services';

const app = new Hono<{ Bindings: Environment }>();

app.use(honoLogger());
app.use('/api/*', rateLimitMiddleware);

app.use('/api/*', async (c, next) => {
  const corsMiddleware = createCorsMiddleware(c.env);
  return corsMiddleware(c, next);
});

app.get(
  '/',
  cache({
    cacheName: 'core-api-gateway',
    cacheControl: 'max-age=300',
  }),
  c => c.json({ status: 'ok', service: 'core-api-gateway' })
);
app.get(
  '/health',
  cache({
    cacheName: 'core-api-gateway',
    cacheControl: 'max-age=60',
  }),
  c => c.json({ status: 'healthy', timestamp: new Date().toISOString() })
);

app.all('/api/:version{v[0-9]+}/auth/*', handleAuthRequest);
app.all('/api/:version{v[0-9]+}/auth', handleAuthRootRequest);

app.all(
  '/api/:version{v[0-9]+}/:service/*',
  authMiddleware,
  cacheMiddleware,
  handleServiceRequest
);

app.notFound(c =>
  c.json({ error: 'Not Found', message: 'Route not found' }, 404)
);

app.onError((err, c) => {
  logger.error('Gateway error', err);
  return c.json({ error: 'Internal Server Error', message: err.message }, 500);
});

export default app;
