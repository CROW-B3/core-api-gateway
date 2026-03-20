import type { Context, Next } from 'hono';

export async function securityHeadersMiddleware(c: Context, next: Next) {
  await next();

  c.header(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header(
    'Permissions-Policy',
    'geolocation=(), camera=(), microphone=(), payment=()'
  );
  c.header(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'"
  );
}
