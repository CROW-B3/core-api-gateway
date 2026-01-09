import type { Context, Next } from 'hono';
import type { Environment } from '../types';
import { createAnonymousSession } from '../lib/auth';
import { getClientIPFromRequest } from '../lib/utils';

interface AuthContext {
  userId: string;
  token: string;
}

interface CachedAuth {
  token: string;
  userId: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

const AUTH_CACHE_TTL = 3600;
const AUTH_CACHE_PREFIX = 'auth:ip:';

function decodeJWTPayload(token: string): { sub: string } {
  const [, payloadB64] = token.split('.');
  return JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
}

async function getCachedAuth(
  env: Environment,
  ip: string
): Promise<CachedAuth | null> {
  return env.CACHE.get<CachedAuth>(`${AUTH_CACHE_PREFIX}${ip}`, 'json');
}

async function setCachedAuth(
  env: Environment,
  ip: string,
  token: string,
  userId: string
): Promise<void> {
  await env.CACHE.put(
    `${AUTH_CACHE_PREFIX}${ip}`,
    JSON.stringify({ token, userId }),
    { expirationTtl: AUTH_CACHE_TTL }
  );
}

export async function authMiddleware(
  c: Context<{ Bindings: Environment }>,
  next: Next
) {
  const clientIP = getClientIPFromRequest(c.req.raw);

  const cachedAuth = await getCachedAuth(c.env, clientIP);
  if (cachedAuth) {
    c.set('auth', { userId: cachedAuth.userId, token: cachedAuth.token });
    return next();
  }

  const token = await createAnonymousSession(c.env);
  if (!token) {
    return c.json(
      { error: 'Unauthorized', message: 'Failed to create session' },
      401
    );
  }

  const { sub: userId } = decodeJWTPayload(token);
  await setCachedAuth(c.env, clientIP, token, userId);

  c.set('auth', { userId, token });
  return next();
}
