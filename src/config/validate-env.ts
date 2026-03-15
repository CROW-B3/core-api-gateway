import type { Environment } from '../types';

const REQUIRED_ENVIRONMENT_VARIABLES = [
  'AUTH_SERVICE_URL',
  'USER_SERVICE_URL',
  'ORGANIZATION_SERVICE_URL',
  'BILLING_SERVICE_URL',
  'NOTIFICATION_SERVICE_URL',
  'PRODUCT_SERVICE_URL',
] as const;

const isMissingValue = (value: unknown): boolean =>
  value === undefined || value === null;

const isEmptyStringValue = (value: unknown): boolean =>
  typeof value === 'string' && value.trim() === '';

const findMissingVariables = (env: Partial<Environment>): string[] =>
  REQUIRED_ENVIRONMENT_VARIABLES.filter(key =>
    isMissingValue(env[key as keyof Environment])
  );

const findEmptyVariables = (env: Partial<Environment>): string[] =>
  REQUIRED_ENVIRONMENT_VARIABLES.filter(key =>
    isEmptyStringValue(env[key as keyof Environment])
  );

const buildValidationErrorMessages = (
  missingVariables: string[],
  emptyVariables: string[]
): string[] => {
  const errorMessages: string[] = [];

  if (missingVariables.length > 0) {
    errorMessages.push(
      `Missing required environment variables: ${missingVariables.join(', ')}`
    );
  }

  if (emptyVariables.length > 0) {
    errorMessages.push(
      `Empty environment variables: ${emptyVariables.join(', ')}`
    );
  }

  return errorMessages;
};

export function validateEnvironmentVariables(env: Partial<Environment>): void {
  const missingVariables = findMissingVariables(env);
  const emptyVariables = findEmptyVariables(env);
  const validationErrors = buildValidationErrorMessages(
    missingVariables,
    emptyVariables
  );

  if (validationErrors.length === 0) {
    return;
  }

  throw new Error(
    `Environment validation failed:\n${validationErrors.join('\n')}\n\n` +
      'Please ensure all required environment variables are set in your .env file or deployment configuration.'
  );
}

export function resolveEnvironmentType(
  env: Environment
): 'local' | 'dev' | 'prod' {
  return (env.ENVIRONMENT as 'local' | 'dev' | 'prod') || 'prod';
}

export function isProductionEnvironment(env: Environment): boolean {
  return resolveEnvironmentType(env) === 'prod';
}

export function isDevelopmentEnvironment(env: Environment): boolean {
  const environmentType = resolveEnvironmentType(env);
  return environmentType === 'dev' || environmentType === 'local';
}

export function fetchAllowedOriginsByEnvironment(env: Environment): string[] {
  const environmentType = resolveEnvironmentType(env);

  switch (environmentType) {
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
