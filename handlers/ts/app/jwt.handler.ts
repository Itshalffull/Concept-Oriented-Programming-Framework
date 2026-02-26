// JWT Concept Implementation
// Simplified JWT — uses base64 encoding with HMAC signature
import { createHmac, randomBytes } from 'crypto';
import type { ConceptHandler } from '@clef/runtime';

const JWT_SECRET = randomBytes(32);

function signToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const expected = createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  if (signature !== expected) return null;

  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString());
  } catch {
    return null;
  }
}

export const jwtHandler: ConceptHandler = {
  async generate(input, storage) {
    const user = input.user as string;
    const token = signToken({ user, iat: Date.now() });

    await storage.put('tokens', user, { user, token });

    return { variant: 'ok', token };
  },

  async verify(input, _storage) {
    const token = input.token as string;
    const payload = verifyToken(token);

    if (!payload || !payload.user) {
      return { variant: 'error', message: 'Invalid or expired token' };
    }

    return { variant: 'ok', user: payload.user as string };
  },
};
