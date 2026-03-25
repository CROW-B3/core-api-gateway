import type { Environment } from './types';
import { OpenAPIHono } from '@hono/zod-openapi';
import { cache } from 'hono/cache';
import { logger as honoLogger } from 'hono/logger';
import { logger } from './lib/logger';
import { authenticateRequestMiddleware } from './middleware/auth';
import { cacheMiddleware } from './middleware/cache';
import { createCorsMiddleware } from './middleware/cors';
import { injectOrganizationContext } from './middleware/organization';
import {
  authenticationRateLimitMiddleware,
  publicEndpointRateLimitMiddleware,
  standardRateLimitMiddleware,
} from './middleware/rate-limit';
import { securityHeadersMiddleware } from './middleware/security-headers';
import { handleRequest } from './routes';

const app = new OpenAPIHono<{ Bindings: Environment }>();

app.use(honoLogger());

const corsMiddleware = createCorsMiddleware();
app.use('*', async (context, next) => corsMiddleware(context, next));
app.use('*', securityHeadersMiddleware);

app.use('/health', publicEndpointRateLimitMiddleware);
app.use('/', publicEndpointRateLimitMiddleware);

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
  authenticationRateLimitMiddleware,
  authenticateRequestMiddleware,
  handleRequest
);
app.all(
  '/api/:version{v[0-9]+}/auth/team-invitations/*',
  authenticationRateLimitMiddleware,
  authenticateRequestMiddleware,
  handleRequest
);

app.all('/api/:version{v[0-9]+}/better-auth/*', handleRequest);
app.all('/api/:version{v[0-9]+}/products/images/*', handleRequest);
app.all('/api/:version{v[0-9]+}/auth/jwt/*', handleRequest);
app.all(
  '/api/:version{v[0-9]+}/auth/*',
  authenticationRateLimitMiddleware,
  handleRequest
);
app.all(
  '/api/:version{v[0-9]+}/auth',
  authenticationRateLimitMiddleware,
  handleRequest
);

app.all(
  '/api/:version{v[0-9]+}/:service/*',
  standardRateLimitMiddleware,
  injectOrganizationContext,
  cacheMiddleware,
  handleRequest
);

app.notFound(context =>
  context.json({ error: 'Not Found', message: 'Route not found' }, 404)
);

app.onError((error, context) => {
  logger.error('Gateway error', error);
  return context.json({ error: 'Internal Server Error' }, 500);
});

app.doc('/docs', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'CROW API Gateway',
  },
});

export default app;
