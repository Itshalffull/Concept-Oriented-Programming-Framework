// Authentication — handler.ts
// Real fp-ts domain logic for credential validation, token lifecycle, and session auth.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';
import { createHash, randomBytes } from 'crypto';

import type {
  AuthenticationStorage,
  AuthenticationRegisterInput,
  AuthenticationRegisterOutput,
  AuthenticationLoginInput,
  AuthenticationLoginOutput,
  AuthenticationLogoutInput,
  AuthenticationLogoutOutput,
  AuthenticationAuthenticateInput,
  AuthenticationAuthenticateOutput,
  AuthenticationResetPasswordInput,
  AuthenticationResetPasswordOutput,
} from './types.js';

import {
  registerOk,
  registerExists,
  loginOk,
  loginInvalid,
  logoutOk,
  logoutNotfound,
  authenticateOk,
  authenticateInvalid,
  resetPasswordOk,
  resetPasswordNotfound,
} from './types.js';

export interface AuthenticationError {
  readonly code: string;
  readonly message: string;
}

export interface AuthenticationHandler {
  readonly register: (
    input: AuthenticationRegisterInput,
    storage: AuthenticationStorage,
  ) => TE.TaskEither<AuthenticationError, AuthenticationRegisterOutput>;
  readonly login: (
    input: AuthenticationLoginInput,
    storage: AuthenticationStorage,
  ) => TE.TaskEither<AuthenticationError, AuthenticationLoginOutput>;
  readonly logout: (
    input: AuthenticationLogoutInput,
    storage: AuthenticationStorage,
  ) => TE.TaskEither<AuthenticationError, AuthenticationLogoutOutput>;
  readonly authenticate: (
    input: AuthenticationAuthenticateInput,
    storage: AuthenticationStorage,
  ) => TE.TaskEither<AuthenticationError, AuthenticationAuthenticateOutput>;
  readonly resetPassword: (
    input: AuthenticationResetPasswordInput,
    storage: AuthenticationStorage,
  ) => TE.TaskEither<AuthenticationError, AuthenticationResetPasswordOutput>;
}

// --- Pure helpers ---

const TOKEN_TTL_MS = 3600 * 1000; // 1 hour
const TOKEN_SECRET = 'clef-auth-secret';

const hashCredentials = (credentials: string, salt: string): string =>
  createHash('sha256').update(`${salt}:${credentials}`).digest('hex');

const generateSalt = (): string => randomBytes(16).toString('hex');

const generateToken = (user: string): string => {
  const payload = JSON.stringify({
    user,
    iat: Date.now(),
    exp: Date.now() + TOKEN_TTL_MS,
    nonce: randomBytes(8).toString('hex'),
  });
  const signature = createHash('sha256')
    .update(`${TOKEN_SECRET}:${payload}`)
    .digest('hex');
  const encoded = Buffer.from(payload).toString('base64url');
  return `${encoded}.${signature}`;
};

const parseToken = (
  token: string,
): O.Option<{ readonly user: string; readonly exp: number }> => {
  const parts = token.split('.');
  if (parts.length !== 2) return O.none;
  const [encoded, signature] = parts;
  try {
    const payload = Buffer.from(encoded, 'base64url').toString('utf-8');
    const expectedSig = createHash('sha256')
      .update(`${TOKEN_SECRET}:${payload}`)
      .digest('hex');
    if (signature !== expectedSig) return O.none;
    const parsed = JSON.parse(payload) as { user: string; exp: number };
    return O.some({ user: parsed.user, exp: parsed.exp });
  } catch {
    return O.none;
  }
};

const storageError = (error: unknown): AuthenticationError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const authenticationHandler: AuthenticationHandler = {
  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('accounts', input.user),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () => {
              const salt = generateSalt();
              const hashedCredentials = hashCredentials(input.credentials, salt);
              return TE.tryCatch(
                async () => {
                  await storage.put('accounts', input.user, {
                    user: input.user,
                    provider: input.provider,
                    credentials: hashedCredentials,
                    salt,
                    createdAt: Date.now(),
                  });
                  return registerOk(input.user);
                },
                storageError,
              );
            },
            () => TE.right<AuthenticationError, AuthenticationRegisterOutput>(
              registerExists(`Account already exists for user ${input.user}`),
            ),
          ),
        ),
      ),
    ),

  login: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('accounts', input.user),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<AuthenticationError, AuthenticationLoginOutput>(
              loginInvalid(`No account found for user ${input.user}`),
            ),
            (account) => {
              const salt = account.salt as string;
              const storedHash = account.credentials as string;
              const inputHash = hashCredentials(input.credentials, salt);
              if (inputHash !== storedHash) {
                return TE.right<AuthenticationError, AuthenticationLoginOutput>(
                  loginInvalid('Invalid credentials'),
                );
              }
              const token = generateToken(input.user);
              return TE.tryCatch(
                async () => {
                  await storage.put('tokens', token, {
                    user: input.user,
                    token,
                    createdAt: Date.now(),
                    expiresAt: Date.now() + TOKEN_TTL_MS,
                    revoked: false,
                  });
                  return loginOk(token);
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  logout: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('tokens', { user: input.user, revoked: false }),
        storageError,
      ),
      TE.chain((tokens) => {
        if (tokens.length === 0) {
          return TE.right<AuthenticationError, AuthenticationLogoutOutput>(
            logoutNotfound(`No active session for user ${input.user}`),
          );
        }
        return TE.tryCatch(
          async () => {
            for (const tok of tokens) {
              await storage.put('tokens', tok.token as string, {
                ...tok,
                revoked: true,
                revokedAt: Date.now(),
              });
            }
            return logoutOk(input.user);
          },
          storageError,
        );
      }),
    ),

  authenticate: (input, storage) =>
    pipe(
      parseToken(input.token),
      O.fold(
        () => TE.right<AuthenticationError, AuthenticationAuthenticateOutput>(
          authenticateInvalid('Token is malformed or has an invalid signature'),
        ),
        (decoded) => {
          if (Date.now() > decoded.exp) {
            return TE.right<AuthenticationError, AuthenticationAuthenticateOutput>(
              authenticateInvalid('Token has expired'),
            );
          }
          return pipe(
            TE.tryCatch(
              () => storage.get('tokens', input.token),
              storageError,
            ),
            TE.chain((record) =>
              pipe(
                O.fromNullable(record),
                O.fold(
                  () => TE.right<AuthenticationError, AuthenticationAuthenticateOutput>(
                    authenticateInvalid('Token not found in store'),
                  ),
                  (storedToken) => {
                    if (storedToken.revoked === true) {
                      return TE.right<AuthenticationError, AuthenticationAuthenticateOutput>(
                        authenticateInvalid('Token has been revoked'),
                      );
                    }
                    return TE.right<AuthenticationError, AuthenticationAuthenticateOutput>(
                      authenticateOk(decoded.user),
                    );
                  },
                ),
              ),
            ),
          );
        },
      ),
    ),

  resetPassword: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('accounts', input.user),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<AuthenticationError, AuthenticationResetPasswordOutput>(
              resetPasswordNotfound(`No account found for user ${input.user}`),
            ),
            (account) => {
              const salt = generateSalt();
              const hashedCredentials = hashCredentials(input.newCredentials, salt);
              return TE.tryCatch(
                async () => {
                  // Update credentials
                  await storage.put('accounts', input.user, {
                    ...account,
                    credentials: hashedCredentials,
                    salt,
                    updatedAt: Date.now(),
                  });
                  // Revoke all existing tokens for this user
                  const tokens = await storage.find('tokens', { user: input.user, revoked: false });
                  for (const tok of tokens) {
                    await storage.put('tokens', tok.token as string, {
                      ...tok,
                      revoked: true,
                      revokedAt: Date.now(),
                    });
                  }
                  return resetPasswordOk(input.user);
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),
};
