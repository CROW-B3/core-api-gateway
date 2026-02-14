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
  const authenticationToken = context.get('token');

  return forwardRequest(
    context.req.raw,
    service,
    context.env,
    forwardPath,
    version,
    authenticationToken
  );
}
