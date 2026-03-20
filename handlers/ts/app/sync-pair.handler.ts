// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// SyncPair Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, del, putFrom, branch, complete, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _syncPairHandler: FunctionalConceptHandler = {
  link(input: Record<string, unknown>) {
    const pairId = input.pairId as string;
    const idA = input.idA as string;
    const idB = input.idB as string;

    let p = createProgram();
    p = spGet(p, 'syncPair', pairId, 'pair');
    p = branch(p, 'pair',
      (b) => {
        let b2 = putFrom(b, 'syncPair', pairId, (bindings) => {
          const pair = bindings.pair as Record<string, unknown>;
          const pairMap = (pair.pairMap as Record<string, string>) || {};
          pairMap[idA] = idB;
          return { ...pair, pairMap };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: `Pair "${pairId}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  sync(input: Record<string, unknown>) {
    const pairId = input.pairId as string;

    let p = createProgram();
    p = spGet(p, 'syncPair', pairId, 'pair');
    p = branch(p, 'pair',
      (b) => {
        let b2 = putFrom(b, 'syncPair', pairId, (bindings) => {
          const pair = bindings.pair as Record<string, unknown>;
          const changeLog = (pair.changeLog as any[]) || [];
          changeLog.push({ pairId, operation: 'sync', timestamp: new Date().toISOString() });
          return { ...pair, status: 'idle', changeLog };
        });
        return complete(b2, 'ok', { changes: JSON.stringify([]) });
      },
      (b) => complete(b, 'notfound', { message: `Pair "${pairId}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  detectConflicts(input: Record<string, unknown>) {
    const pairId = input.pairId as string;

    let p = createProgram();
    p = spGet(p, 'syncPair', pairId, 'pair');
    p = branch(p, 'pair',
      (b) => complete(b, 'ok', { conflicts: JSON.stringify([]) }),
      (b) => complete(b, 'notfound', { message: `Pair "${pairId}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolve(input: Record<string, unknown>) {
    const conflictId = input.conflictId as string;
    const resolution = input.resolution as string || '';

    let p = createProgram();
    p = spGet(p, 'syncConflict', conflictId, 'conflict');
    p = branch(p, 'conflict',
      (b) => {
        let b2 = del(b, 'syncConflict', conflictId);
        return complete(b2, 'ok', { winner: resolution || 'auto' });
      },
      (b) => complete(b, 'notfound', { message: `Conflict "${conflictId}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  unlink(input: Record<string, unknown>) {
    const pairId = input.pairId as string;
    const idA = input.idA as string;

    let p = createProgram();
    p = spGet(p, 'syncPair', pairId, 'pair');
    p = branch(p, 'pair',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const pair = bindings.pair as Record<string, unknown>;
          const pairMap = (pair.pairMap as Record<string, string>) || {};
          return idA in pairMap;
        }, 'isLinked');
        b2 = branch(b2, (bindings) => bindings.isLinked as boolean,
          (() => {
            let t = createProgram();
            t = putFrom(t, 'syncPair', pairId, (bindings) => {
              const pair = bindings.pair as Record<string, unknown>;
              const pairMap = (pair.pairMap as Record<string, string>) || {};
              delete pairMap[idA];
              return { ...pair, pairMap };
            });
            return complete(t, 'ok', {});
          })(),
          (() => {
            let e = createProgram();
            return complete(e, 'notfound', { message: `Record "${idA}" not linked in pair "${pairId}"` });
          })(),
        );
        return b2;
      },
      (b) => complete(b, 'notfound', { message: `Pair "${pairId}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getChangeLog(input: Record<string, unknown>) {
    const pairId = input.pairId as string;
    const since = input.since as string || '';

    let p = createProgram();
    p = spGet(p, 'syncPair', pairId, 'pair');
    p = branch(p, 'pair',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const pair = bindings.pair as Record<string, unknown>;
          let log = (pair.changeLog as any[]) || [];
          if (since) {
            const sinceTime = new Date(since).getTime();
            log = log.filter((entry: any) => new Date(entry.timestamp).getTime() >= sinceTime);
          }
          return JSON.stringify(log);
        }, 'logJson');
        return complete(b2, 'ok', { log: '' });
      },
      (b) => complete(b, 'notfound', { message: `Pair "${pairId}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const syncPairHandler = autoInterpret(_syncPairHandler);

