import type { Environment, ServiceConfig, ServiceEnvironment } from '../types';
import ky from 'ky';
import {
  anyChar,
  buildRegExp,
  capture,
  digit,
  notChar,
  oneOrMore,
  startOfString,
  zeroOrMore,
} from 'ts-regex-builder';
import { SERVICES } from '../types';
import { logger } from './logger';

const SERVICE_PATH_REGEX = buildRegExp([
  startOfString,
  '/api/v',
  oneOrMore(digit),
  '/',
  capture(oneOrMore(notChar('/'))),
]);

const VERSION_REGEX = buildRegExp([
  startOfString,
  '/api/',
  capture('v', oneOrMore(digit)),
  '/',
]);

const FORWARD_PATH_REGEX = buildRegExp([
  startOfString,
  '/api/v',
  oneOrMore(digit),
  '/',
  oneOrMore(notChar('/')),
  capture(zeroOrMore(anyChar)),
]);

export function getServiceUrl(
  service: ServiceConfig,
  env: Environment
): string {
  return service.urls[env.ENVIRONMENT as ServiceEnvironment];
}

export function findServiceByPath(path: string): ServiceConfig | null {
  const match = path.match(SERVICE_PATH_REGEX);
  if (!match) return null;

  const servicePath = match[1];
  return SERVICES.find(s => s.path === servicePath) || null;
}

export function extractVersion(path: string): string | null {
  const match = path.match(VERSION_REGEX);
  return match ? match[1] : null;
}

export function buildForwardPath(path: string): string {
  const match = path.match(FORWARD_PATH_REGEX);
  return match ? match[1] || '/' : '/';
}

export async function forwardRequest(
  request: Request,
  service: ServiceConfig,
  env: Environment,
  forwardPath: string,
  version: string
): Promise<Response> {
  const serviceUrl = getServiceUrl(service, env);
  const targetUrl = new URL(`/api/${version}${forwardPath}`, serviceUrl);

  const url = new URL(request.url);
  targetUrl.search = url.search;

  const headers = new Headers(request.headers);
  headers.set('X-Forwarded-Host', url.host);
  headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
  headers.set('X-Gateway-Service', service.name);

  const forwardedRequest = new Request(targetUrl.toString(), {
    method: request.method,
    headers,
    body: request.body,
    redirect: 'manual',
  });

  try {
    const response = await ky(targetUrl.toString(), {
      method: forwardedRequest.method,
      headers: forwardedRequest.headers,
      body: forwardedRequest.body,
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('X-Gateway-Service', service.name);
    responseHeaders.set('X-Gateway-Version', version);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    logger.error(`Forward error to ${service.name}`, error);
    return new Response(
      JSON.stringify({
        error: 'Service Unavailable',
        message: `${service.name} is not responding`,
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
