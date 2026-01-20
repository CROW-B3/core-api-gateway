import type { Environment } from '../types';
import { cors } from 'hono/cors';
import { LOCAL_ORIGINS, PROD_ORIGINS } from '../constants';

export function createCorsMiddleware(env: Environment) {
  const origins =
    env.ENVIRONMENT === 'local'
      ? [...PROD_ORIGINS, ...LOCAL_ORIGINS]
      : [...PROD_ORIGINS];

  return cors({
    origin: origins,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposeHeaders: [
      'X-Cache',
      'X-Cache-Age',
      'X-Gateway-Service',
      'X-Gateway-Version',
    ],
    maxAge: 86400,
  });
}
