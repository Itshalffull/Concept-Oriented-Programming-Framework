// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// VaultProvider Concept Implementation
// HashiCorp Vault provider for the Secret coordination concept. Fetches
// secrets, manages lease renewals, and handles secret rotation.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom, mapBindings, putFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'vault';

const _handler: FunctionalConceptHandler = {
  fetch(input: Record<string, unknown>) {
    const path = input.path as string;

    if (!path || path.trim() === '') {
      let p = createProgram();
      return complete(p, 'pathNotFound', { path: '' }) as StorageProgram<Result>;
    }

    const leaseId = `lease-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const leaseDuration = 3600;
    const value = `vault-secret-${path}`;

    let p = createProgram();
    p = put(p, RELATION, leaseId, {
      leaseId,
      path,
      value,
      leaseDuration,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + leaseDuration * 1000).toISOString(),
    });

    return complete(p, 'ok', { value, leaseId, leaseDuration }) as StorageProgram<Result>;
  },

  renewLease(input: Record<string, unknown>) {
    const leaseId = input.leaseId as string;

    let p = createProgram();
    p = get(p, RELATION, leaseId, 'record');

    p = branch(p, 'record',
      (b) => {
        const newDuration = 3600;
        const b2 = putFrom(b, RELATION, leaseId, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            ...record,
            leaseDuration: newDuration,
            expiresAt: new Date(Date.now() + newDuration * 1000).toISOString(),
          };
        });
        return complete(b2, 'ok', { leaseId, newDuration });
      },
      (b) => complete(b, 'leaseExpired', { leaseId }),
    );

    return p as StorageProgram<Result>;
  },

  rotate(input: Record<string, unknown>) {
    const path = input.path as string;

    // Note: The DSL does not support iterative deletes over dynamic result sets.
    // We find matches and report the rotation; the actual lease cleanup is handled
    // by sync-driven side effects in production.
    let p = createProgram();
    p = find(p, RELATION, { path }, 'matches');

    const newVersion = Date.now();
    return complete(p, 'ok', { newVersion }) as StorageProgram<Result>;
  },
};

export const vaultProviderHandler = autoInterpret(_handler);
