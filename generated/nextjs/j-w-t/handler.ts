// JWT concept handler — token generation and verification with base64url encoding,
// simulated HMAC-SHA256 signing, expiry checking, and claims extraction.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  JWTStorage,
  JWTGenerateInput,
  JWTGenerateOutput,
  JWTVerifyInput,
  JWTVerifyOutput,
} from './types.js';

import {
  generateOk,
  verifyOk,
  verifyError,
} from './types.js';

export interface JWTError {
  readonly code: string;
  readonly message: string;
}

export interface JWTHandler {
  readonly generate: (
    input: JWTGenerateInput,
    storage: JWTStorage,
  ) => TE.TaskEither<JWTError, JWTGenerateOutput>;
  readonly verify: (
    input: JWTVerifyInput,
    storage: JWTStorage,
  ) => TE.TaskEither<JWTError, JWTVerifyOutput>;
}

// --- Pure helpers ---

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

const base64UrlEncode = (str: string): string => {
  const base64 = Buffer.from(str, 'utf-8').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const base64UrlDecode = (str: string): string => {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
};

const createSimulatedSignature = (headerPayload: string, secret: string): string => {
  // Simulated HMAC-SHA256: deterministic hash combining input and secret.
  // In production, use crypto.createHmac('sha256', secret).
  let hash = 0;
  const combined = headerPayload + '.' + secret;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return base64UrlEncode(Math.abs(hash).toString(16).padStart(16, '0'));
};

const buildToken = (user: string, issuedAt: number, expiresAt: number): string => {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: user,
      iat: issuedAt,
      exp: expiresAt,
    }),
  );
  const signature = createSimulatedSignature(`${header}.${payload}`, 'clef-jwt-secret');
  return `${header}.${payload}.${signature}`;
};

const parseToken = (
  token: string,
): E.Either<string, { readonly sub: string; readonly iat: number; readonly exp: number }> => {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return E.left('Malformed token: expected 3 segments');
  }
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') {
      return E.left('Invalid token payload: missing required claims');
    }
    return E.right({
      sub: payload.sub,
      iat: payload.iat,
      exp: payload.exp,
    });
  } catch {
    return E.left('Failed to decode token payload');
  }
};

const isExpired = (expiresAt: number, now: number): boolean => now >= expiresAt;

const toStorageError = (error: unknown): JWTError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const jWTHandler: JWTHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const now = Date.now();
          const expiresAt = now + TOKEN_EXPIRY_MS;
          const token = buildToken(input.user, now, expiresAt);

          // Persist the token metadata for server-side verification
          await storage.put('jwt', token, {
            user: input.user,
            issuedAt: now,
            expiresAt,
            revoked: false,
          });

          return generateOk(token);
        },
        toStorageError,
      ),
    ),

  verify: (input, storage) =>
    pipe(
      // First, parse the token structure
      TE.fromEither(
        pipe(
          parseToken(input.token),
          E.mapLeft(
            (msg): JWTError => ({ code: 'INVALID_TOKEN', message: msg }),
          ),
        ),
      ),
      TE.chain((claims) =>
        pipe(
          // Check expiry from the claims themselves
          isExpired(claims.exp, Date.now())
            ? TE.right(verifyError('Token has expired') as JWTVerifyOutput)
            : pipe(
                // Look up token in storage to check revocation
                TE.tryCatch(
                  () => storage.get('jwt', input.token),
                  toStorageError,
                ),
                TE.chain((record) =>
                  pipe(
                    O.fromNullable(record),
                    O.fold(
                      // Token not found in store -- could be valid if claims pass,
                      // but we treat untracked tokens as unverifiable
                      () =>
                        TE.right(
                          verifyError('Token not recognized') as JWTVerifyOutput,
                        ),
                      (found) =>
                        found['revoked'] === true
                          ? TE.right(
                              verifyError('Token has been revoked') as JWTVerifyOutput,
                            )
                          : TE.right(verifyOk(claims.sub) as JWTVerifyOutput),
                    ),
                  ),
                ),
              ),
        ),
      ),
    ),
};
