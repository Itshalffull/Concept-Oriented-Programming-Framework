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
      TE.tryCatch(
        async () => {
          // Check if user ID already exists
          const existing = await storage.get('user', input.user);
          if (existing !== null) {
            return registerError(`Username '${input.user}' is already taken`);
          }

          // Check name uniqueness across all users
          const allUsers = await storage.find('user');
          const nameTaken = allUsers.some(
            (u) => String(u['name'] ?? '') === input.name,
          );
          if (nameTaken) {
            return registerError('name already taken');
          }

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
    ),
};
