import type { Context, Next } from 'hono';

/**
 * Adds security response headers to every outbound response.
 * Applied at the gateway level so all downstream services inherit them.
 */
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
  // Minimal CSP for an API — no browser-rendered content
  c.header(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'"
  );
}
