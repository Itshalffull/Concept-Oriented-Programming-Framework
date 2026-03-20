// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// DatalogAnalysisProvider Handler
//
// Analysis engine provider for Datalog-based rules. Evaluates
// Datalog programs over extracted program facts to derive
// analysis findings via fixpoint computation.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `datalog-analysis-provider-${++idCounter}`;
}

type Result = { variant: string; [key: string]: unknown };

const _datalogAnalysisProviderHandler: FunctionalConceptHandler = {
  initialize(input: Record<string, unknown>) {
    const providerRef = `analysis-engine:datalog`;
    const engineType = 'datalog';

    let p = createProgram();
    // Check if already registered
    p = find(p, 'datalog-analysis-provider', { providerRef }, 'existing');
    p = mapBindings(p, (bindings) => {
      const results = (bindings.existing as Array<Record<string, unknown>>) || [];
      return results.length;
    }, 'existingCount');

    p = branch(p,
      (bindings) => (bindings.existingCount as number) > 0,
      (b) => completeFrom(b, 'ok', (bindings) => {
        const results = (bindings.existing as Array<Record<string, unknown>>) || [];
        return { instance: results[0].id as string };
      }),
      (b) => {
        const id = nextId();
        let b2 = put(b, 'datalog-analysis-provider', id, {
          id,
          providerRef,
          engineType,
        });
        b2 = put(b2, 'plugin-registry', `analysis-engine:${id}`, {
          id: `analysis-engine:${id}`,
          pluginKind: 'analysis-engine',
          engineType,
          providerRef,
          instanceId: id,
        });
        return complete(b2, 'ok', { instance: id });
      },
    );
    return p as StorageProgram<Result>;
  },
};

export const datalogAnalysisProviderHandler = autoInterpret(_datalogAnalysisProviderHandler);

/** Reset the ID counter. Useful for testing. */
export function resetDatalogAnalysisProviderCounter(): void {
  idCounter = 0;
}
