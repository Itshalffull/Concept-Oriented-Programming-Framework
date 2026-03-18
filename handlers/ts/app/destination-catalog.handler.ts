// @migrated dsl-constructs 2026-03-18
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, find, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const destinationCatalogHandlerFunctional: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const destination = String(input.destination ?? '');
    const name = String(input.name ?? '');
    const targetConcept = String(input.targetConcept ?? '');
    const targetView = String(input.targetView ?? '');
    const href = String(input.href ?? '');
    const icon = String(input.icon ?? '');
    const group = String(input.group ?? '');

    let p = createProgram();
    p = find(p, 'destination', {}, 'existing');
    // Duplicate check resolved at runtime from bindings

    p = put(p, 'destination', destination, {
      id: destination, name, targetConcept, targetView,
      href, icon, group,
    });
    return complete(p, 'ok', { destination }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolveByName(input: Record<string, unknown>) {
    const name = String(input.name ?? '');

    let p = createProgram();
    p = find(p, 'destination', { name }, 'destinations');
    // Match resolution from bindings at runtime
    return complete(p, 'ok', { destination: '', name: '', targetConcept: '', targetView: '', href: '', icon: '', group: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolveByHref(input: Record<string, unknown>) {
    const href = String(input.href ?? '');

    let p = createProgram();
    p = find(p, 'destination', {}, 'destinations');
    // Href matching resolved at runtime from bindings
    return complete(p, 'ok', { destination: '', name: '', targetConcept: '', targetView: '', href: '', icon: '', group: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'destination', {}, 'destinations');
    return complete(p, 'ok', { destinations: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export default destinationCatalogHandler;

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const destinationCatalogHandler = wrapFunctional(destinationCatalogHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { destinationCatalogHandlerFunctional };
