import type { Environment, ServiceConfig, ServiceEnvironment } from '../types';
import {
  buildRegExp,
  capture,
  digit,
  oneOrMore,
  startOfString,
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

export const resolveServiceUrl = (
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
  return SERVICES.find(service => service.path === servicePath) || null;
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

const createServiceUnavailableResponse = (serviceName: string): Response =>
  new Response(
    JSON.stringify({
      error: 'Service Unavailable',
      message: `${serviceName} is not responding`,
    }),
    { status: 503, headers: { 'Content-Type': 'application/json' } }
  );

const isRequestMethodWithBody = (method: string): boolean =>
  method !== 'GET' && method !== 'HEAD';

export const forwardRequest = async (
  request: Request,
  service: ServiceConfig,
  env: Environment,
  forwardPath: string,
  version: string,
  authenticationToken?: string
): Promise<Response> => {
  const serviceUrl = resolveServiceUrl(service, env);
  const requestUrl = new URL(request.url);
  const targetUrl = buildTargetUrl(
    serviceUrl,
    version,
    forwardPath,
    requestUrl.search
  );
  const headers = createForwardHeaders(
    request.headers,
    requestUrl,
    service.name
  );

  if (authenticationToken) {
    headers.set('Authorization', `Bearer ${authenticationToken}`);
  }

  try {
    const response = await fetch(targetUrl.toString(), {
      method: request.method,
      headers,
      body: isRequestMethodWithBody(request.method) ? request.body : undefined,
      redirect: 'manual',
    });

    const responseHeaders = createResponseHeaders(
      response.headers,
      service.name,
      version
    );

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    logger.error(`Forward error to ${service.name}`, error);
    return createServiceUnavailableResponse(service.name);
  }
};
