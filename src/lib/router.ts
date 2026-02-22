import type { Environment, ServiceConfig, ServiceEnvironment } from '../types';
import ky from 'ky';
import {
  any,
  buildRegExp,
  capture,
  digit,
  oneOrMore,
  startOfString,
  zeroOrMore,
} from 'ts-regex-builder';
import { SERVICES } from '../constants';
import { createForwardHeaders, createResponseHeaders } from '../utils/headers';
import { logger } from './logger';

const SERVICE_PATH_REGEX = buildRegExp([
  startOfString,
  '/api/v',
  oneOrMore(digit),
  '/',
  capture(oneOrMore(/[^/]/)),
]);

const VERSION_REGEX = buildRegExp([
  startOfString,
  '/api/',
  capture(['v', oneOrMore(digit)]),
  '/',
]);

const FORWARD_PATH_REGEX = buildRegExp([
  startOfString,
  '/api/v',
  oneOrMore(digit),
  '/',
  oneOrMore(/[^/]/),
  capture(zeroOrMore(any)),
]);

export const getServiceUrl = (
  service: ServiceConfig,
  env: Environment
): string => {
  return service.urls[env.ENVIRONMENT as ServiceEnvironment];
};

export const findServiceByPath = (path: string): ServiceConfig | null => {
  const match = path.match(SERVICE_PATH_REGEX);

  if (!match) {
    return null;
  }

  const servicePath = match[1];
  return SERVICES.find(s => s.path === servicePath) || null;
};

export const extractVersion = (path: string): string | null => {
  const match = path.match(VERSION_REGEX);
  return match ? match[1] : null;
};

export const buildForwardPath = (path: string): string => {
  const match = path.match(/^\/api\/v\d+(\/.*)$/);
  return match ? match[1] : '/';
};

const buildTargetUrl = (
  serviceUrl: string,
  version: string,
  forwardPath: string,
  searchParams: string
): URL => {
  const targetUrl = new URL(`/api/${version}${forwardPath}`, serviceUrl);
  targetUrl.search = searchParams;
  return targetUrl;
};

const createServiceUnavailableResponse = (serviceName: string): Response => {
  return new Response(
    JSON.stringify({
      error: 'Service Unavailable',
      message: `${serviceName} is not responding`,
    }),
    { status: 503, headers: { 'Content-Type': 'application/json' } }
  );
};

export const forwardRequest = async (
  request: Request,
  service: ServiceConfig,
  env: Environment,
  forwardPath: string,
  version: string,
  authenticationToken?: string,
  organizationId?: string | null,
  userId?: string | null
): Promise<Response> => {
  const serviceUrl = getServiceUrl(service, env);
  const url = new URL(request.url);
  const targetUrl = buildTargetUrl(serviceUrl, version, forwardPath, url.search);
  const headers = createForwardHeaders(request.headers, url, service.name);

  if (organizationId) {
    headers.set('X-Organization-Id', organizationId);
  }

  if (userId) {
    headers.set('X-User-Id', userId);
  }

  try {
    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
      redirect: 'manual',
    };

    if (isRequestMethodWithBody(request.method)) {
      fetchOptions.body = request.body;
      (fetchOptions as RequestInit & { duplex: string }).duplex = 'half';
    }

    const response = await fetch(targetUrl.toString(), fetchOptions);

    const responseHeaders = createResponseHeaders(
      response.headers,
      service.name,
      version
    );

    // Buffer the response body so it is a string rather than a ReadableStream.
    // This prevents "ReadableStream is disturbed" errors when the cache
    // middleware later tries to clone the response after Hono has already
    // started piping the stream to the client.
    const responseBody = await response.text();

    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    logger.error(`Forward error to ${service.name}`, error);
    return createServiceUnavailableResponse(service.name);
  }
};
