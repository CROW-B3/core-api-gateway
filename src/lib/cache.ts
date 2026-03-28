import type { Environment } from '../types';
import { convertHeadersToRecord } from '../utils/headers';
import { logger } from './logger';

interface CachedResponseData {
  body: string;
  status: number;
  headers: Record<string, string>;
  cachedAt: number;
}

const DEFAULT_CACHE_TIME_TO_LIVE = 300;

export const buildCacheKey = (
  request: Request,
  service: string,
  version: string,
  organizationId?: string
): string => {
  const url = new URL(request.url);
  const orgSegment = organizationId ? `:${organizationId}` : '';
  return `cache:${service}:${version}:${url.pathname}${url.search}${orgSegment}`;
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
  responseHeaders.set('Cache-Control', 'public, max-age=300, s-maxage=600');
  return responseHeaders;
};

export const fetchCachedResponse = async (
  env: Environment,
  cacheKey: string
): Promise<Response | null> => {
  try {
    const cached = (await env.CACHE.get(
      cacheKey,
      'json'
    )) as CachedResponseData | null;

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

const buildResponseWithCacheMissHeader = (
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

export const storeCachedResponse = async (
  env: Environment,
  cacheKey: string,
  response: Response,
  timeToLive: number = DEFAULT_CACHE_TIME_TO_LIVE
): Promise<Response> => {
  try {
    const body = await response.text();
    const headers = convertHeadersToRecord(response.headers);

    const cachedData: CachedResponseData = {
      body,
      status: response.status,
      headers,
      cachedAt: Date.now(),
    };

    await env.CACHE.put(cacheKey, JSON.stringify(cachedData), {
      expirationTtl: timeToLive,
    });

    return buildResponseWithCacheMissHeader(body, response.status, headers);
  } catch (error) {
    logger.error('Cache write error', error);
    return response;
  }
};

const hasNoStoreCacheControlDirective = (
  cacheControl: string | null
): boolean => {
  if (!cacheControl) {
    return false;
  }
  return cacheControl.includes('no-store') || cacheControl.includes('private');
};

const isSuccessfulHttpStatus = (status: number): boolean =>
  status >= 200 && status < 300;

export const shouldCacheResponse = (
  request: Request,
  response: Response
): boolean => {
  if (request.method !== 'GET') {
    return false;
  }

  if (!isSuccessfulHttpStatus(response.status)) {
    return false;
  }

  const cacheControl = response.headers.get('Cache-Control');

  if (hasNoStoreCacheControlDirective(cacheControl)) {
    return false;
  }

  return true;
};
