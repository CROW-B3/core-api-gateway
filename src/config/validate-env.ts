import type { Environment } from '../types';

/**
 * Required environment variables for API gateway
 */
const REQUIRED_ENV_VARS = [
  'AUTH_SERVICE_URL',
  'USER_SERVICE_URL',
  'ORGANIZATION_SERVICE_URL',
  'BILLING_SERVICE_URL',
  'NOTIFICATION_SERVICE_URL',
  'PRODUCT_SERVICE_URL',
] as const;

type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number];

/**
 * Validates that all required environment variables are present
 * @throws Error if any required variables are missing
 */
export function validateEnv(env: Partial<Environment>): void {
  const missing: string[] = [];
  const empty: string[] = [];

  for (const key of REQUIRED_ENV_VARS) {
    const value = env[key as keyof Environment];

    if (value === undefined || value === null) {
      missing.push(key);
    } else if (typeof value === 'string' && value.trim() === '') {
      empty.push(key);
    }
  }

  const errors: string[] = [];

  if (missing.length > 0) {
    errors.push(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (empty.length > 0) {
    errors.push(`Empty environment variables: ${empty.join(', ')}`);
  }

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors.join('\n')}\n\n` +
        'Please ensure all required environment variables are set in your .env file or deployment configuration.'
    );
  }
}

/**
 * Get environment-specific configuration
 */
export function getEnvironment(env: Environment): 'local' | 'dev' | 'prod' {
  return (env.ENVIRONMENT as 'local' | 'dev' | 'prod') || 'prod';
}

/**
 * Check if running in production
 */
export function isProduction(env: Environment): boolean {
  return getEnvironment(env) === 'prod';
}

/**
 * Check if running in development
 */
export function isDevelopment(env: Environment): boolean {
  const envType = getEnvironment(env);
  return envType === 'dev' || envType === 'local';
}

/**
 * Get CORS allowed origins based on environment
 */
export function getAllowedOrigins(env: Environment): string[] {
  const envType = getEnvironment(env);

  switch (envType) {
    case 'local':
      return [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
      ];
    case 'dev':
      return [
        'https://dev.auth.crowai.dev',
        'https://dev.app.crowai.dev',
        'https://dev.crowai.dev',
      ];
    case 'prod':
      return [
        'https://auth.crowai.dev',
        'https://app.crowai.dev',
        'https://crowai.dev',
      ];
    default:
      return [];
  }
}
