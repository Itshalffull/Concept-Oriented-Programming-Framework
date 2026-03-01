// User concept handler — registration with unique username enforcement and email validation.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  UserStorage,
  UserRegisterInput,
  UserRegisterOutput,
} from './types.js';

import {
  registerOk,
  registerError,
} from './types.js';

export interface UserError {
  readonly code: string;
  readonly message: string;
}

export interface UserHandler {
  readonly register: (
    input: UserRegisterInput,
    storage: UserStorage,
  ) => TE.TaskEither<UserError, UserRegisterOutput>;
}

// --- Pure helpers ---

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidEmail = (email: string): boolean => EMAIL_REGEX.test(email);

const isValidUsername = (user: string): boolean =>
  user.length >= 3 && user.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(user);

const toStorageError = (error: unknown): UserError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const userHandler: UserHandler = {
  register: (input, storage) =>
    pipe(
      // Validate email format
      TE.fromEither(
        isValidEmail(input.email)
          ? { _tag: 'Right' as const, right: undefined }
          : { _tag: 'Right' as const, right: 'invalid_email' as const },
      ),
      TE.chain((emailIssue) =>
        pipe(
          O.fromNullable(emailIssue === 'invalid_email' ? emailIssue : null),
          O.fold(
            // Email is valid, proceed with username validation
            () =>
              pipe(
                isValidUsername(input.user)
                  ? TE.right(undefined)
                  : TE.right(registerError(
                      'Username must be 3-64 characters and contain only letters, numbers, hyphens, and underscores',
                    ) as UserRegisterOutput),
                TE.chain((usernameResult) =>
                  pipe(
                    O.fromNullable(
                      usernameResult !== undefined ? usernameResult : null,
                    ),
                    O.fold(
                      // Both validations passed, check uniqueness
                      () =>
                        pipe(
                          TE.tryCatch(
                            () => storage.get('user', input.user),
                            toStorageError,
                          ),
                          TE.chain((existing) =>
                            pipe(
                              O.fromNullable(existing),
                              O.fold(
                                // User does not exist, create
                                () =>
                                  TE.tryCatch(
                                    async () => {
                                      const now = new Date().toISOString();
                                      await storage.put('user', input.user, {
                                        user: input.user,
                                        name: input.name,
                                        email: input.email,
                                        active: true,
                                        createdAt: now,
                                        updatedAt: now,
                                      });
                                      return registerOk(input.user);
                                    },
                                    toStorageError,
                                  ),
                                // User already exists
                                () =>
                                  TE.right(
                                    registerError(
                                      `Username '${input.user}' is already taken`,
                                    ),
                                  ),
                              ),
                            ),
                          ),
                        ),
                      // Username validation failed
                      (err) => TE.right(err),
                    ),
                  ),
                ),
              ),
            // Email validation failed
            () =>
              TE.right(
                registerError(
                  `Invalid email format: '${input.email}'`,
                ),
              ),
          ),
        ),
      ),
    ),
};
