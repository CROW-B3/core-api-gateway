import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../middleware/auth', () => ({
  authenticateRequestMiddleware: vi.fn(
    async (_c: any, next: Function) => next()
  ),
}));

vi.mock('../middleware/cache', () => ({
  cacheMiddleware: vi.fn(async (_c: any, next: Function) => next()),
}));

vi.mock('../middleware/cors', () => ({
  createCorsMiddleware: vi.fn(() => async (_c: any, next: Function) => next()),
}));

vi.mock('../middleware/organization', () => ({
  injectOrganizationContext: vi.fn(
    async (_c: any, next: Function) => next()
  ),
}));

vi.mock('../middleware/rate-limit', () => ({
  authenticationRateLimitMiddleware: vi.fn(
    async (_c: any, next: Function) => next()
  ),
  standardRateLimitMiddleware: vi.fn(
    async (_c: any, next: Function) => next()
  ),
}));

vi.mock('../middleware/security-headers', () => ({
  securityHeadersMiddleware: vi.fn(
    async (_c: any, next: Function) => next()
  ),
}));

vi.mock('../routes', () => ({
  handleRequest: vi.fn(async (c: any) => {
    return c.json({ proxied: true });
  }),
}));

// Mock hono/cache since it may reference Cloudflare Cache API
vi.mock('hono/cache', () => ({
  cache: vi.fn(() => async (_c: any, next: Function) => next()),
}));

const mockEnv = {
  CACHE: {
    get: vi.fn(() => null),
    put: vi.fn(),
    delete: vi.fn(),
  },
  ENVIRONMENT: 'local',
  AUTH_SERVICE_URL: 'http://localhost:8001',
  SERVICE_API_KEY_ORG_SERVICE: 'test-org-key',
  INTERNAL_GATEWAY_KEY: 'test-key',
};

import app from '../index';

describe('core-api-gateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET / (health check)', () => {
    it('should return 200 with service info', async () => {
      const res = await app.request('/', {}, mockEnv);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.service).toBe('core-api-gateway');
    });
  });

  describe('GET /health', () => {
    it('should return 200 with healthy status', async () => {
      const res = await app.request('/health', {}, mockEnv);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('healthy');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('not found routes', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await app.request('/this-does-not-exist', {}, mockEnv);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('Not Found');
      expect(body.message).toBe('Route not found');
    });
  });

  describe('API route proxying', () => {
    it('should proxy auth routes', async () => {
      const res = await app.request(
        '/api/v1/auth/session',
        {
          headers: {
            'X-Internal-Key': 'test-key',
          },
        },
        mockEnv
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.proxied).toBe(true);
    });

    it('should proxy service routes', async () => {
      const res = await app.request(
        '/api/v1/products/list',
        {
          headers: {
            'X-Internal-Key': 'test-key',
            Authorization: 'Bearer test-token',
          },
        },
        mockEnv
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.proxied).toBe(true);
    });
  });
});
