import { z } from '@hono/zod-openapi';

export type ServiceEnvironment = 'local' | 'dev' | 'prod';

export interface ServiceConfig {
  name: string;
  path: string;
  urls: {
    local: string;
    dev: string;
    prod: string;
  };
}

export const SERVICES: ServiceConfig[] = [
  {
    name: 'core-auth-service',
    path: 'auth',
    urls: {
      local: 'http://localhost:8001',
      dev: 'https://dev.internal.auth-api.crowai.dev',
      prod: 'https://internal.auth-api.crowai.dev',
    },
  },
  {
    name: 'core-user-service',
    path: 'users',
    urls: {
      local: 'http://localhost:8002',
      dev: 'https://dev.internal.users.crowai.dev',
      prod: 'https://internal.users.crowai.dev',
    },
  },
  {
    name: 'core-product-service',
    path: 'products',
    urls: {
      local: 'http://localhost:8003',
      dev: 'https://dev.internal.products.crowai.dev',
      prod: 'https://internal.products.crowai.dev',
    },
  },
  {
    name: 'core-organization-service',
    path: 'organizations',
    urls: {
      local: 'http://localhost:8004',
      dev: 'https://dev.internal.organizations.crowai.dev',
      prod: 'https://internal.organizations.crowai.dev',
    },
  },
  {
    name: 'core-analytics-service',
    path: 'analytics',
    urls: {
      local: 'http://localhost:8005',
      dev: 'https://dev.internal.analytics.crowai.dev',
      prod: 'https://internal.analytics.crowai.dev',
    },
  },
  {
    name: 'core-notification-service',
    path: 'notifications',
    urls: {
      local: 'http://localhost:8006',
      dev: 'https://dev.internal.notifications.crowai.dev',
      prod: 'https://internal.notifications.crowai.dev',
    },
  },
  {
    name: 'core-pattern-service',
    path: 'patterns',
    urls: {
      local: 'http://localhost:8007',
      dev: 'https://dev.internal.patterns.crowai.dev',
      prod: 'https://internal.patterns.crowai.dev',
    },
  },
  {
    name: 'core-interaction-service',
    path: 'interactions',
    urls: {
      local: 'http://localhost:8008',
      dev: 'https://dev.internal.interactions.crowai.dev',
      prod: 'https://internal.interactions.crowai.dev',
    },
  },
  {
    name: 'bff-chat-service',
    path: 'chat',
    urls: {
      local: 'http://localhost:8009',
      dev: 'https://dev.internal.chat.crowai.dev',
      prod: 'https://internal.chat.crowai.dev',
    },
  },
  {
    name: 'bff-qna-service',
    path: 'qna',
    urls: {
      local: 'http://localhost:8010',
      dev: 'https://dev.internal.qna.crowai.dev',
      prod: 'https://internal.qna.crowai.dev',
    },
  },
  {
    name: 'mcp-service',
    path: 'mcp',
    urls: {
      local: 'http://localhost:8011',
      dev: 'https://dev.internal.mcp.crowai.dev',
      prod: 'https://internal.mcp.crowai.dev',
    },
  },
];

export interface Environment {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  CACHE: KVNamespace;
  ENVIRONMENT: ServiceEnvironment;
  AUTH_SERVICE_URL: string;
}

export const HelloWorldSchema = z
  .object({
    text: z.string(),
  })
  .openapi('HelloWorld');

export const ErrorSchema = z
  .object({
    error: z.string(),
    message: z.string(),
  })
  .openapi('Error');

export const StatusSchema = z
  .object({
    status: z.string(),
    service: z.string(),
  })
  .openapi('Status');
