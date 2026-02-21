import type { Environment } from '../types';
import ky from 'ky';
import { SERVICES } from '../constants';
import { logger } from './logger';

interface TokenResponse {
  token: string;
}

interface SessionResponse {
  session: {
    activeOrganizationId?: string;
  } | null;
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

export async function fetchOrganizationIdFromSession(
  env: Environment,
  cookieHeader: string
): Promise<string | null> {
  const authServiceUrl = findAuthenticationServiceUrl(env);
  if (!authServiceUrl) {
    return null;
  }

  try {
    const response = (await ky
      .get(`${authServiceUrl}/api/v1/auth/get-session`, {
        headers: { Cookie: cookieHeader },
      })
      .json()) as SessionResponse;
    return response.session?.activeOrganizationId ?? null;
  } catch {
    return null;
  }
}

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
