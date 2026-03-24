// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// BindingDependenceProvider Handler
//
// Dependence analysis provider for runtime data bindings.
// Computes the full binding chain: concept state field ->
// reactive signal -> widget prop, enabling impact analysis
// from schema changes to rendered UI.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, find, put, branch, complete, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `binding-dependence-provider-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  initialize(input: Record<string, unknown>) {
    const id = nextId();
    const providerRef = `dependence-provider:binding`;

    let p = createProgram();
    p = find(p, 'binding-dependence-provider', { providerRef }, 'existing');

    return branch(p,
      (bindings) => (bindings.existing as unknown[]).length > 0,
      (thenP) => complete(thenP, 'loadError', { message: 'BindingDependenceProvider already initialized' }),
      (elseP) => {
        elseP = put(elseP, 'binding-dependence-provider', id, {
          id,
          providerRef,
        });
        elseP = put(elseP, 'plugin-registry', `dependence-provider:${id}`, {
          id: `dependence-provider:${id}`,
          pluginKind: 'dependence-provider',
          domain: 'binding',
          providerRef,
          instanceId: id,
        });
        return complete(elseP, 'ok', { instance: id });
      },
    ) as StorageProgram<Result>;
  },
};

export const bindingDependenceProviderHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetBindingDependenceProviderCounter(): void {
  idCounter = 0;
}
