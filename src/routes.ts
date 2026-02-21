import type { Context } from 'hono';
import type { Environment } from './types';
import {
  buildForwardPath,
  extractVersion,
  findServiceByPath,
  forwardRequest,
} from './lib/router';

export async function handleRequest(c: Context<{ Bindings: Environment }>) {
  const path = c.req.path;
  const version = extractVersion(path);
  const service = findServiceByPath(path);

  if (!service || !version) {
    return c.json({ error: 'Not Found', message: 'Service not found' }, 404);
  }

  const forwardPath = buildForwardPath(requestPath);
  const authenticationToken = context.get('token');
  const organizationId = context.get('organizationId');

  return forwardRequest(
    context.req.raw,
    service,
    context.env,
    forwardPath,
    version,
    authenticationToken,
    organizationId
  );
}
