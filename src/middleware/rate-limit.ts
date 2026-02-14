import type { Context, Next } from 'hono';
import type { Environment } from '../types';
import { WorkersKVStore } from '@hono-rate-limiter/cloudflare';
import { rateLimiter } from 'hono-rate-limiter';
import { extractClientIpAddress } from '../lib/utils';

const createRateLimiterWithFallthrough = (
  context: Context<{ Bindings: Environment }>,
  next: Next,
  windowMilliseconds: number,
  requestLimit: number,
  errorMessage: string,
  options: { skipFailedRequests?: boolean } = {}
) => {
  try {
    const limiter = rateLimiter<{ Bindings: Environment }>({
      windowMs: windowMilliseconds,
      limit: requestLimit,
      keyGenerator: extractClientIpAddress,
      store: new WorkersKVStore({ namespace: context.env.CACHE }),
      standardHeaders: 'draft-7',
      message: { error: 'Too many requests', message: errorMessage },
      ...options,
    });
    return limiter(context, next);
  } catch {
    return next();
  }
};

export const standardRateLimitMiddleware = async (
  context: Context<{ Bindings: Environment }>,
  next: Next
) =>
  createRateLimiterWithFallthrough(
    context,
    next,
    2 * 60 * 1000,
    200,
    'Rate limit exceeded. Please try again later.'
  );

export const authenticationRateLimitMiddleware = async (
  context: Context<{ Bindings: Environment }>,
  next: Next
) => {
  if (context.env.ENVIRONMENT === 'local') {
    return next();
  }

  return createRateLimiterWithFallthrough(
    context,
    next,
    5 * 60 * 1000,
    50,
    'Account temporarily locked. Please try again in 5 minutes.',
    { skipFailedRequests: true }
  );
};

export const publicEndpointRateLimitMiddleware = async (
  context: Context<{ Bindings: Environment }>,
  next: Next
) =>
  createRateLimiterWithFallthrough(
    context,
    next,
    1 * 60 * 1000,
    100,
    'Rate limit exceeded for public endpoints.'
  );
