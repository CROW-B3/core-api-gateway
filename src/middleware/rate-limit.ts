import type { Context, Next } from 'hono';
import type { Environment } from '../types';
import { WorkersKVStore } from '@hono-rate-limiter/cloudflare';
import { rateLimiter } from 'hono-rate-limiter';
import { getClientIP } from '../lib/utils';

export const rateLimitMiddleware = async (
  c: Context<{ Bindings: Environment }>,
  next: Next
) => {
  try {
    return await rateLimiter<{ Bindings: Environment }>({
      windowMs: 2 * 60 * 1000,
      limit: 200,
      keyGenerator: getClientIP,
      store: new WorkersKVStore({ namespace: c.env.CACHE }),
    })(c, next);
  } catch {
    return next();
  }
};
