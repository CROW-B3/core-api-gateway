import type { Environment } from '../types';

interface JWTPayload {
  sub: string;
  exp: number;
  iat: number;
  iss: string;
  isAnonymous?: boolean;
}

interface JWKS {
  keys: Array<{
    kty: string;
    kid: string;
    alg: string;
    n?: string;
    e?: string;
    crv?: string;
    x?: string;
    y?: string;
  }>;
}

let cachedJWKS: JWKS | null = null;
let jwksCacheTime = 0;
const JWKS_CACHE_TTL = 3600000;

export async function getJWKS(env: Environment): Promise<JWKS | null> {
  const now = Date.now();
  if (cachedJWKS && now - jwksCacheTime < JWKS_CACHE_TTL) {
    return cachedJWKS;
  }

  try {
    const response = await fetch(`${env.AUTH_SERVICE_URL}/api/auth/jwks`);
    if (!response.ok) {
      console.error('Failed to fetch JWKS');
      return null;
    }

    cachedJWKS = await response.json();
    jwksCacheTime = now;
    return cachedJWKS;
  } catch (error) {
    console.error('JWKS fetch error:', error);
    return null;
  }
}

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    '='
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function verifyJWT(
  token: string,
  env: Environment
): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const headerJson = new TextDecoder().decode(base64UrlDecode(parts[0]));
    const payloadJson = new TextDecoder().decode(base64UrlDecode(parts[1]));

    const header = JSON.parse(headerJson);
    const payload = JSON.parse(payloadJson);

    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }

    const jwks = await getJWKS(env);
    if (!jwks) return null;

    const key = jwks.keys.find(k => k.kid === header.kid);
    if (!key) return null;

    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      key as JsonWebKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signature = base64UrlDecode(parts[2]);
    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);

    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      signature,
      data
    );

    return valid ? payload : null;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}
