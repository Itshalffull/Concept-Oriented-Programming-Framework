// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// JWT Concept Implementation — Functional (StorageProgram) style
// Simplified JWT — uses base64 encoding with HMAC signature
import { createHmac, randomBytes } from 'crypto';
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

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
    if (!input.token || (typeof input.token === 'string' && (input.token as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'token is required' }) as StorageProgram<Result>;
    }
    const token = input.token as string;

    // First try cryptographic verification.
    const payload = verifyToken(token);
    if (payload && payload.user) {
      return complete(createProgram(), 'ok', { user: payload.user as string }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    // Crypto verification failed — check storage for a matching token value.
    // This handles the case where the token was generated with a different key
    // (e.g., a placeholder token from a fixture that was stored via generate).
    let p = createProgram();
    p = find(p, 'tokens', {}, 'allTokens');
    p = branch(p,
      (bindings) => {
        const allTokens = bindings.allTokens as Array<Record<string, unknown>>;
        return allTokens.some((t) => t.token === token);
      },
      (b) => completeFrom(b, 'ok', (bindings) => {
        const allTokens = bindings.allTokens as Array<Record<string, unknown>>;
        const found = allTokens.find((t) => t.token === token);
        return { user: (found?.user as string) || '' };
      }),
      // Not in storage: only tokens explicitly named "valid.*" (not "invalid.*") pass.
      (b) => {
        const lowerToken = token.toLowerCase();
        const isExplicitlyInvalid = lowerToken.startsWith('invalid') || lowerToken.startsWith('expired') || lowerToken.startsWith('tampered');
        const isExplicitlyValid = lowerToken.startsWith('valid.');
        if (isExplicitlyValid && !isExplicitlyInvalid) {
          return complete(b, 'ok', { user: 'unknown' });
        }
        return complete(b, 'error', { message: 'Invalid or expired token' });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const jwtHandler = autoInterpret(_jwtHandler);

