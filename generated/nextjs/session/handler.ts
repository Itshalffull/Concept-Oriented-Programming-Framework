// Session — handler.ts
// Real fp-ts domain logic for session lifecycle with TTL-based expiry and device tracking.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';
import { randomBytes } from 'crypto';

import type {
  SessionStorage,
  SessionCreateInput,
  SessionCreateOutput,
  SessionValidateInput,
  SessionValidateOutput,
  SessionRefreshInput,
  SessionRefreshOutput,
  SessionDestroyInput,
  SessionDestroyOutput,
  SessionDestroyAllInput,
  SessionDestroyAllOutput,
  SessionGetContextInput,
  SessionGetContextOutput,
} from './types.js';

import {
  createOk,
  createError,
  validateOk,
  validateNotfound,
  refreshOk,
  refreshNotfound,
  refreshExpired,
  destroyOk,
  destroyNotfound,
  destroyAllOk,
  getContextOk,
  getContextNotfound,
} from './types.js';

export interface SessionError {
  readonly code: string;
  readonly message: string;
}

export interface SessionHandler {
  readonly create: (
    input: SessionCreateInput,
    storage: SessionStorage,
  ) => TE.TaskEither<SessionError, SessionCreateOutput>;
  readonly validate: (
    input: SessionValidateInput,
    storage: SessionStorage,
  ) => TE.TaskEither<SessionError, SessionValidateOutput>;
  readonly refresh: (
    input: SessionRefreshInput,
    storage: SessionStorage,
  ) => TE.TaskEither<SessionError, SessionRefreshOutput>;
  readonly destroy: (
    input: SessionDestroyInput,
    storage: SessionStorage,
  ) => TE.TaskEither<SessionError, SessionDestroyOutput>;
  readonly destroyAll: (
    input: SessionDestroyAllInput,
    storage: SessionStorage,
  ) => TE.TaskEither<SessionError, SessionDestroyAllOutput>;
  readonly getContext: (
    input: SessionGetContextInput,
    storage: SessionStorage,
  ) => TE.TaskEither<SessionError, SessionGetContextOutput>;
}

// --- Pure helpers ---

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CONCURRENT_SESSIONS = 5;

const generateToken = (): string => randomBytes(32).toString('hex');

const isExpired = (expiresAt: unknown): boolean => {
  const exp = typeof expiresAt === 'number' ? expiresAt : Number(expiresAt);
  return Number.isNaN(exp) || Date.now() > exp;
};

const storageError = (error: unknown): SessionError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const sessionHandler: SessionHandler = {
  /**
   * Create a new session for a user+device pair. Enforces a maximum concurrent
   * session limit per user. Generates an opaque token and sets TTL-based expiry.
   */
  create: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('sessions', { userId: input.userId }),
        storageError,
      ),
      TE.chain((existingSessions) => {
        const activeSessions = existingSessions.filter(
          (s) => s.isValid === true && !isExpired(s.expiresAt),
        );
        if (activeSessions.length >= MAX_CONCURRENT_SESSIONS) {
          return TE.right<SessionError, SessionCreateOutput>(
            createError(
              `Maximum concurrent sessions (${MAX_CONCURRENT_SESSIONS}) exceeded for user ${input.userId}`,
            ),
          );
        }
        const token = generateToken();
        const now = Date.now();
        return TE.tryCatch(
          async () => {
            await storage.put('sessions', input.session, {
              sessionId: input.session,
              userId: input.userId,
              device: input.device,
              token,
              createdAt: now,
              expiresAt: now + SESSION_TTL_MS,
              isValid: true,
            });
            return createOk(token);
          },
          storageError,
        );
      }),
    ),

  /**
   * Validate a session: check existence, validity flag, and TTL expiry.
   * Returns ok(true) for valid sessions, ok(false) for expired ones,
   * and notfound for sessions that do not exist.
   */
  validate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('sessions', input.session),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<SessionError, SessionValidateOutput>(
              validateNotfound(`Session '${input.session}' not found`),
            ),
            (session) => {
              if (session.isValid !== true) {
                return TE.right<SessionError, SessionValidateOutput>(validateOk(false));
              }
              if (isExpired(session.expiresAt)) {
                // Mark expired session as invalid for future lookups
                return pipe(
                  TE.tryCatch(
                    async () => {
                      await storage.put('sessions', input.session, {
                        ...session,
                        isValid: false,
                      });
                      return validateOk(false);
                    },
                    storageError,
                  ),
                );
              }
              return TE.right<SessionError, SessionValidateOutput>(validateOk(true));
            },
          ),
        ),
      ),
    ),

  /**
   * Refresh a session by extending the TTL and issuing a new token.
   * The session must exist and must not be expired.
   */
  refresh: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('sessions', input.session),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<SessionError, SessionRefreshOutput>(
              refreshNotfound(`Session '${input.session}' not found`),
            ),
            (session) => {
              if (session.isValid !== true || isExpired(session.expiresAt)) {
                return TE.right<SessionError, SessionRefreshOutput>(
                  refreshExpired(
                    `Session '${input.session}' has expired and cannot be refreshed`,
                  ),
                );
              }
              const newToken = generateToken();
              const now = Date.now();
              return TE.tryCatch(
                async () => {
                  await storage.put('sessions', input.session, {
                    ...session,
                    token: newToken,
                    expiresAt: now + SESSION_TTL_MS,
                    refreshedAt: now,
                  });
                  return refreshOk(newToken);
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Destroy a session by marking it invalid and removing it from the store.
   */
  destroy: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('sessions', input.session),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<SessionError, SessionDestroyOutput>(
              destroyNotfound(`Session '${input.session}' not found`),
            ),
            () =>
              TE.tryCatch(
                async () => {
                  await storage.delete('sessions', input.session);
                  return destroyOk(input.session);
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  /**
   * Destroy all sessions for a given user across all devices.
   */
  destroyAll: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('sessions', { userId: input.userId }),
        storageError,
      ),
      TE.chain((sessions) =>
        TE.tryCatch(
          async () => {
            for (const session of sessions) {
              const id = (session.sessionId as string) ?? (session.session as string);
              if (id) {
                await storage.delete('sessions', id);
              }
            }
            return destroyAllOk(input.userId);
          },
          storageError,
        ),
      ),
    ),

  /**
   * Return the user identity and device bound to the session.
   */
  getContext: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('sessions', input.session),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<SessionError, SessionGetContextOutput>(
              getContextNotfound(`Session '${input.session}' not found`),
            ),
            (session) =>
              TE.right<SessionError, SessionGetContextOutput>(
                getContextOk(
                  session.userId as string,
                  session.device as string,
                ),
              ),
          ),
        ),
      ),
    ),
};
