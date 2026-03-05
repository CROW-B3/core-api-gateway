import type { Context } from 'hono';

export function extractClientIpAddress(context: Context): string {
  // Only trust cf-connecting-ip — it is set by Cloudflare's edge and cannot
  // be spoofed by the client. x-forwarded-for and x-real-ip are attacker-controlled.
  return context.req.header('cf-connecting-ip') ?? '';
}

export function extractClientIpAddressFromRequest(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? '';
}
