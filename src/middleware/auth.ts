import type { Context, Next } from 'hono';
import type { Environment } from '../types';
import {
  createAnonymousSession,
  fetchOrganizationIdFromSession,
  fetchTokenFromSession,
} from '../lib/auth';
import { extractClientIpAddressFromRequest } from '../lib/utils';

declare module 'hono' {
  interface ContextVariableMap {
    token: string;
    organizationId: string;
  }
}

const AUTH_CACHE_TTL = 3600;
const AUTH_CACHE_PREFIX = 'auth:ip:';

const attemptSessionTokenRetrieval = async (
  context: Context<{ Bindings: Environment }>,
  cookieHeader: string
): Promise<boolean> => {
  const token = await fetchTokenFromSession(context.env, cookieHeader);
  if (!token) {
    return false;
  }
  context.set('token', token);

  const organizationId = await fetchOrganizationIdFromSession(
    context.env,
    cookieHeader
  );
  if (organizationId) {
    context.set('organizationId', organizationId);
  }

  return true;
};

const attemptCachedTokenRetrieval = async (
  context: Context<{ Bindings: Environment }>,
  cacheKey: string
): Promise<boolean> => {
  const cachedToken = await context.env.CACHE.get(cacheKey);
  if (!cachedToken) {
    return false;
  }
  context.set('token', cachedToken);
  return true;
};

const createUnauthorizedResponse = (context: Context) =>
  context.json(
    { error: 'Unauthorized', message: 'Failed to create session' },
    401
  );

export async function authenticateRequestMiddleware(
  context: Context<{ Bindings: Environment }>,
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
