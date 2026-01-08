import type { Environment } from '../types';

interface TokenResponse {
  token: string;
}

export async function createAnonymousSession(
  env: Environment
): Promise<string | null> {
  try {
    const signInResponse = await fetch(
      `${env.AUTH_SERVICE_URL}/api/auth/sign-in/anonymous`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!signInResponse.ok) {
      console.error('Anonymous sign-in failed:', signInResponse.status);
      return null;
    }

    const cookies = signInResponse.headers.get('set-cookie');
    if (!cookies) {
      console.error('No session cookie returned');
      return null;
    }

    const tokenResponse = await fetch(
      `${env.AUTH_SERVICE_URL}/api/auth/token`,
      {
        method: 'GET',
        headers: { Cookie: cookies },
      }
    );

    if (!tokenResponse.ok) {
      console.error('Token fetch failed:', tokenResponse.status);
      return null;
    }

    const tokenData = (await tokenResponse.json()) as TokenResponse;
    return tokenData.token;
  } catch (error) {
    console.error('Anonymous session creation error:', error);
    return null;
  }
}

export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

export function extractSessionCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map(c => c.trim());
  const sessionCookie = cookies.find(c =>
    c.startsWith('better-auth.session_token=')
  );
  return sessionCookie ? sessionCookie.split('=')[1] : null;
}

export async function getTokenFromSession(
  env: Environment,
  sessionCookie: string
): Promise<string | null> {
  try {
    const response = await fetch(`${env.AUTH_SERVICE_URL}/api/auth/token`, {
      method: 'GET',
      headers: { Cookie: `better-auth.session_token=${sessionCookie}` },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as TokenResponse;
    return data.token;
  } catch (error) {
    console.error('Session token fetch error:', error);
    return null;
  }
}
