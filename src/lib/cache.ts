import type { Environment } from '../types';
import { convertHeadersToRecord } from '../utils/headers';
import { logger } from './logger';

interface CachedResponse {
  body: string;
  status: number;
  headers: Record<string, string>;
  cachedAt: number;
}

const DEFAULT_TTL = 300;

export const getCacheKey = (
  request: Request,
  service: string,
  version: string
): string => {
  const url = new URL(request.url);
  return `cache:${service}:${version}:${url.pathname}${url.search}`;
};

const buildCachedResponseHeaders = (
  headers: Record<string, string>,
  cachedAt: number
): Headers => {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('X-Cache', 'HIT');
  responseHeaders.set(
    'X-Cache-Age',
    String(Math.floor((Date.now() - cachedAt) / 1000))
  );
  return responseHeaders;
};

export const getCachedResponse = async (
  env: Environment,
  cacheKey: string
): Promise<Response | null> => {
  try {
    const cached = (await env.CACHE.get(
      cacheKey,
      'json'
    )) as CachedResponse | null;

    if (!cached) {
      return null;
    }

    const headers = buildCachedResponseHeaders(cached.headers, cached.cachedAt);

    return new Response(cached.body, {
      status: cached.status,
      headers,
    });
  } catch (error) {
    logger.error('Cache read error', error);
    return null;
  }
};

const buildResponseForCache = (
  body: string,
  status: number,
  headers: Record<string, string>
): Response => {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('X-Cache', 'MISS');

  return new Response(body, {
    status,
    headers: responseHeaders,
  });
};

export const setCachedResponse = async (
  env: Environment,
  cacheKey: string,
  response: Response,
  ttl: number = DEFAULT_TTL
): Promise<Response> => {
  try {
    const body = await response.text();
    const headers = convertHeadersToRecord(response.headers);

    const cached: CachedResponse = {
      body,
      status: response.status,
      headers,
      cachedAt: Date.now(),
    };

    await env.CACHE.put(cacheKey, JSON.stringify(cached), {
      expirationTtl: ttl,
    });

    return buildResponseForCache(body, response.status, headers);
  } catch (error) {
    logger.error('Cache write error', error);
    return response;
  }
};

const hasNoStoreCacheControl = (cacheControl: string | null): boolean => {
  if (!cacheControl) {
    return false;
  }

  return cacheControl.includes('no-store') || cacheControl.includes('private');
};

const isSuccessfulResponse = (status: number): boolean => {
  return status >= 200 && status < 300;
};

export const shouldCache = (request: Request, response: Response): boolean => {
  if (request.method !== 'GET') {
    return false;
  }

  if (!isSuccessfulResponse(response.status)) {
    return false;
  }

  const cacheControl = response.headers.get('Cache-Control');

  if (hasNoStoreCacheControl(cacheControl)) {
    return false;
  }

  return true;
};
