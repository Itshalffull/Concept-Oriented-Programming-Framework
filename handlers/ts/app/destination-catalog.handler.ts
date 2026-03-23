// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, find, put, complete, completeFrom, mapBindings, branch,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _destinationCatalogHandler: FunctionalConceptHandler = {
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
    p = mapBindings(p, (bindings) => {
      const destinations = (bindings.destinations as Array<Record<string, unknown>>) || [];
      return destinations.length > 0 ? destinations[0] : null;
    }, '_found');

    return branch(p, '_found',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const d = bindings._found as Record<string, unknown>;
        return { destination: d.id as string, name: d.name as string, targetConcept: d.targetConcept as string, targetView: d.targetView as string, href: d.href as string, icon: d.icon as string, group: d.group as string };
      }),
      (b) => complete(b, 'notfound', { name }),
    ) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolveByHref(input: Record<string, unknown>) {
    const href = String(input.href ?? '');

    let p = createProgram();
    p = find(p, 'destination', {}, 'destinations');
    p = mapBindings(p, (bindings) => {
      const destinations = (bindings.destinations as Array<Record<string, unknown>>) || [];
      const exact = destinations.find((d: any) => d.href === href);
      if (exact) return exact;
      const prefix = destinations
        .filter((d: any) => href.startsWith(d.href as string))
        .sort((a: any, b: any) => (b.href as string).length - (a.href as string).length);
      return prefix.length > 0 ? prefix[0] : null;
    }, '_found');

    return branch(p, '_found',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const d = bindings._found as Record<string, unknown>;
        return { destination: d.id as string, name: d.name as string, targetConcept: d.targetConcept as string, targetView: d.targetView as string, href: d.href as string, icon: d.icon as string, group: d.group as string };
      }),
      (b) => complete(b, 'notfound', { href }),
    ) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'destination', {}, 'destinations');
    return complete(p, 'ok', { destinations: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const destinationCatalogHandler = autoInterpret(_destinationCatalogHandler);


export default destinationCatalogHandler;
