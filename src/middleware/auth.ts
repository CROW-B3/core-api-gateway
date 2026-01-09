import type { Context, Next } from 'hono';
import type { Environment } from '../types';
import { createAnonymousSession } from '../lib/auth';
import { getClientIPFromRequest } from '../lib/utils';

declare module 'hono' {
  interface ContextVariableMap {
    token: string;
  }
}

const AUTH_CACHE_TTL = 3600;
const AUTH_CACHE_PREFIX = 'auth:ip:';

export async function authMiddleware(
  c: Context<{ Bindings: Environment }>,
  next: Next
) {
  const clientIP = getClientIPFromRequest(c.req.raw);
  const cacheKey = `${AUTH_CACHE_PREFIX}${clientIP}`;

  const cachedToken = await c.env.CACHE.get(cacheKey);
  if (cachedToken) {
    c.set('token', cachedToken);
    return next();
  }

  const token = await createAnonymousSession(c.env);
  if (!token) {
    return c.json(
      { error: 'Unauthorized', message: 'Failed to create session' },
      401
    );
  }

  await c.env.CACHE.put(cacheKey, token, { expirationTtl: AUTH_CACHE_TTL });
  c.set('token', token);
  return next();
}
