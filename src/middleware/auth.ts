import type { Context, Next } from 'hono';
import type { Environment } from '../types';
import {
  createAnonymousSession,
  extractBearerToken,
  extractSessionCookie,
  getTokenFromSession,
} from '../lib/auth';
import { verifyJWT } from '../lib/jwt';

interface AuthContext {
  userId: string;
  isAnonymous: boolean;
  token: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

export async function authMiddleware(
  c: Context<{ Bindings: Environment }>,
  next: Next
) {
  let token = extractBearerToken(c.req.raw);

  if (!token) {
    const sessionCookie = extractSessionCookie(c.req.raw);
    if (sessionCookie) {
      token = await getTokenFromSession(c.env, sessionCookie);
    }
  }

  if (token) {
    const payload = await verifyJWT(token, c.env);
    if (payload) {
      c.set('auth', {
        userId: payload.sub,
        isAnonymous: payload.isAnonymous || false,
        token,
      });
      return next();
    }
  }

  const newToken = await createAnonymousSession(c.env);
  if (!newToken) {
    return c.json(
      { error: 'Unauthorized', message: 'Failed to create anonymous session' },
      401
    );
  }

  const payload = await verifyJWT(newToken, c.env);
  if (!payload) {
    return c.json(
      { error: 'Unauthorized', message: 'Invalid anonymous token' },
      401
    );
  }

  c.set('auth', {
    userId: payload.sub,
    isAnonymous: true,
    token: newToken,
  });

  return next();
}

export async function optionalAuthMiddleware(
  c: Context<{ Bindings: Environment }>,
  next: Next
) {
  let token = extractBearerToken(c.req.raw);

  if (!token) {
    const sessionCookie = extractSessionCookie(c.req.raw);
    if (sessionCookie) {
      token = await getTokenFromSession(c.env, sessionCookie);
    }
  }

  if (token) {
    const payload = await verifyJWT(token, c.env);
    if (payload) {
      c.set('auth', {
        userId: payload.sub,
        isAnonymous: payload.isAnonymous || false,
        token,
      });
    }
  }

  return next();
}
