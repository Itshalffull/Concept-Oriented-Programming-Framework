// @migrated dsl-constructs 2026-03-18
// ============================================================
// PatternMatchAnalysisProvider Handler
//
// Analysis engine provider for structural pattern matching.
// Delegates to StructuralPattern for AST-level pattern queries,
// enabling code smell detection and convention enforcement.
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
  return `pattern-match-analysis-provider-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const id = nextId();
    const providerRef = `analysis-engine:pattern-match`;
    const engineType = 'pattern-match';

    let p = createProgram();
    p = find(p, 'pattern-match-analysis-provider', { providerRef }, 'existing');

    return branch(p,
      (bindings) => (bindings.existing as Record<string, unknown>[]).length > 0,
      (bp) => completeFrom(bp, 'ok', (bindings) => ({
        instance: (bindings.existing as Record<string, unknown>[])[0].id as string,
      })),
      (bp) => {
        let bp2 = put(bp, 'pattern-match-analysis-provider', id, {
          id, providerRef, engineType,
        });
        bp2 = put(bp2, 'plugin-registry', `analysis-engine:${id}`, {
          id: `analysis-engine:${id}`,
          pluginKind: 'analysis-engine',
          engineType, providerRef, instanceId: id,
        });
        return complete(bp2, 'ok', { instance: id });
      },
    ) as StorageProgram<Result>;
  },
};

export const patternMatchAnalysisProviderHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetPatternMatchAnalysisProviderCounter(): void {
  idCounter = 0;
}
