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

const PROVIDER_REF = `dependence-provider:widget`;
const INSTANCE_ID = 'widget-dependence-provider-1';

const _handler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const handledLanguages = 'widget';

    let p = createProgram();
    p = find(p, 'widget-dependence-provider', { providerRef: PROVIDER_REF }, 'existing');

    return branch(p,
      (bindings) => (bindings.existing as unknown[]).length > 0,
      (thenP) => complete(thenP, 'loadError', { message: 'WidgetDependenceProvider already initialized' }),
      (elseP) => {
        elseP = put(elseP, 'widget-dependence-provider', INSTANCE_ID, {
          id: INSTANCE_ID,
          providerRef: PROVIDER_REF,
          handledLanguages,
        });
        elseP = put(elseP, 'plugin-registry', `dependence-provider:${INSTANCE_ID}`, {
          id: `dependence-provider:${INSTANCE_ID}`,
          pluginKind: 'dependence-provider',
          domain: 'widget',
          handledLanguages,
          providerRef: PROVIDER_REF,
          instanceId: INSTANCE_ID,
        });
        return complete(elseP, 'ok', { instance: INSTANCE_ID });
      },
    ) as StorageProgram<Result>;
  },
};

export const widgetDependenceProviderHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetWidgetDependenceProviderCounter(): void {
  idCounter = 0;
}
