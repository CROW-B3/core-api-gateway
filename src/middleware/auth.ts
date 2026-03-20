import type { Context, Next } from 'hono';
import type { Environment } from '../types';
import {
  createAnonymousSession,
  fetchOrganizationIdFromSession,
  fetchTokenFromSession,
} from '../lib/auth';
import { findServiceByPath } from '../lib/router';
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

// Paths that must be publicly reachable even when the service has requiresAuth: true.
// Stripe webhook endpoints must not require authentication — Stripe sends only a
// Stripe-Signature header and relies on signature verification, not HTTP auth.
const PUBLIC_PATH_OVERRIDES = [
  /^\/api\/v\d+\/billing\/webhook$/,
  /^\/api\/v\d+\/webhooks\/stripe$/,
  // Health/readiness probes must be accessible by load balancers without auth
  /^\/api\/v\d+\/[^/]+\/health$/,
  /^\/api\/v\d+\/[^/]+\/ready$/,
  /^\/health$/,
  /^\/ready$/,
];

const isPublicPathOverride = (path: string): boolean =>
  PUBLIC_PATH_OVERRIDES.some(pattern => pattern.test(path));

export async function authenticateRequestMiddleware(
  context: Context<{ Bindings: Environment }>,
  next: Next
) {
  const requestPath = context.req.path;

  // Always allow public path overrides regardless of service requiresAuth setting
  if (isPublicPathOverride(requestPath)) {
    return next();
  }

  const service = findServiceByPath(requestPath);

  // Allow trusted internal service-to-service calls using X-Internal-Key.
  // These come from services like bff-chat-service calling the gateway to
  // fetch data on behalf of a user. The org context is provided via X-Organization-Id.
  const internalKey = context.req.header('x-internal-key');
  if (
    internalKey &&
    context.env.INTERNAL_GATEWAY_KEY &&
    internalKey === context.env.INTERNAL_GATEWAY_KEY
  ) {
    return next();
  }

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

  // Allow API key requests through — organization.ts handles key validation + org resolution.
  // A crow_ prefixed Bearer token or X-API-Key / ApiKey header indicates API key auth.
  const authHeader = context.req.header('authorization') ?? '';
  const apiKeyHeader = context.req.header('x-api-key') ?? '';
  const hasApiKey =
    apiKeyHeader.trim().startsWith('crow_') ||
    authHeader.startsWith('ApiKey ') ||
    (authHeader.startsWith('Bearer ') &&
      authHeader.slice(7).startsWith('crow_'));
  if (hasApiKey) {
    return next();
  }

  if (service?.requiresAuth) {
    return context.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      401
    );
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
