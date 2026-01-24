import type { Context } from 'hono';
import type { Environment } from './types';
import { ServicePath } from './constants';
import {
  buildForwardPath,
  extractVersion,
  findServiceByPath,
  forwardRequest,
} from '../lib/router';

const KEEP_SERVICE_PATH = [
  ServicePath.AUTH,
  ServicePath.USERS,
  ServicePath.ORGANIZATIONS,
];

export async function handleRequest(c: Context<{ Bindings: Environment }>) {
  const path = c.req.path;
  const version = extractVersion(path);
  const service = findServiceByPath(path);

  if (!service || !version) {
    return c.json({ error: 'Not Found', message: 'Service not found' }, 404);
  }

  const keepServicePath = KEEP_SERVICE_PATH.includes(
    service.path as ServicePath
  );
  const forwardPath = buildForwardPath(path, keepServicePath);
  return forwardRequest(c.req.raw, service, c.env, forwardPath, version);
}
