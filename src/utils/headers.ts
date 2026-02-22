export const createForwardHeaders = (
  originalHeaders: Headers,
  url: URL,
  serviceName: string
): Headers => {
  const headers = new Headers(originalHeaders);
  // Always strip the original Authorization header — the gateway will inject
  // its own token (anonymous JWT or session JWT) so the raw API key or client
  // credential never reaches downstream services.
  headers.delete('authorization');
  headers.set('X-Forwarded-Host', url.host);
  headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
  headers.set('X-Gateway-Service', serviceName);
  return headers;
};

const STRIP_RESPONSE_HEADERS = new Set([
  'access-control-allow-origin',
  'access-control-allow-credentials',
  'access-control-allow-methods',
  'access-control-allow-headers',
  'access-control-expose-headers',
  'access-control-max-age',
]);

export const createResponseHeaders = (
  responseHeaders: Headers,
  serviceName: string,
  version: string
): Headers => {
  const headers = new Headers();

  responseHeaders.forEach((value, key) => {
    if (!STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) {
      headers.append(key, value);
    }
  });

  headers.set('X-Gateway-Service', serviceName);
  headers.set('X-Gateway-Version', version);

  return headers;
};

export const convertHeadersToRecord = (
  headers: Headers
): Record<string, string> => {
  const record: Record<string, string> = {};

  headers.forEach((value, key) => {
    record[key] = value;
  });

  return record;
};
