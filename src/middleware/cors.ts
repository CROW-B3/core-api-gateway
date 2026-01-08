import type { Environment } from '../types';
import { cors } from 'hono/cors';

export function createCorsMiddleware(env: Environment) {
  const origins = [
    'https://crowai.dev',
    'https://app.crowai.dev',
    'https://api.crowai.dev',
    'https://dev.crowai.dev',
    'https://dev.app.crowai.dev',
    'https://dev.api.crowai.dev',
  ];

  if (env.ENVIRONMENT === 'local') {
    origins.push(
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:8000'
    );
  }

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
