// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// UniversalTreeSitterDependenceProvider Handler
//
// Fallback dependence analysis provider using generic Tree-sitter
// queries. Provides basic import and call analysis for any
// language with a Tree-sitter grammar.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `universal-tree-sitter-dependence-provider-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const id = nextId();
    const providerRef = `dependence-provider:universal-tree-sitter`;

    let p = createProgram();
    p = find(p, 'universal-tree-sitter-dependence-provider', { providerRef }, 'existing');

    return branch(p,
      (bindings) => (bindings.existing as unknown[]).length > 0,
      (thenP) => completeFrom(thenP, 'ok', (bindings) => ({
        instance: (bindings.existing as Record<string, unknown>[])[0].id as string,
      })),
      (elseP) => {
        elseP = put(elseP, 'universal-tree-sitter-dependence-provider', id, {
          id,
          providerRef,
        });
        elseP = put(elseP, 'plugin-registry', `dependence-provider:${id}`, {
          id: `dependence-provider:${id}`,
          pluginKind: 'dependence-provider',
          domain: 'universal',
          fallback: true,
          providerRef,
          instanceId: id,
        });
        return complete(elseP, 'ok', { instance: id });
      },
    ) as StorageProgram<Result>;
  },
};

export const universalTreeSitterDependenceProviderHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetUniversalTreeSitterDependenceProviderCounter(): void {
  idCounter = 0;
}
