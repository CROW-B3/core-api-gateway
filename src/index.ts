import type { Environment } from './types';
import { Hono } from 'hono';
import { cache } from 'hono/cache';
import { logger as honoLogger } from 'hono/logger';
import { logger } from './lib/logger';
import { authenticateRequestMiddleware } from './middleware/auth';
import { cacheMiddleware } from './middleware/cache';
import { createCorsMiddleware } from './middleware/cors';

import { handleRequest } from './routes';

const app = new Hono<{ Bindings: Environment }>();

app.use(honoLogger());

app.use('/api/*', async (context, next) => {
  const corsMiddleware = createCorsMiddleware(context.env);
  return await corsMiddleware(context, next);
});

app.get(
  '/',
  cache({
    cacheName: 'core-api-gateway',
    cacheControl: 'max-age=300',
  }),
  context => context.json({ status: 'ok', service: 'core-api-gateway' })
);
app.get(
  '/health',
  cache({
    cacheName: 'core-api-gateway',
    cacheControl: 'max-age=60',
  }),
  context =>
    context.json({ status: 'healthy', timestamp: new Date().toISOString() })
);

app.all(
  '/api/:version{v[0-9]+}/auth/onboarding/*',
  authenticateRequestMiddleware,
  handleRequest
);
app.all(
  '/api/:version{v[0-9]+}/auth/team-invitations/*',
  authenticateRequestMiddleware,
  handleRequest
);

app.all('/api/:version{v[0-9]+}/better-auth/*', handleRequest);
app.all('/api/:version{v[0-9]+}/auth/jwt/*', handleRequest);
app.all('/api/:version{v[0-9]+}/auth/*', handleRequest);
app.all('/api/:version{v[0-9]+}/auth', handleRequest);

app.all(
  '/api/:version{v[0-9]+}/:service/*',
  authenticateRequestMiddleware,
  cacheMiddleware,
  handleRequest
);

app.notFound(context =>
  context.json({ error: 'Not Found', message: 'Route not found' }, 404)
);

app.onError((error, context) => {
  logger.error('Gateway error', error);
  return context.json(
    { error: 'Internal Server Error', message: error.message },
    500
  );
});

export default app;
