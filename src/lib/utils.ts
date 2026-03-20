import type { Context } from 'hono';

export function extractClientIpAddress(context: Context): string {
  return context.req.header('cf-connecting-ip') ?? '';
}

export function extractClientIpAddressFromRequest(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? '';
}
