import type { Context, Next } from 'hono';
import type { Environment } from '../types';

declare module 'hono' {
  interface ContextVariableMap {
    organizationId: string;
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
  key?: { metadata?: { organizationId?: string } };
}

const resolveOrganizationFromSession = async (
  sessionToken: string,
  authServiceUrl: string
): Promise<string | null> => {
  try {
    const response = await fetch(`${authServiceUrl}/api/auth/session`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as SessionResponse;
    return data.session?.activeOrganizationId ?? null;
  } catch {
    return null;
  }
};

const resolveOrganizationFromApiKey = async (
  apiKey: string,
  authServiceUrl: string
): Promise<string | null> => {
  try {
    const response = await fetch(
      `${authServiceUrl}/api/v1/auth/api-key/verify`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: apiKey }),
      }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as ApiKeyVerifyResponse;
    return data.key?.metadata?.organizationId ?? null;
  } catch {
    return null;
  }
};

const resolveOrganizationId = async (
  request: Request,
  authServiceUrl: string
): Promise<string | null> => {
  const apiKey = extractApiKeyFromRequest(request);
  if (apiKey) return resolveOrganizationFromApiKey(apiKey, authServiceUrl);

  const sessionToken = extractSessionTokenFromRequest(request);
  if (sessionToken)
    return resolveOrganizationFromSession(sessionToken, authServiceUrl);

  return null;
};

export async function injectOrganizationContext(
  context: Context<{ Bindings: Environment }>,
  next: Next
) {
  const requestPath = context.req.path;

  if (matchesSkipPattern(requestPath)) {
    context.set('organizationId', '');
    return next();
  }

  const authServiceUrl =
    context.env.AUTH_SERVICE_URL ?? 'https://dev.auth.crowai.dev';

  const organizationId = await resolveOrganizationId(
    context.req.raw,
    authServiceUrl
  );

  context.set('organizationId', organizationId ?? '');
  return next();
}
