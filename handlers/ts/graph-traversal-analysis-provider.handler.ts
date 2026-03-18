// @migrated dsl-constructs 2026-03-18
// ============================================================
// GraphTraversalAnalysisProvider Handler
//
// Analysis engine provider for graph reachability queries.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string { return `graph-traversal-analysis-provider-${++idCounter}`; }

const _handler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const id = nextId();
    const providerRef = `analysis-engine:graph-traversal`;
    const engineType = 'graph-traversal';

    let p = createProgram();
    p = find(p, 'graph-traversal-analysis-provider', { providerRef }, 'existing');

    return branch(p,
      (bindings) => (bindings.existing as unknown[]).length > 0,
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const existing = bindings.existing as Array<Record<string, unknown>>;
        return { instance: existing[0].id as string };
      }),
      (elseP) => {
        let p2 = put(elseP, 'graph-traversal-analysis-provider', id, { id, providerRef, engineType });
        p2 = put(p2, 'plugin-registry', `analysis-engine:${id}`, { id: `analysis-engine:${id}`, pluginKind: 'analysis-engine', engineType, providerRef, instanceId: id });
        return complete(p2, 'ok', { instance: id });
      },
    ) as StorageProgram<Result>;
  },
};

export const graphTraversalAnalysisProviderHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetGraphTraversalAnalysisProviderCounter(): void { idCounter = 0; }
