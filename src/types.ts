export type ServiceEnvironment = 'local' | 'dev' | 'prod';

export interface ServiceConfig {
  name: string;
  path: string;
  requiresAuth?: boolean;
  urls: {
    local: string;
    dev: string;
    prod: string;
  };
}

export interface Environment {
  CACHE: KVNamespace;
  ENVIRONMENT: ServiceEnvironment;
  AUTH_SERVICE_URL: string;
  SERVICE_API_KEY_ORG_SERVICE: string;
  INTERNAL_GATEWAY_KEY?: string;
}
