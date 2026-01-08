import type { Environment } from '../types';

interface CachedResponse {
  body: string;
  status: number;
  headers: Record<string, string>;
  cachedAt: number;
}

const DEFAULT_TTL = 300;

export function getCacheKey(
  request: Request,
  service: string,
  version: string
): string {
  const url = new URL(request.url);
  return `cache:${service}:${version}:${url.pathname}${url.search}`;
}

export async function getCachedResponse(
  env: Environment,
  cacheKey: string
): Promise<Response | null> {
  try {
    const cached = (await env.CACHE.get(
      cacheKey,
      'json'
    )) as CachedResponse | null;
    if (!cached) return null;

    const headers = new Headers(cached.headers);
    headers.set('X-Cache', 'HIT');
    headers.set(
      'X-Cache-Age',
      String(Math.floor((Date.now() - cached.cachedAt) / 1000))
    );

    return new Response(cached.body, {
      status: cached.status,
      headers,
    });
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

export async function setCachedResponse(
  env: Environment,
  cacheKey: string,
  response: Response,
  ttl: number = DEFAULT_TTL
): Promise<Response> {
  try {
    const body = await response.text();
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const cached: CachedResponse = {
      body,
      status: response.status,
      headers,
      cachedAt: Date.now(),
    };

    await env.CACHE.put(cacheKey, JSON.stringify(cached), {
      expirationTtl: ttl,
    });

    const responseHeaders = new Headers(headers);
    responseHeaders.set('X-Cache', 'MISS');

    return new Response(body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Cache write error:', error);
    return response;
  }
}

export function shouldCache(request: Request, response: Response): boolean {
  if (request.method !== 'GET') return false;
  if (response.status < 200 || response.status >= 300) return false;

  const cacheControl = response.headers.get('Cache-Control');
  if (cacheControl?.includes('no-store') || cacheControl?.includes('private')) {
    return false;
  }

  return true;
}

export async function invalidateCache(
  env: Environment,
  pattern: string
): Promise<void> {
  const list = await env.CACHE.list({ prefix: pattern });
  await Promise.all(list.keys.map(key => env.CACHE.delete(key.name)));
}
