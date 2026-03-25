// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-25
// ============================================================
// SelectionPipelineDependenceProvider Handler
//
// Cross-system dependence analysis provider for the Clef Surface
// selection pipeline. Computes the full dependency chain:
// concept state field -> interactor classification -> affordance
// matching -> widget resolution.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `selection-pipeline-dependence-provider-${++idCounter}`;
}

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const providerRef = `dependence-provider:selection-pipeline`;

    let p = createProgram();
    p = find(p, 'selection-pipeline-dependence-provider', { providerRef }, 'existing');

    return branch(p,
      (b) => (b.existing as unknown[]).length > 0,
      (b) => completeFrom(b, 'ok', (bindings) => {
        const existingId = ((bindings.existing as Record<string, unknown>[])[0].id as string);
        return { instance: existingId, output: { instance: existingId } };
      }) as StorageProgram<Result>,
      (b) => {
        const id = nextId();
        let b2 = put(b, 'selection-pipeline-dependence-provider', id, {
          id,
          providerRef,
        });
        b2 = put(b2, 'plugin-registry', `dependence-provider:${id}`, {
          pluginKind: 'dependence-provider',
          domain: 'selection-pipeline',
          instanceId: id,
        });
        return complete(b2, 'ok', { instance: id, output: { instance: id } }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },
};

export const selectionPipelineDependenceProviderHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetSelectionPipelineDependenceProviderCounter(): void {
  idCounter = 0;
}
