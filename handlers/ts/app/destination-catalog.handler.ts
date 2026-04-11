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
    p = find(p, 'destination', {}, 'allDestinations');
    p = mapBindings(p, (bindings) => {
      const destinations = (bindings.allDestinations as Array<Record<string, unknown>>) || [];
      // No registrations at all → notfound signal
      if (destinations.length === 0) return null;
      const found = destinations.find((d: any) => d.name === name);
      return found ?? '__no_match__';
    }, '_result');

    return branch(p, (bindings) => bindings._result !== null && bindings._result !== '__no_match__',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const d = bindings._result as Record<string, unknown>;
        return { destination: d.id as string, name: d.name as string, targetConcept: d.targetConcept as string, targetView: d.targetView as string, href: d.href as string, icon: d.icon as string, group: d.group as string };
      }),
      (b) => branch(b, (bindings) => bindings._result === null,
        (b2) => complete(b2, 'notfound', { name }),
        (b2) => complete(b2, 'ok', { destination: '', name, targetConcept: '', targetView: '', href: '', icon: '', group: '' }),
      ),
    ) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolveByHref(input: Record<string, unknown>) {
    const href = String(input.href ?? '');

    let p = createProgram();
    p = find(p, 'destination', {}, 'destinations');
    p = mapBindings(p, (bindings) => {
      const destinations = (bindings.destinations as Array<Record<string, unknown>>) || [];
      // No registrations at all → notfound signal
      if (destinations.length === 0) return null;
      const exact = destinations.find((d: any) => d.href === href);
      if (exact) return exact;
      const prefix = destinations
        .filter((d: any) => href.startsWith(d.href as string))
        .sort((a: any, b: any) => (b.href as string).length - (a.href as string).length);
      return prefix.length > 0 ? prefix[0] : '__no_match__';
    }, '_found');

    return branch(p, (bindings) => bindings._found !== null && bindings._found !== '__no_match__',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const d = bindings._found as Record<string, unknown>;
        return { destination: d.id as string, name: d.name as string, targetConcept: d.targetConcept as string, targetView: d.targetView as string, href: d.href as string, icon: d.icon as string, group: d.group as string };
      }),
      (b) => branch(b, (bindings) => bindings._found === null,
        (b2) => complete(b2, 'notfound', { href }),
        (b2) => complete(b2, 'ok', { destination: '', name: '', targetConcept: '', targetView: '', href, icon: '', group: '' }),
      ),
    ) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'destination', {}, 'destinations');
    return completeFrom(p, 'ok', (bindings) => {
      const destinations = ((bindings.destinations as Array<Record<string, unknown>>) || [])
        .map((d) => ({
          destination: d.id as string,
          id: d.id as string,
          name: d.name as string,
          targetConcept: d.targetConcept as string,
          targetView: d.targetView as string,
          href: d.href as string,
          icon: d.icon as string,
          group: d.group as string,
        }))
        .sort((a, b) => a.href.localeCompare(b.href));
      return { destinations: JSON.stringify(destinations) };
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const destinationCatalogHandler = autoInterpret(_destinationCatalogHandler);


export default destinationCatalogHandler;
