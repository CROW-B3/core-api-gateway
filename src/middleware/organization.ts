import type { Context, Next } from 'hono';
import type { Environment } from '../types';
import { ServicePath, SERVICES } from '../constants';

declare module 'hono' {
  interface ContextVariableMap {
    organizationId: string;
    userId: string;
  }
}

const AUTH_SKIP_PATTERNS = [
  /^\/$/,
  /^\/health$/,
  /^\/api\/v\d+\/auth\//,
  /^\/api\/v\d+\/better-auth\//,
  /^\/api\/v\d+\/billing\/webhook$/,
];

const matchesSkipPattern = (path: string): boolean =>
  AUTH_SKIP_PATTERNS.some(pattern => pattern.test(path));

const extractApiKeyFromRequest = (request: Request): string | null => {
  const explicitApiKey = request.headers.get('X-API-Key');
  if (explicitApiKey) return explicitApiKey.trim();

  const authorizationHeader = request.headers.get('Authorization');
  if (authorizationHeader?.startsWith('ApiKey '))
    return authorizationHeader.slice(7).trim();

  return null;
};

const extractSessionTokenFromRequest = (request: Request): string | null => {
  const authorizationHeader = request.headers.get('Authorization');
  if (authorizationHeader?.startsWith('Bearer '))
    return authorizationHeader.slice(7).trim();

  return null;
};

interface SessionResponse {
  user?: { id: string };
  session?: { activeOrganizationId?: string | null };
}

interface ApiKeyVerifyResponse {
  valid?: boolean;
  key?: { userId?: string; metadata?: { organizationId?: string } };
}

interface ApiKeyContext {
  organizationId: string | null;
  userId: string | null;
  revoked?: boolean;
}

const findAuthServiceUrl = (env: Environment): string => {
  const authService = SERVICES.find(
    service => service.path === ServicePath.AUTH
  );
  if (authService) {
    const url =
      authService.urls[env.ENVIRONMENT as keyof typeof authService.urls];
    if (url) return url;
  }
  return env.ENVIRONMENT === 'prod'
    ? 'https://internal.auth-api.crowai.dev'
    : 'https://dev.internal.auth-api.crowai.dev';
};

const resolveContextFromApiKey = async (
  apiKey: string,
  authServiceUrl: string
): Promise<ApiKeyContext> => {
  try {
    const response = await fetch(
      `${authServiceUrl}/api/v1/auth/api-key/verify`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: apiKey }),
      }
    );

    if (response.status === 400) return { organizationId: null, userId: null };

    if (response.status === 401)
      return { organizationId: null, userId: null, revoked: true };

    if (!response.ok) return { organizationId: null, userId: null };

    const data = (await response.json()) as ApiKeyVerifyResponse;

    if (data.valid === false)
      return { organizationId: null, userId: null, revoked: true };

    return {
      organizationId: data.key?.metadata?.organizationId ?? null,
      userId: data.key?.userId ?? null,
    };
  } catch {
    return { organizationId: null, userId: null };
  }
};

const resolveOrganizationFromSession = async (
  sessionToken: string,
  authServiceUrl: string
): Promise<string | null> => {
  try {
    const response = await fetch(`${authServiceUrl}/api/v1/auth/get-session`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as SessionResponse;
    return data.session?.activeOrganizationId ?? null;
  } catch {
    return null;
  }
};

export async function injectOrganizationContext(
  context: Context<{ Bindings: Environment }>,
  next: Next
) {
  const requestPath = context.req.path;

  if (matchesSkipPattern(requestPath)) {
    context.set('organizationId', '');
    context.set('userId', '');
    return next();
  }

  const authServiceUrl = findAuthServiceUrl(context.env);

  const apiKey = extractApiKeyFromRequest(context.req.raw);
  if (apiKey) {
    const { organizationId, userId, revoked } = await resolveContextFromApiKey(
      apiKey,
      authServiceUrl
    );
    if (revoked) {
      return context.json(
        {
          error: 'Unauthorized',
          message: 'API key is invalid or has been revoked',
        },
        401
      );
    }
    context.set('organizationId', organizationId ?? '');
    context.set('userId', userId ?? '');
    return next();
  }

  const sessionToken = extractSessionTokenFromRequest(context.req.raw);
  if (sessionToken) {
    if (sessionToken.startsWith('crow_')) {
      const apiKeyContext = await resolveContextFromApiKey(
        sessionToken,
        authServiceUrl
      );

      if (apiKeyContext.revoked) {
        return context.json(
          {
            error: 'Unauthorized',
            message: 'API key is invalid or has been revoked',
          },
          401
        );
      }

      if (apiKeyContext.organizationId || apiKeyContext.userId) {
        context.set('organizationId', apiKeyContext.organizationId ?? '');
        context.set('userId', apiKeyContext.userId ?? '');
        return next();
      }
    }

    const organizationId = await resolveOrganizationFromSession(
      sessionToken,
      authServiceUrl
    );
    context.set('organizationId', organizationId ?? '');
    context.set('userId', '');
    return next();
  }

  if (!context.get('organizationId')) {
    context.set('organizationId', '');
  }
  context.set('userId', '');
  return next();
}
