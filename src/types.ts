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

export interface Environment {
  CACHE: KVNamespace;
  ENVIRONMENT: ServiceEnvironment;
}
