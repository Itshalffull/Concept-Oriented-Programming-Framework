// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// WidgetDependenceProvider Handler
//
// Dependence analysis provider for .widget files. Computes
// compose -> composed widget, connect -> prop -> anatomy part,
// and affordance -> interactor dependency edges.
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
  return `widget-dependence-provider-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const id = nextId();
    const providerRef = `dependence-provider:widget`;
    const handledLanguages = 'widget';

    let p = createProgram();
    p = find(p, 'widget-dependence-provider', { providerRef }, 'existing');

    return branch(p,
      (bindings) => (bindings.existing as unknown[]).length > 0,
      (thenP) => completeFrom(thenP, 'ok', (bindings) => ({
        instance: (bindings.existing as Record<string, unknown>[])[0].id as string,
      })),
      (elseP) => {
        elseP = put(elseP, 'widget-dependence-provider', id, {
          id,
          providerRef,
          handledLanguages,
        });
        elseP = put(elseP, 'plugin-registry', `dependence-provider:${id}`, {
          id: `dependence-provider:${id}`,
          pluginKind: 'dependence-provider',
          domain: 'widget',
          handledLanguages,
          providerRef,
          instanceId: id,
        });
        return complete(elseP, 'ok', { instance: id });
      },
    ) as StorageProgram<Result>;
  },
};

export const widgetDependenceProviderHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetWidgetDependenceProviderCounter(): void {
  idCounter = 0;
}
