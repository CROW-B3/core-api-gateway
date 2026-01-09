import type { Environment } from '../types';
import { SERVICES } from '../types';
import { logger } from './logger';

interface TokenResponse {
  token: string;
}

export async function createAnonymousSession(
  env: Environment
): Promise<string | null> {
  const authService = SERVICES.find(s => s.path === 'auth');
  if (!authService) return null;

  const authUrl = authService.urls[env.ENVIRONMENT];

  try {
    const signInResponse = await fetch(
      `${authUrl}/api/auth/sign-in/anonymous`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    );

    if (!signInResponse.ok) {
      logger.error('Anonymous sign-in failed', {
        status: signInResponse.status,
      });
      return null;
    }

    const cookies = signInResponse.headers.get('set-cookie');
    if (!cookies) {
      logger.error('No session cookie returned');
      return null;
    }

    const tokenResponse = await fetch(`${authUrl}/api/auth/token`, {
      method: 'GET',
      headers: { Cookie: cookies },
    });

    if (!tokenResponse.ok) {
      logger.error('Token fetch failed', { status: tokenResponse.status });
      return null;
    }

    const { token } = (await tokenResponse.json()) as TokenResponse;
    return token;
  } catch (error) {
    logger.error('Anonymous session error', error);
    return null;
  }
}
