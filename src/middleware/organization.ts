import type { Context, Next } from 'hono';
import type { Environment } from '../types';
import { ServicePath, SERVICES } from '../constants';

declare module 'hono' {
  interface ContextVariableMap {
    organizationId: string;
    userId: string;
  }
}

// Paths that do not require org context injection (public / pre-auth flows).
// Keep this list tight — overly broad patterns let authenticated sub-routes
// skip org resolution and downstream BOLA checks.
const AUTH_SKIP_PATTERNS = [
  /^\/$/,
  /^\/health$/,
  // Public better-auth session / OAuth flows
  /^\/api\/v\d+\/better-auth\//,
  // Public auth endpoints (sign-in, sign-up, password reset, OAuth callback, verify-email)
  /^\/api\/v\d+\/auth\/sign-in/,
  /^\/api\/v\d+\/auth\/sign-up/,
  /^\/api\/v\d+\/auth\/reset-password/,
  /^\/api\/v\d+\/auth\/verify-email/,
  /^\/api\/v\d+\/auth\/callback/,
  /^\/api\/v\d+\/auth\/oauth/,
  /^\/api\/v\d+\/auth\/get-session/,
  /^\/api\/v\d+\/auth\/jwt\//,
  // Billing webhooks from Stripe (no session context)
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

  // Fall back to better-auth session cookie (both secure and non-secure variants)
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

interface ApiKeyVerifyResponse {
  valid?: boolean;
  key?: { userId?: string; metadata?: { organizationId?: string } };
}

interface ApiKeyContext {
  organizationId: string | null;
  userId: string | null;
  /** True when the token was recognised as an API key but is revoked / invalid. */
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
    // Look up the user's internal org membership via the user service using their authId.
    // This avoids calling /auth/organization/list with an API key Bearer token,
    // which better-auth does not support (returns empty / 401).
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
    const response = await fetch(
      `${authServiceUrl}/api/v1/auth/api-key/verify`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-API-Key': env.SERVICE_API_KEY_ORG_SERVICE,
        },
        body: JSON.stringify({ key: apiKey }),
      }
    );

    // A 400 means the payload was malformed — the token is not an API key at all.
    if (response.status === 400) return { organizationId: null, userId: null };

    // A 401 means the auth service recognised it as an API key but it is
    // revoked or otherwise invalid.  Signal this so the caller can return 401.
    if (response.status === 401)
      return { organizationId: null, userId: null, revoked: true };

    if (!response.ok) return { organizationId: null, userId: null };

    const data = (await response.json()) as ApiKeyVerifyResponse;

    // Explicit valid: false in a 2xx body should also be treated as revoked.
    if (data.valid === false)
      return { organizationId: null, userId: null, revoked: true };

    const organizationId = data.key?.metadata?.organizationId ?? null;
    const userId = data.key?.userId ?? null;

    // Verify the key owner is actually a member of the claimed org.
    // This prevents metadata tampering (Bob setting organizationId=Alice's UUID).
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

const resolveOrganizationFromSession = async (
  sessionToken: string,
  authServiceUrl: string,
  env: Environment,
  cookieHeader?: string
): Promise<string | null> => {
  try {
    const headers: HeadersInit = { Authorization: `Bearer ${sessionToken}` };
    // Forward the full Cookie header so better-auth can read session_data
    // (which contains activeOrganizationId) alongside the session_token.
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }
    const response = await fetch(`${authServiceUrl}/api/v1/auth/get-session`, {
      headers,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as SessionResponse;
    const betterAuthOrgId = data.session?.activeOrganizationId;
    if (!betterAuthOrgId) return null;

    return resolveBetterAuthOrgIdToInternalUuid(betterAuthOrgId, env);
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

  // Explicit API key (X-API-Key header or ApiKey prefix)
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

  // Bearer token — API keys issued by this platform always have the 'crow_' prefix.
  // Only run API-key verification for tokens that match that shape; everything else
  // is treated as a session JWT and forwarded directly to downstream services.
  const sessionToken = extractSessionTokenFromRequest(context.req.raw);
  if (sessionToken) {
    if (sessionToken.startsWith('crow_')) {
      // Looks like an API key — verify it
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

    // Treat as a session JWT — extract org from active session
    const organizationId = await resolveOrganizationFromSession(
      sessionToken,
      authServiceUrl,
      context.env,
      context.req.header('Cookie') ?? undefined
    );
    context.set('organizationId', organizationId ?? '');
    context.set('userId', '');
    return next();
  }

  const existingBetterAuthOrgId = context.get('organizationId');
  if (existingBetterAuthOrgId) {
    const resolvedInternalOrgId = await resolveBetterAuthOrgIdToInternalUuid(
      existingBetterAuthOrgId,
      context.env
    );
    context.set('organizationId', resolvedInternalOrgId ?? '');
  }

  if (!context.get('organizationId')) {
    context.set('organizationId', '');
  }
  context.set('userId', '');
  return next();
}
