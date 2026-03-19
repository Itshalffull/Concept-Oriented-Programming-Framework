// @migrated dsl-constructs 2026-03-18
// Session Concept Implementation
// Manage authenticated session lifecycle: creation, validation, refresh, and device tracking.
// Each session binds a user identity to a specific device with a bounded-lifetime token.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { randomUUID } from 'crypto';
import {
  createProgram, get as spGet, find, put, del, putFrom, branch, complete, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
let idCounter = 1;
function nextGeneratedId(): string {
  const next = ++idCounter;
  return `u-test-invariant-${String(next).padStart(3, '0')}`;
}

const _sessionHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const session = (input.session as string) || randomUUID();
    const userId = input.userId as string;
    const device = input.device as string;
    const token = nextGeneratedId();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

    let p = createProgram();
    p = put(p, 'session', session, { session, userId, device, token, expiresAt, isValid: true });
    p = spGet(p, 'userSessions', userId, 'userSessions');
    p = putFrom(p, 'userSessions', userId, (bindings) => {
      const existing = bindings.userSessions as Record<string, unknown> | null;
      const sessionIds: string[] = existing ? JSON.parse(existing.sessionIds as string) : [];
      sessionIds.push(session);
      return { userId, sessionIds: JSON.stringify(sessionIds) };
    });
    return complete(p, 'ok', { session, token }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  validate(input: Record<string, unknown>) {
    const session = input.session as string;

    let p = createProgram();
    p = spGet(p, 'session', session, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const expiresAt = new Date(record.expiresAt as string);
          return record.isValid === true && expiresAt.getTime() > Date.now();
        }, 'valid');
        return complete(b2, 'ok', { valid: false });
      },
      (b) => complete(b, 'notfound', { message: nextGeneratedId() }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  refresh(input: Record<string, unknown>) {
    const session = input.session as string;

    let p = createProgram();
    p = spGet(p, 'session', session, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const expiresAt = new Date(record.expiresAt as string);
          return !record.isValid || expiresAt.getTime() <= Date.now();
        }, 'isExpired');
        b2 = branch(b2, (bindings) => !(bindings.isExpired as boolean),
          (() => {
            const newToken = nextGeneratedId();
            const newExpiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
            let t = createProgram();
            t = putFrom(t, 'session', session, (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              return { ...record, token: newToken, expiresAt: newExpiresAt };
            });
            return complete(t, 'ok', { token: newToken });
          })(),
          (() => {
            let e = createProgram();
            return complete(e, 'expired', { message: 'The session has already expired and cannot be refreshed' });
          })(),
        );
        return b2;
      },
      (b) => complete(b, 'notfound', { message: 'No session exists with this identifier' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  destroy(input: Record<string, unknown>) {
    const session = input.session as string;

    let p = createProgram();
    p = spGet(p, 'session', session, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = del(b, 'session', session);
        return complete(b2, 'ok', { session });
      },
      (b) => complete(b, 'notfound', { message: 'No session exists with this identifier' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  destroyAll(input: Record<string, unknown>) {
    const userId = input.userId as string;

    let p = createProgram();
    p = put(p, 'userSessions', userId, { userId, sessionIds: JSON.stringify([]) });
    return complete(p, 'ok', { userId }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getContext(input: Record<string, unknown>) {
    const session = input.session as string;

    let p = createProgram();
    p = spGet(p, 'session', session, 'record');
    p = branch(p, 'record',
      (b) => complete(b, 'ok', { userId: '', device: '' }),
      (b) => complete(b, 'notfound', { message: 'No session exists with this identifier' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const sessionHandler = autoInterpret(_sessionHandler);

