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

const AUTHENTICATION_CACHE_TIME_TO_LIVE = 3600;
const AUTHENTICATION_CACHE_KEY_PREFIX = 'auth:ip:';

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
  const cookieHeader = context.req.header('cookie');
  if (cookieHeader) {
    const isSessionValid = await attemptSessionTokenRetrieval(
      context,
      cookieHeader
    );
    if (isSessionValid) {
      return next();
    }
  }

  const clientIpAddress = extractClientIpAddressFromRequest(context.req.raw);
  const cacheKey = `${AUTHENTICATION_CACHE_KEY_PREFIX}${clientIpAddress}`;

  const hasCachedToken = await attemptCachedTokenRetrieval(context, cacheKey);
  if (hasCachedToken) {
    return next();
  }

  const token = await createAnonymousSession(context.env);
  if (!token) {
    return createUnauthorizedResponse(context);
  }

  await context.env.CACHE.put(cacheKey, token, {
    expirationTtl: AUTHENTICATION_CACHE_TIME_TO_LIVE,
  });
  context.set('token', token);
  return next();
}
