// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// SyncDependenceProvider Handler
//
// Dependence analysis provider for .sync files. Extracts
// when-clause to then-clause data flow and cross-sync
// triggering chains as dependency edges.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, find, put, complete, completeFrom,
  branch, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `sync-dependence-provider-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const id = nextId();
    const providerRef = `dependence-provider:sync`;
    const handledLanguages = 'sync';

    let p = createProgram();
    p = find(p, 'sync-dependence-provider', { providerRef }, 'existing');

    return branch(p,
      (b) => (b.existing as unknown[]).length > 0,
      (() => {
        const t = createProgram();
        return completeFrom(t, 'ok', (b) => ({
          instance: (b.existing as Record<string, unknown>[])[0].id as string,
        }));
      })(),
      (() => {
        let e = createProgram();
        e = put(e, 'sync-dependence-provider', id, {
          id,
          providerRef,
          handledLanguages,
        });
        e = put(e, 'plugin-registry', `dependence-provider:${id}`, {
          id: `dependence-provider:${id}`,
          pluginKind: 'dependence-provider',
          domain: 'sync',
          handledLanguages,
          providerRef,
          instanceId: id,
        });
        return complete(e, 'ok', { instance: id }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },
};

export const syncDependenceProviderHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetSyncDependenceProviderCounter(): void {
  idCounter = 0;
}
