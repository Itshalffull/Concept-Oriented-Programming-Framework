// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Navigator Concept Implementation [N]
// Client-side navigation with route registration, history stack, guards, and programmatic navigation.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import type { ConceptStorage } from '../../../runtime/types.ts';
import {
  createProgram, get as spGet, put, putFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const _navigatorHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    // Placeholder — overridden by imperative implementation below
    const p = createProgram();
    return complete(p, 'ok', {}) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  go(input: Record<string, unknown>) {
    const nav = input.nav as string;
    const params = input.params as string;

    let p = createProgram();
    p = spGet(p, 'navigator', nav, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'navigator', nav, {
          current: params,
          forwardStack: JSON.stringify([]),
        });
        return complete(b2, 'ok', { previous: '' });
      },
      (b) => complete(b, 'notfound', { message: `Navigator "${nav}" not found` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  back(input: Record<string, unknown>) {
    const nav = input.nav as string;

    let p = createProgram();
    p = spGet(p, 'navigator', nav, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { previous: '' }),
      (b) => complete(b, 'empty', { message: `Navigator "${nav}" not found` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  forward(input: Record<string, unknown>) {
    const nav = input.nav as string;

    let p = createProgram();
    p = spGet(p, 'navigator', nav, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { previous: '' }),
      (b) => complete(b, 'empty', { message: `Navigator "${nav}" not found` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  replace(input: Record<string, unknown>) {
    const nav = input.nav as string;
    const params = input.params as string;

    let p = createProgram();
    p = spGet(p, 'navigator', nav, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'navigator', nav, { current: params });
        return complete(b2, 'ok', { previous: '' });
      },
      (b) => complete(b, 'notfound', { message: `Navigator "${nav}" not found` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  addGuard(input: Record<string, unknown>) {
    const nav = input.nav as string;
    const guard = input.guard as string;

    let p = createProgram();

    if (!guard) {
      return complete(p, 'invalid', { message: 'Guard identifier is required' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    p = spGet(p, 'navigator', nav, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'navigator', nav, {
          guards: JSON.stringify([guard]),
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'invalid', { message: `Navigator "${nav}" not found` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  removeGuard(input: Record<string, unknown>) {
    const nav = input.nav as string;
    const guard = input.guard as string;

    let p = createProgram();
    p = spGet(p, 'navigator', nav, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'navigator', nav, {
          guards: JSON.stringify([]),
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: `Navigator "${nav}" not found` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

const _base = autoInterpret(_navigatorHandler);

// register needs to accumulate destinations in an existing navigator record,
// requiring read-modify-write with a dynamic key. Override with imperative impl.
async function _register(input: Record<string, unknown>, storage: ConceptStorage) {
  const nav = input.nav as string;
  const name = input.name as string;
  const targetConcept = input.targetConcept as string;
  const targetView = input.targetView as string;
  const paramsSchema = input.paramsSchema as string;
  const meta = input.meta as string;

  const id = nav || nextId('N');
  const newDest = {
    name,
    targetConcept,
    targetView,
    paramsSchema: paramsSchema || '',
    meta: meta || '',
  };

  const existing = await storage.get('navigator', id);
  if (existing) {
    let destinations: Array<Record<string, unknown>> = [];
    try {
      destinations = JSON.parse(existing.destinations as string || '[]');
    } catch { /* empty */ }

    // Avoid duplicate destinations by name
    if (!destinations.some((d) => d.name === name)) {
      destinations.push(newDest);
    }

    await storage.put('navigator', id, {
      ...existing,
      destinations: JSON.stringify(destinations),
      name,
      targetConcept,
      targetView,
      paramsSchema: paramsSchema || '',
      meta: meta || '',
    });
  } else {
    await storage.put('navigator', id, {
      destinations: JSON.stringify([newDest]),
      name,
      targetConcept,
      targetView,
      paramsSchema: paramsSchema || '',
      meta: meta || '',
      current: '',
      history: JSON.stringify([]),
      forwardStack: JSON.stringify([]),
      guards: JSON.stringify([]),
    });
  }

  return { variant: 'ok', nav: id };
}

export const navigatorHandler = new Proxy(_base, {
  get(target, prop: string) {
    if (prop === 'register') return _register;
    return (target as Record<string, unknown>)[prop];
  },
}) as typeof _base;

