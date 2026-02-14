import type { Environment } from '../types';
import ky from 'ky';
import { ServicePath, SERVICES } from '../constants';
import { logger } from './logger';

interface TokenResponse {
  token: string;
}

const findAuthenticationServiceUrl = (env: Environment): string | null => {
  const authService = SERVICES.find(
    service => service.path === ServicePath.AUTH
  );
  if (!authService) {
    return null;
  }
  return authService.urls[env.ENVIRONMENT];
};

export async function fetchTokenFromSession(
  env: Environment,
  cookieHeader: string
): Promise<string | null> {
  const authServiceUrl = findAuthenticationServiceUrl(env);
  if (!authServiceUrl) {
    return null;
  }

  try {
    const { token } = (await ky
      .get(`${authServiceUrl}/api/v1/auth/token`, {
        headers: { Cookie: cookieHeader },
      })
      .json()) as TokenResponse;
    return token;
  } catch {
    return null;
  }
}

export async function createAnonymousSession(
  env: Environment
): Promise<string | null> {
  const authServiceUrl = findAuthenticationServiceUrl(env);
  if (!authServiceUrl) {
    return null;
  }

  try {
    const signInResponse = await ky.post(
      `${authServiceUrl}/api/v1/auth/sign-in/anonymous`,
      { json: {} }
    );

    const sessionCookies = signInResponse.headers.get('set-cookie');
    if (!sessionCookies) {
      logger.error('No session cookie returned');
      return null;
    }

    const { token } = (await ky
      .get(`${authServiceUrl}/api/v1/auth/token`, {
        headers: { Cookie: sessionCookies },
      })
      .json()) as TokenResponse;
    return token;
  } catch (error) {
    logger.error('Anonymous session error', error);
    return null;
  }
}
