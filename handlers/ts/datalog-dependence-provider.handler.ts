// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// DatalogDependenceProvider Handler
//
// Dependence analysis provider using Datalog for declarative
// analysis from extracted program facts. Wraps a Datalog
// evaluation engine for fixpoint computation over dependency
// relations.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `datalog-dependence-provider-${++idCounter}`;
}

type Result = { variant: string; [key: string]: unknown };

const _datalogDependenceProviderHandler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const providerRef = `dependence-provider:datalog`;

    let p = createProgram();
    p = find(p, 'datalog-dependence-provider', { providerRef }, 'existing');
    p = mapBindings(p, (bindings) => {
      const results = (bindings.existing as Array<Record<string, unknown>>) || [];
      return results.length;
    }, 'existingCount');

    p = branch(p, 'existingCount',
      // Already registered — return existing instance
      (b) => completeFrom(b, 'ok', (bindings) => {
        const results = bindings.existing as Array<Record<string, unknown>>;
        return { instance: results[0].id as string };
      }),
      // Register new provider
      (b) => {
        const id = nextId();
        let b2 = put(b, 'datalog-dependence-provider', id, {
          id,
          providerRef,
        });
        b2 = put(b2, 'plugin-registry', `dependence-provider:${id}`, {
          id: `dependence-provider:${id}`,
          pluginKind: 'dependence-provider',
          domain: 'datalog',
          providerRef,
          instanceId: id,
        });
        return complete(b2, 'ok', { instance: id });
      },
    );

    return p as StorageProgram<Result>;
  },
};

export const datalogDependenceProviderHandler = autoInterpret(_datalogDependenceProviderHandler);

/** Reset the ID counter. Useful for testing. */
export function resetDatalogDependenceProviderCounter(): void {
  idCounter = 0;
}
