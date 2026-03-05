import type { Context, Next } from 'hono';
import type { Environment } from '../types';
import { LOCAL_ORIGINS, PROD_ORIGINS } from '../constants';

const ALLOW_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const ALLOW_HEADERS = 'Content-Type,Authorization,X-Requested-With';
const EXPOSE_HEADERS =
  'X-Cache,X-Cache-Age,X-Gateway-Service,X-Gateway-Version';

export function createCorsMiddleware(env: Environment) {
  const allowedOrigins = new Set(
    env.ENVIRONMENT === 'local'
      ? [...PROD_ORIGINS, ...LOCAL_ORIGINS]
      : [...PROD_ORIGINS]
  );

  return async (c: Context, next: Next) => {
    const origin = c.req.header('Origin');
    const isAllowedOrigin =
      origin && origin !== 'null' && allowedOrigins.has(origin);

    if (isAllowedOrigin && c.req.method === 'OPTIONS') {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Access-Control-Allow-Credentials', 'true');
      c.header('Access-Control-Expose-Headers', EXPOSE_HEADERS);
      c.header('Access-Control-Allow-Methods', ALLOW_METHODS);
      c.header('Access-Control-Allow-Headers', ALLOW_HEADERS);
      c.header('Access-Control-Max-Age', '86400');
      c.header('Vary', 'Origin');
      return c.body(null, 204);
    }

    if (!isAllowedOrigin && c.req.method === 'OPTIONS') {
      return c.body(null, 204);
    }

    await next();

    if (isAllowedOrigin) {
      c.res.headers.set('Access-Control-Allow-Origin', origin);
      c.res.headers.set('Access-Control-Allow-Credentials', 'true');
      c.res.headers.set('Access-Control-Expose-Headers', EXPOSE_HEADERS);
      c.res.headers.set('Vary', 'Origin');
    }
  };
}
