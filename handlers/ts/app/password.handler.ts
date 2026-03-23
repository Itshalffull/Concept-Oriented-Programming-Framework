// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Password Concept Implementation — Functional (StorageProgram) style
import { createHash, randomBytes } from 'crypto';
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _passwordHandler: FunctionalConceptHandler = {
  set(input: Record<string, unknown>) {
    const user = input.user as string;
    const password = input.password as string;

    let p = createProgram();

    if (password.length < 8) {
      return complete(p, 'invalid', { message: 'Password must be at least 8 characters' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const salt = randomBytes(16);
    const hash = createHash('sha256').update(password).update(salt).digest();

    p = put(p, 'password', user, {
      user,
      hash: hash.toString('base64'),
      salt: salt.toString('base64'),
    });

    return complete(p, 'ok', { user }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  check(input: Record<string, unknown>) {
    const user = input.user as string;
    const password = input.password as string;

    let p = createProgram();
    p = spGet(p, 'password', user, 'record');
    p = branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        const salt = Buffer.from(record.salt as string, 'base64');
        const hash = createHash('sha256').update(password).update(salt).digest();
        const storedHash = Buffer.from(record.hash as string, 'base64');
        return { valid: hash.equals(storedHash) };
      }),
      (b) => complete(b, 'notfound', { message: 'No credentials for user' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  validate(input: Record<string, unknown>) {
    const password = input.password as string;

    let p = createProgram();
    return complete(p, 'ok', { valid: password.length >= 8 }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const passwordHandler = autoInterpret(_passwordHandler);

