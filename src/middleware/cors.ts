import type { Context, Next } from 'hono';

const ALLOWED_ORIGINS = [
  'https://crowai.dev',
  'https://dev.crowai.dev',
  'https://app.crowai.dev',
  'https://dev.app.crowai.dev',
  'https://auth.crowai.dev',
  'https://dev.auth.crowai.dev',
  'https://dashboard.crowai.dev',
  'https://dev.dashboard.crowai.dev',
  'https://rogue.crowai.dev',
  'https://dev.rogue.crowai.dev',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
];

const ALLOW_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const ALLOW_HEADERS =
  'Content-Type,Authorization,X-Requested-With,X-API-Key,X-Organization-Id,X-Internal-Key,Cookie';
const EXPOSE_HEADERS =
  'X-Cache,X-Cache-Age,X-Gateway-Service,X-Gateway-Version';

const resolveAllowedOrigin = (requestOrigin: string | undefined): string | null =>
  requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : null;

const setCorsHeaders = (headers: Headers, origin: string): void => {
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Expose-Headers', EXPOSE_HEADERS);
  headers.set('Vary', 'Origin');
};

export function createCorsMiddleware() {
  return async (c: Context, next: Next) => {
    const origin = resolveAllowedOrigin(c.req.header('Origin'));

    if (!origin) {
      return next();
    }

    if (c.req.method === 'OPTIONS') {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Access-Control-Allow-Credentials', 'true');
      c.header('Access-Control-Allow-Methods', ALLOW_METHODS);
      c.header('Access-Control-Allow-Headers', ALLOW_HEADERS);
      c.header('Access-Control-Expose-Headers', EXPOSE_HEADERS);
      c.header('Access-Control-Max-Age', '86400');
      c.header('Vary', 'Origin');
      return c.body(null, 204);
    }

    try {
      await next();
    } finally {
      setCorsHeaders(c.res.headers, origin);
    }
  };
}
