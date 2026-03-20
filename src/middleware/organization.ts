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
  /^\/api\/v\d+\/better-auth\//,
  /^\/api\/v\d+\/auth\/sign-in/,
  /^\/api\/v\d+\/auth\/sign-up/,
  /^\/api\/v\d+\/auth\/reset-password/,
  /^\/api\/v\d+\/auth\/verify-email/,
  /^\/api\/v\d+\/auth\/callback/,
  /^\/api\/v\d+\/auth\/oauth/,
  /^\/api\/v\d+\/auth\/get-session/,
  /^\/api\/v\d+\/auth\/jwt\//,
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

  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(
      /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=([^;]+)/
    );
    if (match?.[1]) return decodeURIComponent(match[1]);
  }

  return null;
};

interface SessionResponse {
  user?: { id: string };
  session?: { activeOrganizationId?: string | null };
}

interface OrgByAuthIdResponse {
  id?: string;
}

interface UserByAuthIdResponse {
  organizationId?: string;
}

interface ApiKeyVerifyResponse {
  organizationId?: string | null;
  userId?: string | null;
  valid?: boolean;
  key?: { userId?: string; metadata?: { organizationId?: string } };
}

interface ApiKeyContext {
  organizationId: string | null;
  userId: string | null;
  revoked?: boolean;
}

const resolveBetterAuthOrgIdToInternalUuid = async (
  betterAuthOrgId: string,
  env: Environment
): Promise<string | null> => {
  try {
    const orgService = SERVICES.find(s => s.path === ServicePath.ORGANIZATIONS);
    if (!orgService) return null;
    const orgServiceUrl =
      orgService.urls[env.ENVIRONMENT as keyof typeof orgService.urls] ??
      orgService.urls.dev;
    const headers: Record<string, string> = {
      'X-Service-API-Key': env.SERVICE_API_KEY_ORG_SERVICE,
    };
    if ((env as unknown as Record<string, string>).INTERNAL_GATEWAY_KEY) {
      headers['X-Internal-Key'] = (
        env as unknown as Record<string, string>
      ).INTERNAL_GATEWAY_KEY;
    }
    const response = await fetch(
      `${orgServiceUrl}/api/v1/organizations/by-auth-id/${encodeURIComponent(betterAuthOrgId)}`,
      { headers }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as OrgByAuthIdResponse;
    return data.id ?? null;
  } catch {
    return null;
  }
};

const resolveOrgIdFromUserService = async (
  betterAuthUserId: string,
  env: Environment
): Promise<string | null> => {
  try {
    const userService = SERVICES.find(s => s.path === ServicePath.USERS);
    if (!userService) return null;
    const userServiceUrl =
      userService.urls[env.ENVIRONMENT as keyof typeof userService.urls] ??
      userService.urls.dev;
    const headers: Record<string, string> = {
      'X-Service-API-Key': env.SERVICE_API_KEY_ORG_SERVICE,
    };
    if ((env as unknown as Record<string, string>).INTERNAL_GATEWAY_KEY) {
      headers['X-Internal-Key'] = (
        env as unknown as Record<string, string>
      ).INTERNAL_GATEWAY_KEY;
    }
    const response = await fetch(
      `${userServiceUrl}/api/v1/users/by-auth-id/${encodeURIComponent(betterAuthUserId)}`,
      { headers }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as UserByAuthIdResponse;
    return data.organizationId ?? null;
  } catch {
    return null;
  }
};

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

const verifyApiKeyOrgMembership = async (
  userId: string,
  claimedInternalOrgId: string,
  env: Environment
): Promise<boolean> => {
  try {
    const userService = SERVICES.find(s => s.path === ServicePath.USERS);
    if (!userService) return false;
    const userServiceUrl =
      userService.urls[env.ENVIRONMENT as keyof typeof userService.urls] ??
      userService.urls.dev;

    const userHeaders: Record<string, string> = {
      'X-Service-API-Key': env.SERVICE_API_KEY_ORG_SERVICE,
    };
    if ((env as unknown as Record<string, string>).INTERNAL_GATEWAY_KEY) {
      userHeaders['X-Internal-Key'] = (
        env as unknown as Record<string, string>
      ).INTERNAL_GATEWAY_KEY;
    }
    const userResp = await fetch(
      `${userServiceUrl}/api/v1/users/by-auth-id/${encodeURIComponent(userId)}`,
      { headers: userHeaders }
    );
    if (!userResp.ok) return false;
    const userData = (await userResp.json()) as { organizationId?: string };
    return userData.organizationId === claimedInternalOrgId;
  } catch {
    return false;
  }
};

const resolveContextFromApiKey = async (
  apiKey: string,
  authServiceUrl: string,
  env: Environment
): Promise<ApiKeyContext> => {
  try {
    const verifyHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Service-API-Key': env.SERVICE_API_KEY_ORG_SERVICE,
    };
    if (env.INTERNAL_GATEWAY_KEY) {
      verifyHeaders['X-Internal-Key'] = env.INTERNAL_GATEWAY_KEY;
    }
    const response = await fetch(
      `${authServiceUrl}/api/v1/auth/api-key/verify`,
      {
        method: 'POST',
        headers: verifyHeaders,
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

    const organizationId =
      data.organizationId ?? data.key?.metadata?.organizationId ?? null;
    const userId = data.userId ?? data.key?.userId ?? null;

    if (organizationId && userId) {
      const isMember = await verifyApiKeyOrgMembership(
        userId,
        organizationId,
        env
      );
      return { organizationId: isMember ? organizationId : null, userId };
    }

    return { organizationId, userId };
  } catch {
    return { organizationId: null, userId: null };
  }
};

interface SessionContext {
  organizationId: string | null;
  userId: string | null;
}

const resolveOrganizationFromSession = async (
  sessionToken: string,
  authServiceUrl: string,
  env: Environment,
  cookieHeader?: string
): Promise<SessionContext> => {
  try {
    const headers: HeadersInit = { Authorization: `Bearer ${sessionToken}` };
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }
    const response = await fetch(`${authServiceUrl}/api/v1/auth/get-session`, {
      headers,
    });
    if (!response.ok) return { organizationId: null, userId: null };
    const data = (await response.json()) as SessionResponse;
    const betterAuthUserId = data.user?.id ?? null;
    const betterAuthOrgId = data.session?.activeOrganizationId;

    if (betterAuthOrgId) {
      const organizationId = await resolveBetterAuthOrgIdToInternalUuid(
        betterAuthOrgId,
        env
      );
      return { organizationId, userId: betterAuthUserId };
    }

    if (betterAuthUserId) {
      const organizationId = await resolveOrgIdFromUserService(
        betterAuthUserId,
        env
      );
      return { organizationId, userId: betterAuthUserId };
    }

    return { organizationId: null, userId: null };
  } catch {
    return { organizationId: null, userId: null };
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

  // Internal service-to-service requests are pre-authenticated by the auth
  // middleware. Trust the X-Organization-Id header they supply directly so
  // the downstream service receives the correct org context without requiring
  // a user session.
  const internalKey = context.req.header('x-internal-key');
  if (
    internalKey &&
    context.env.INTERNAL_GATEWAY_KEY &&
    internalKey === context.env.INTERNAL_GATEWAY_KEY
  ) {
    const callerOrgId = context.req.header('x-organization-id') ?? '';
    context.set('organizationId', callerOrgId);
    context.set('userId', '');
    return next();
  }

  const authServiceUrl = findAuthServiceUrl(context.env);

  const apiKey = extractApiKeyFromRequest(context.req.raw);
  if (apiKey) {
    const { organizationId, userId, revoked } = await resolveContextFromApiKey(
      apiKey,
      authServiceUrl,
      context.env
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
        authServiceUrl,
        context.env
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

    const sessionContext = await resolveOrganizationFromSession(
      sessionToken,
      authServiceUrl,
      context.env,
      context.req.header('Cookie') ?? undefined
    );
    context.set('organizationId', sessionContext.organizationId ?? '');
    context.set('userId', sessionContext.userId ?? '');
    return next();
  }

  if (!context.get('organizationId')) {
    context.set('organizationId', '');
  }
  context.set('userId', '');
  return next();
}
