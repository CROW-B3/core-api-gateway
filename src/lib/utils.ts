import type { Context } from 'hono';

export function extractClientIpAddress(context: Context): string {
  return (
    context.req.header('cf-connecting-ip') ??
    context.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    context.req.header('x-real-ip') ??
    ''
  );
}

export function extractClientIpAddressFromRequest(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    ''
  );
}
