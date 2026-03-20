// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// TypeScriptDependenceProvider Handler
//
// Dependence analysis provider for TypeScript and TSX files.
// Uses the TypeScript compiler API for type-aware data and
// control dependency extraction.
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
  return `type-script-dependence-provider-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const id = nextId();
    const providerRef = `dependence-provider:typescript`;
    const handledLanguages = 'typescript,tsx';

    let p = createProgram();
    p = find(p, 'type-script-dependence-provider', { providerRef }, 'existing');

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
        e = put(e, 'type-script-dependence-provider', id, {
          id,
          providerRef,
          handledLanguages,
        });
        e = put(e, 'plugin-registry', `dependence-provider:${id}`, {
          id: `dependence-provider:${id}`,
          pluginKind: 'dependence-provider',
          domain: 'typescript',
          handledLanguages,
          providerRef,
          instanceId: id,
        });
        return complete(e, 'ok', { instance: id }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },
};

export const typeScriptDependenceProviderHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetTypeScriptDependenceProviderCounter(): void {
  idCounter = 0;
}
