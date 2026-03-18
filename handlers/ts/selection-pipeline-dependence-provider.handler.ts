// @migrated dsl-constructs 2026-03-18
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
  createProgram, find, put, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `selection-pipeline-dependence-provider-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  initialize(input: Record<string, unknown>) {
    const providerRef = `dependence-provider:selection-pipeline`;

    let p = createProgram();
    p = find(p, 'selection-pipeline-dependence-provider', { providerRef }, 'existing');

    return completeFrom(p, 'ok', (bindings) => {
      const existing = bindings.existing as Record<string, unknown>[];
      if (existing.length > 0) {
        return { instance: existing[0].id as string };
      }

      const id = nextId();
      return { instance: id };
    }) as StorageProgram<Result>;
  },
};

export const selectionPipelineDependenceProviderHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetSelectionPipelineDependenceProviderCounter(): void {
  idCounter = 0;
}
