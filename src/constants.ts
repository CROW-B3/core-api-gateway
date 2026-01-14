import type { ServiceConfig } from './types';

export enum ServicePath {
  AUTH = 'auth',
  USERS = 'users',
  PRODUCTS = 'products',
  ORGANIZATIONS = 'organizations',
  ANALYTICS = 'analytics',
  NOTIFICATIONS = 'notifications',
  PATTERNS = 'patterns',
  INTERACTIONS = 'interactions',
  CHAT = 'chat',
  QNA = 'qna',
  MCP = 'mcp',
  BILLING = 'billing',
}

export enum ServiceName {
  AUTH = 'core-auth-service',
  USERS = 'core-user-service',
  PRODUCTS = 'core-product-service',
  ORGANIZATIONS = 'core-organization-service',
  ANALYTICS = 'core-analytics-service',
  NOTIFICATIONS = 'core-notification-service',
  PATTERNS = 'core-pattern-service',
  INTERACTIONS = 'core-interaction-service',
  CHAT = 'bff-chat-service',
  QNA = 'bff-qna-service',
  MCP = 'mcp-service',
  BILLING = 'core-billing-service',
}

export const PROD_ORIGINS = [
  'https://crowai.dev',
  'https://app.crowai.dev',
  'https://api.crowai.dev',
  'https://dev.crowai.dev',
  'https://dev.app.crowai.dev',
  'https://dev.api.crowai.dev',
];

export const LOCAL_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:8000',
];

export const SERVICES: ServiceConfig[] = [
  {
    name: ServiceName.AUTH,
    path: ServicePath.AUTH,
    urls: {
      local: 'http://localhost:8001',
      dev: 'https://dev.internal.auth-api.crowai.dev',
      prod: 'https://internal.auth-api.crowai.dev',
    },
  },
  {
    name: ServiceName.USERS,
    path: ServicePath.USERS,
    urls: {
      local: 'http://localhost:8002',
      dev: 'https://dev.internal.users.crowai.dev',
      prod: 'https://internal.users.crowai.dev',
    },
  },
  {
    name: ServiceName.PRODUCTS,
    path: ServicePath.PRODUCTS,
    urls: {
      local: 'http://localhost:8003',
      dev: 'https://dev.internal.products.crowai.dev',
      prod: 'https://internal.products.crowai.dev',
    },
  },
  {
    name: ServiceName.ORGANIZATIONS,
    path: ServicePath.ORGANIZATIONS,
    urls: {
      local: 'http://localhost:8004',
      dev: 'https://dev.internal.organizations.crowai.dev',
      prod: 'https://internal.organizations.crowai.dev',
    },
  },
  {
    name: ServiceName.ANALYTICS,
    path: ServicePath.ANALYTICS,
    urls: {
      local: 'http://localhost:8005',
      dev: 'https://dev.internal.analytics.crowai.dev',
      prod: 'https://internal.analytics.crowai.dev',
    },
  },
  {
    name: ServiceName.NOTIFICATIONS,
    path: ServicePath.NOTIFICATIONS,
    urls: {
      local: 'http://localhost:8006',
      dev: 'https://dev.internal.notifications.crowai.dev',
      prod: 'https://internal.notifications.crowai.dev',
    },
  },
  {
    name: ServiceName.PATTERNS,
    path: ServicePath.PATTERNS,
    urls: {
      local: 'http://localhost:8007',
      dev: 'https://dev.internal.patterns.crowai.dev',
      prod: 'https://internal.patterns.crowai.dev',
    },
  },
  {
    name: ServiceName.INTERACTIONS,
    path: ServicePath.INTERACTIONS,
    urls: {
      local: 'http://localhost:8008',
      dev: 'https://dev.internal.interactions.crowai.dev',
      prod: 'https://internal.interactions.crowai.dev',
    },
  },
  {
    name: ServiceName.CHAT,
    path: ServicePath.CHAT,
    urls: {
      local: 'http://localhost:8009',
      dev: 'https://dev.internal.chat.crowai.dev',
      prod: 'https://internal.chat.crowai.dev',
    },
  },
  {
    name: ServiceName.QNA,
    path: ServicePath.QNA,
    urls: {
      local: 'http://localhost:8010',
      dev: 'https://dev.internal.qna.crowai.dev',
      prod: 'https://internal.qna.crowai.dev',
    },
  },
  {
    name: ServiceName.MCP,
    path: ServicePath.MCP,
    urls: {
      local: 'http://localhost:8011',
      dev: 'https://dev.internal.mcp.crowai.dev',
      prod: 'https://internal.mcp.crowai.dev',
    },
  },
  {
    name: ServiceName.BILLING,
    path: ServicePath.BILLING,
    urls: {
      local: 'http://localhost:8012',
      dev: 'https://dev.internal.billing.crowai.dev',
      prod: 'https://internal.billing.crowai.dev',
    },
  },
];
