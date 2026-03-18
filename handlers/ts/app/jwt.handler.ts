// @migrated dsl-constructs 2026-03-18
// JWT Concept Implementation — Functional (StorageProgram) style
// Simplified JWT — uses base64 encoding with HMAC signature
import { createHmac, randomBytes } from 'crypto';
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
import { autoInterpret } from '../../../runtime/functional-compat.ts';
  createProgram, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

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

const _jwtHandler: FunctionalConceptHandler = {
  generate(input: Record<string, unknown>) {
    const user = input.user as string;
    const token = signToken({ user, iat: Date.now() });

    let p = createProgram();
    p = put(p, 'tokens', user, { user, token });
    return complete(p, 'ok', { token }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  verify(input: Record<string, unknown>) {
    const token = input.token as string;
    const payload = verifyToken(token);

    let p = createProgram();
    if (!payload || !payload.user) {
      return complete(p, 'error', { message: 'Invalid or expired token' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    return complete(p, 'ok', { user: payload.user as string }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const jwtHandler = autoInterpret(_jwtHandler);

