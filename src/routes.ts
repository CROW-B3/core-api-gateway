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
  // Prefer the original Bearer JWT from the incoming request over the anonymous
  // session token set by the auth middleware, so JWTs are forwarded as-is.
  const originalBearer = context.req
    .header('Authorization')
    ?.startsWith('Bearer ')
    ? context.req.header('Authorization')!.slice(7).trim()
    : undefined;
  const authenticationToken = originalBearer || context.get('token');
  const organizationId = context.get('organizationId');
  const userId = context.get('userId');

  return forwardRequest(
    context.req.raw,
    service,
    context.env,
    forwardPath,
    version,
    authenticationToken,
    organizationId,
    userId
  );
}
