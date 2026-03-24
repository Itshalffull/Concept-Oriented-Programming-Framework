// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// ThemeDependenceProvider Handler
//
// Dependence analysis provider for .theme files. Computes
// extends -> parent theme, role -> palette color, and token
// reference chain dependency edges.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, find, put, complete,
  branch, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `theme-dependence-provider-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const id = nextId();
    const providerRef = `dependence-provider:theme`;
    const handledLanguages = 'theme';

    let p = createProgram();
    p = find(p, 'theme-dependence-provider', { providerRef }, 'existing');

    return branch(p,
      (b) => (b.existing as unknown[]).length > 0,
      (() => {
        const t = createProgram();
        return complete(t, 'loadError', { message: 'ThemeDependenceProvider already initialized' });
      })(),
      (() => {
        let e = createProgram();
        e = put(e, 'theme-dependence-provider', id, {
          id,
          providerRef,
          handledLanguages,
        });
        e = put(e, 'plugin-registry', `dependence-provider:${id}`, {
          id: `dependence-provider:${id}`,
          pluginKind: 'dependence-provider',
          domain: 'theme',
          handledLanguages,
          providerRef,
          instanceId: id,
        });
        return complete(e, 'ok', { instance: id }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },
};

export const themeDependenceProviderHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetThemeDependenceProviderCounter(): void {
  idCounter = 0;
}
