// @migrated dsl-constructs 2026-03-18
// ============================================================
// ConceptDependenceProvider Handler
//
// Dependence analysis provider for .concept files. Extracts
// state field type references and capability requirements
// as dependency edges.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `concept-dependence-provider-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  initialize(input: Record<string, unknown>) {
    const id = nextId();
    const providerRef = `dependence-provider:concept`;
    const handledLanguages = 'concept';

    let p = createProgram();
    p = find(p, 'concept-dependence-provider', { providerRef }, 'existing');

    return branch(p,
      (bindings) => (bindings.existing as unknown[]).length > 0,
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>[];
        return { instance: existing[0].id as string };
      }),
      (elseP) => {
        elseP = put(elseP, 'concept-dependence-provider', id, {
          id,
          providerRef,
          handledLanguages,
        });
        elseP = put(elseP, 'plugin-registry', `dependence-provider:${id}`, {
          id: `dependence-provider:${id}`,
          pluginKind: 'dependence-provider',
          domain: 'concept',
          handledLanguages,
          providerRef,
          instanceId: id,
        });
        return complete(elseP, 'ok', { instance: id });
      },
    ) as StorageProgram<Result>;
  },
};

export const conceptDependenceProviderHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetConceptDependenceProviderCounter(): void {
  idCounter = 0;
}
