import type { Environment } from '../types';
import ky from 'ky';
import { ServicePath, SERVICES } from '../constants';
import { logger } from './logger';

interface TokenResponse {
  token: string;
}

export async function createAnonymousSession(
  env: Environment
): Promise<string | null> {
  const authService = SERVICES.find(s => s.path === ServicePath.AUTH);
  if (!authService) return null;

  const authUrl = authService.urls[env.ENVIRONMENT];

  try {
    const signInResponse = await ky.post(
      `${authUrl}/api/v1/auth/sign-in/anonymous`,
      { json: {} }
    );

    const cookies = signInResponse.headers.get('set-cookie');
    if (!cookies) {
      logger.error('No session cookie returned');
      return null;
    }

    const { token } = (await ky
      .get(`${authUrl}/api/v1/auth/token`, {
        headers: { Cookie: cookies },
      })
      .json()) as TokenResponse;
    return token;
  } catch (error) {
    logger.error('Anonymous session error', error);
    return null;
  }
}
