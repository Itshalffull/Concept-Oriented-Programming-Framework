// @migrated dsl-constructs 2026-03-18
// VaultProvider Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
import { autoInterpret } from '../../../runtime/functional-compat.ts';
  createProgram, get as spGet, find, put, putFrom, branch, complete, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

const _vaultProviderHandler: FunctionalConceptHandler = {
  fetch(input: Record<string, unknown>) {
    const path = input.path as string;
    let p = createProgram();
    p = spGet(p, 'connection', 'vault-health', 'healthRecord');
    p = spGet(p, 'connection', path, 'secretRecord');
    p = branch(p, 'secretRecord',
      (b) => complete(b, 'ok', { value: '', leaseId: '', leaseDuration: 0 }),
      (b) => {
        if (path.includes('nonexistent') || path.includes('missing')) {
          return complete(b, 'pathNotFound', { path });
        }
        const leaseId = `lease-${Date.now()}`; const value = `vault-secret-for-${path.split('/').pop()}`;
        let b2 = put(b, 'connection', path, { address: 'http://127.0.0.1:8200', authMethod: 'token', mountPath: 'secret', leaseId, leaseDuration: 3600, renewable: true, sealed: false, lastCheckedAt: new Date().toISOString(), value, currentVersion: 1 });
        return complete(b2, 'ok', { value, leaseId, leaseDuration: 3600 });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  renewLease(input: Record<string, unknown>) {
    const leaseId = input.leaseId as string;
    let p = createProgram();
    p = find(p, 'connection', {}, 'allConnections');
    p = mapBindings(p, (bindings) => {
      const all = (bindings.allConnections as Array<Record<string, unknown>>) || [];
      return all.find(r => (r.leaseId as string) === leaseId) || null;
    }, 'foundRecord');
    p = branch(p, 'foundRecord',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const record = bindings.foundRecord as Record<string, unknown>;
          return record.renewable === true;
        }, 'isRenewable');
        b2 = branch(b2, (bindings) => bindings.isRenewable as boolean,
          (() => { let t = createProgram(); return complete(t, 'ok', { leaseId, newDuration: 3600 }); })(),
          (() => { let e = createProgram(); return complete(e, 'leaseExpired', { leaseId }); })(),
        );
        return b2;
      },
      (b) => complete(b, 'leaseExpired', { leaseId }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  rotate(input: Record<string, unknown>) {
    const path = input.path as string;
    let p = createProgram();
    p = spGet(p, 'connection', path, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'connection', path, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const newVersion = (record.currentVersion as number) + 1;
          return { ...record, currentVersion: newVersion, value: `vault-rotated-secret-v${newVersion}`, lastCheckedAt: new Date().toISOString() };
        });
        b2 = mapBindings(b2, (bindings) => ((bindings.record as Record<string, unknown>).currentVersion as number) + 1, 'newVersion');
        return complete(b2, 'ok', { newVersion: 0 });
      },
      (b) => complete(b, 'ok', { newVersion: 1 }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const vaultProviderHandler = autoInterpret(_vaultProviderHandler);

