export const createForwardHeaders = (
  originalHeaders: Headers,
  url: URL,
  serviceName: string
): Headers => {
  const headers = new Headers(originalHeaders);
  headers.set('X-Forwarded-Host', url.host);
  headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
  headers.set('X-Gateway-Service', serviceName);
  return headers;
};

export const createResponseHeaders = (
  responseHeaders: Headers,
  serviceName: string,
  version: string
): Headers => {
  const headers = new Headers();

  responseHeaders.forEach((value, key) => {
    headers.append(key, value);
  });

  headers.set('X-Gateway-Service', serviceName);
  headers.set('X-Gateway-Version', version);

  return headers;
};

export const convertHeadersToRecord = (headers: Headers): Record<string, string> => {
  const record: Record<string, string> = {};

  headers.forEach((value, key) => {
    record[key] = value;
  });

  return record;
};
