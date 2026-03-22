import type { Context } from 'hono';
import type { Environment } from './types';
import { ServicePath } from './constants';
import {
  buildForwardPath,
  extractVersion,
  findServiceByPath,
  forwardRequest,
} from './lib/router';

function extractAuthenticationToken(
  context: Context<{ Bindings: Environment }>,
  isApiKeyPassthrough: boolean
): string | undefined {
  const rawBearer = context.req.header('Authorization')?.startsWith('Bearer ')
    ? context.req.header('Authorization')!.slice(7).trim()
    : undefined;

  if (rawBearer?.startsWith('crow_') && isApiKeyPassthrough) return rawBearer;

  const originalBearer =
    rawBearer && !rawBearer.startsWith('crow_') ? rawBearer : undefined;
  return originalBearer || context.get('token');
}

export async function handleRequest(
  context: Context<{ Bindings: Environment }>
) {
  const requestPath = context.req.path;
  const version = extractVersion(requestPath);
  const service = findServiceByPath(requestPath);

  if (!service || !version) {
    return context.json(
      { error: 'Not Found', message: 'Service not found' },
      404
    );
  }

  const forwardPath = buildForwardPath(requestPath);
  const isApiKeyPassthrough = service.path === ServicePath.INGEST;
  const authenticationToken = extractAuthenticationToken(
    context,
    isApiKeyPassthrough
  );
  const organizationId = context.get('organizationId');
  const userId = context.get('userId');

  const isAuthRoute = service.path === 'auth' || service.path === 'better-auth';

  return forwardRequest(
    context.req.raw,
    service,
    context.env,
    forwardPath,
    version,
    authenticationToken,
    organizationId,
    userId,
    isAuthRoute
  );
}
