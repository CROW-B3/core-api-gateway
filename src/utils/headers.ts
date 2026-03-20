export const createForwardHeaders = (
  originalHeaders: Headers,
  url: URL,
  serviceName: string,
  method?: string
): Headers => {
  const headers = new Headers(originalHeaders);
  headers.delete('authorization');
  headers.delete('x-internal-key');
  headers.delete('x-gateway-internal-key');
  headers.set('X-Forwarded-Host', url.host);
  headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
  headers.set('X-Gateway-Service', serviceName);
  if (
    method &&
    ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) &&
    !headers.get('content-type')
  ) {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
};

const STRIP_RESPONSE_HEADERS = new Set([
  'access-control-allow-origin',
  'access-control-allow-credentials',
  'access-control-allow-methods',
  'access-control-allow-headers',
  'access-control-expose-headers',
  'access-control-max-age',
  'set-cookie',
  'server',
  'x-powered-by',
  'x-internal-key',
  'x-gateway-internal-key',
  'x-service-api-key',
]);

export const createResponseHeaders = (
  responseHeaders: Headers,
  serviceName: string,
  version: string,
  preserveSetCookie = false
): Headers => {
  const headers = new Headers();

  responseHeaders.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === 'set-cookie' && preserveSetCookie) {
      headers.append(key, value);
      return;
    }
    if (!STRIP_RESPONSE_HEADERS.has(lower)) {
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
