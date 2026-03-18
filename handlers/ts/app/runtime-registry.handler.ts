// @migrated dsl-constructs 2026-03-18
// ============================================================
// RuntimeRegistry Concept Implementation
//
// Tracks what concepts and syncs are actually registered and
// running in the kernel. The kernel populates this during boot.
// Answers "is concept X loaded?" and "what syncs are active?"
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

export const runtimeRegistryHandler: FunctionalConceptHandler = {
  registerConcept(input: Record<string, unknown>) {
    const uri = input.uri as string;
    const hasStorage = input.has_storage as boolean;
    const storageName = input.storage_name as string ?? '';
    const storageType = input.storage_type as string ?? 'standard';

    let p = createProgram();
    p = spGet(p, 'concept', uri, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'already_registered', {}),
      (b) => {
        let b2 = put(b, 'concept', uri, {
          id: uri,
          uri,
          has_storage: hasStorage,
          storage_name: storageName,
          storage_type: storageType,
          registered_at: new Date().toISOString(),
        });
        return complete(b2, 'ok', {});
      },
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  registerSync(input: Record<string, unknown>) {
    const syncName = input.sync_name as string;
    const source = input.source as string;
    const suite = (input.suite as string) ?? '';

    let p = createProgram();
    p = spGet(p, 'sync', syncName, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'already_registered', {}),
      (b) => {
        let b2 = put(b, 'sync', syncName, {
          id: syncName,
          sync_name: syncName,
          source,
          suite,
          registered_at: new Date().toISOString(),
        });
        return complete(b2, 'ok', {});
      },
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getConcept(input: Record<string, unknown>) {
    const uri = input.uri as string;

    let p = createProgram();
    p = spGet(p, 'concept', uri, 'concept');
    p = branch(p, 'concept',
      (b) => complete(b, 'ok', { concept: JSON.stringify({}) }),
      (b) => complete(b, 'notfound', {}),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listConcepts(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'concept', {}, 'concepts');
    return complete(p, 'ok', { concepts: JSON.stringify([]) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listSyncs(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'sync', {}, 'syncs');
    return complete(p, 'ok', { syncs: JSON.stringify([]) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  isLoaded(input: Record<string, unknown>) {
    const uri = input.uri as string;

    let p = createProgram();
    p = spGet(p, 'concept', uri, 'concept');
    p = branch(p, 'concept',
      (b) => complete(b, 'ok', { loaded: true }),
      (b) => complete(b, 'ok', { loaded: false }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
