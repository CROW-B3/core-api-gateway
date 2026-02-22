import type { Context } from 'hono';
import type { Environment } from './types';
import {
  buildForwardPath,
  extractVersion,
  findServiceByPath,
  forwardRequest,
} from './lib/router';

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
  const originalBearer = context.req
    .header('Authorization')
    ?.startsWith('Bearer ')
    ? context.req.header('Authorization')!.slice(7).trim()
    : undefined;
  // Do not forward API keys (crow_* prefix) as Bearer tokens to downstream
  // services — they are not JWTs and will be rejected by service JWT middleware.
  // Downstream services receive the resolved org/user context via X-* headers.
  const originalBearer =
    rawBearer && !rawBearer.startsWith('crow_') ? rawBearer : undefined;
  const authenticationToken = originalBearer || context.get('token');
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
