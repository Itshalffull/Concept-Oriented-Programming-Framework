// Password concept handler — password hashing, verification, and strength validation.
// Implements simulated bcrypt-style hashing with salt and multiple rounds.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  PasswordStorage,
  PasswordSetInput,
  PasswordSetOutput,
  PasswordCheckInput,
  PasswordCheckOutput,
  PasswordValidateInput,
  PasswordValidateOutput,
} from './types.js';

import {
  setOk,
  setInvalid,
  checkOk,
  checkNotfound,
  validateOk,
} from './types.js';

export interface PasswordError {
  readonly code: string;
  readonly message: string;
}

export interface PasswordHandler {
  readonly set: (
    input: PasswordSetInput,
    storage: PasswordStorage,
  ) => TE.TaskEither<PasswordError, PasswordSetOutput>;
  readonly check: (
    input: PasswordCheckInput,
    storage: PasswordStorage,
  ) => TE.TaskEither<PasswordError, PasswordCheckOutput>;
  readonly validate: (
    input: PasswordValidateInput,
    storage: PasswordStorage,
  ) => TE.TaskEither<PasswordError, PasswordValidateOutput>;
}

// --- Pure helpers ---

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const HASH_ROUNDS = 10;

interface PasswordStrengthResult {
  readonly valid: boolean;
  readonly reason: string;
}

const checkPasswordStrength = (password: string): PasswordStrengthResult => {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, reason: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { valid: false, reason: `Password must be at most ${MAX_PASSWORD_LENGTH} characters` };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one lowercase letter' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one uppercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one digit' };
  }
  return { valid: true, reason: '' };
};

// Simulated bcrypt-style hash: deterministic hash with salt prefix.
// In production, use bcrypt or argon2. This simulates the concept.
const generateSalt = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const segments: readonly string[] = Array.from({ length: 16 }, (_, i) =>
    chars[(Date.now() + i * 7 + Math.floor(Math.random() * 1000)) % chars.length],
  );
  return segments.join('');
};

const simulateHash = (password: string, salt: string, rounds: number): string => {
  let hash = 0;
  const input = `${salt}:${password}`;
  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash + char + round) | 0;
    }
  }
  const hexHash = Math.abs(hash).toString(16).padStart(16, '0');
  return `$sim$${rounds}$${salt}$${hexHash}`;
};

const verifyHash = (password: string, storedHash: string): boolean => {
  const parts = storedHash.split('$').filter((p) => p.length > 0);
  // Expected format: $sim$rounds$salt$hash
  if (parts.length !== 4 || parts[0] !== 'sim') {
    return false;
  }
  const rounds = parseInt(parts[1], 10);
  const salt = parts[2];
  const recomputed = simulateHash(password, salt, rounds);
  return recomputed === storedHash;
};

const toStorageError = (error: unknown): PasswordError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const passwordHandler: PasswordHandler = {
  set: (input, storage) => {
    const strength = checkPasswordStrength(input.password);

    if (!strength.valid) {
      return TE.right(setInvalid(strength.reason));
    }

    return pipe(
      TE.tryCatch(
        async () => {
          const salt = generateSalt();
          const hashedPassword = simulateHash(input.password, salt, HASH_ROUNDS);
          const now = new Date().toISOString();

          await storage.put('password', input.user, {
            user: input.user,
            hash: hashedPassword,
            setAt: now,
          });

          return setOk(input.user);
        },
        toStorageError,
      ),
    );
  },

  check: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('password', input.user),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                checkNotfound(`No password set for user '${input.user}'`),
              ),
            (found) => {
              const storedHash = typeof found['hash'] === 'string' ? found['hash'] as string : '';
              const isValid = verifyHash(input.password, storedHash);
              return TE.right(checkOk(isValid));
            },
          ),
        ),
      ),
    ),

  validate: (input, _storage) =>
    pipe(
      TE.right(checkPasswordStrength(input.password)),
      TE.map((result) => validateOk(result.valid)),
    ),
};
