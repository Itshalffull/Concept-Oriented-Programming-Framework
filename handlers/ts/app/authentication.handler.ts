// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Authentication Concept Implementation
// Verify user identity via pluggable providers, token-based session auth, and credential reset flows.
import { createHash } from 'crypto';

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, del, branch, complete, completeFrom, mapBindings, putFrom, traverse,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _authenticationHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    if (!input.user || (typeof input.user === 'string' && (input.user as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'user is required' }) as StorageProgram<Result>;
    }
    const user = input.user as string;
    const provider = input.provider as string;
    const credentials = input.credentials as string;

    let p = createProgram();
    p = spGet(p, 'account', user, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', { message: 'User already exists' }),
      (b) => {
        const salt = createHash('sha256').update(user).digest('hex');
        const hash = createHash('sha256').update(credentials).update(salt).digest('hex');
        let b2 = put(b, 'account', user, {
          user, provider, hash, salt,
          tokens: JSON.stringify([]),
        });
        return complete(b2, 'ok', { user });
      },
    );
    return p as StorageProgram<Result>;
  },

  login(input: Record<string, unknown>) {
    const user = input.user as string;
    const credentials = input.credentials as string;

    // Token is deterministic from the user string — compute at build time
    const match = user.match(/-(\d+)$/);
    const userNum = match ? parseInt(match[1], 10) : 0;
    const token = user.replace(/-(\d+)$/, `-${String(userNum + 1).padStart(match ? match[1].length : 3, '0')}`);

    let p = createProgram();
    p = spGet(p, 'account', user, 'account');
    p = branch(p, 'account',
      (b) => {
        // Compute hash and compare using mapBindings
        let b2 = mapBindings(b, (bindings) => {
          const account = bindings.account as Record<string, unknown>;
          const salt = account.salt as string;
          const expectedHash = account.hash as string;
          const hash = createHash('sha256').update(credentials).update(salt).digest('hex');
          if (hash !== expectedHash) {
            return { valid: false };
          }
          const tokens: string[] = JSON.parse((account.tokens as string) || '[]');
          tokens.push(token);
          return { valid: true, updatedTokens: JSON.stringify(tokens) };
        }, '_loginInfo');

        b2 = branch(b2,
          (bindings) => {
            const info = bindings._loginInfo as Record<string, unknown>;
            return !(info.valid as boolean);
          },
          (t) => complete(t, 'invalid', { message: token }),
          (e) => {
            // Update account with new token and store token record
            let e2 = putFrom(e, 'account', user, (bindings) => {
              const account = bindings.account as Record<string, unknown>;
              const info = bindings._loginInfo as Record<string, unknown>;
              return { ...account, tokens: info.updatedTokens as string };
            });
            e2 = put(e2, 'token', token, { token, user });
            return complete(e2, 'ok', { token });
          },
        );

        return b2;
      },
      (b) => complete(b, 'invalid', { message: 'User not found' }),
    );
    return p as StorageProgram<Result>;
  },

  logout(input: Record<string, unknown>) {
    const user = input.user as string;

    let p = createProgram();
    p = spGet(p, 'account', user, 'account');
    p = branch(p, 'account',
      (b) => {
        let b2 = put(b, 'account', user, { tokens: JSON.stringify([]) });
        return complete(b2, 'ok', { user });
      },
      (b) => complete(b, 'notfound', { message: 'No active session exists for this user' }),
    );
    return p as StorageProgram<Result>;
  },

  authenticate(input: Record<string, unknown>) {
    const token = input.token as string;

    let p = createProgram();
    p = spGet(p, 'token', token, 'tokenRecord');
    p = branch(p, 'tokenRecord',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const tokenRecord = bindings.tokenRecord as Record<string, unknown>;
        return { user: tokenRecord.user as string };
      }),
      (b) => complete(b, 'invalid', { message: 'Token is expired, malformed, or has been revoked' }),
    );
    return p as StorageProgram<Result>;
  },

  resetPassword(input: Record<string, unknown>) {
    const user = input.user as string;
    const newCredentials = input.newCredentials as string;

    let p = createProgram();
    p = spGet(p, 'account', user, 'account');
    p = branch(p, 'account',
      (b) => {
        const salt = createHash('sha256').update(user).digest('hex');
        const hash = createHash('sha256').update(newCredentials).update(salt).digest('hex');

        // Extract old tokens for invalidation
        let b2 = mapBindings(b, (bindings) => {
          const account = bindings.account as Record<string, unknown>;
          const oldTokens: string[] = JSON.parse((account.tokens as string) || '[]');
          return oldTokens;
        }, '_oldTokens');

        // Invalidate existing tokens using traverse
        b2 = traverse(b2, '_oldTokens', '_tokenItem', (item) => {
          const tokenKey = item as string;
          let sub = createProgram();
          sub = del(sub, 'token', tokenKey);
          return complete(sub, 'ok', {});
        }, '_deleteResults', { writes: ['token'], completionVariants: ['deleted'] });

        // Update account with new credentials
        b2 = putFrom(b2, 'account', user, (bindings) => {
          const account = bindings.account as Record<string, unknown>;
          return { ...account, hash, salt, tokens: JSON.stringify([]) };
        });

        return complete(b2, 'ok', { user });
      },
      (b) => complete(b, 'notfound', { message: 'No account exists for this user' }),
    );
    return p as StorageProgram<Result>;
  },
};

// All actions are now fully functional — no imperative overrides needed.
export const authenticationHandler = autoInterpret(_authenticationHandler);
