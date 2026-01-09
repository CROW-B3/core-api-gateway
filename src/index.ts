import type { Environment } from './types';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { authMiddleware } from './middleware/auth';
import { createCorsMiddleware } from './middleware/cors';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { handleAuthRequest, handleAuthRootRequest } from './routes/auth';
import {
  handleServiceRequest,
  handleServiceRootRequest,
} from './routes/services';

const app = new Hono<{ Bindings: Environment }>();

app.use(logger());
app.use('/api/*', rateLimitMiddleware);

app.use('/api/*', async (c, next) => {
  const corsMiddleware = createCorsMiddleware(c.env);
  return corsMiddleware(c, next);
});

app.get('/', c => c.json({ status: 'ok', service: 'core-api-gateway' }));
app.get('/health', c =>
  c.json({ status: 'healthy', timestamp: new Date().toISOString() })
);

app.all('/api/:version{v[0-9]+}/auth/*', handleAuthRequest);
app.all('/api/:version{v[0-9]+}/auth', handleAuthRootRequest);

app.all(
  '/api/:version{v[0-9]+}/:service/*',
  authMiddleware,
  handleServiceRequest
);
app.all(
  '/api/:version{v[0-9]+}/:service',
  authMiddleware,
  handleServiceRootRequest
);

app.notFound(c =>
  c.json({ error: 'Not Found', message: 'Route not found' }, 404)
);

app.onError((err, c) => {
  console.error('Gateway error:', err);
  return c.json({ error: 'Internal Server Error', message: err.message }, 500);
});

export default app;
