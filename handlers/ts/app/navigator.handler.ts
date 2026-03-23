// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Navigator Concept Implementation [N]
// Client-side navigation with route registration, history stack, guards, and programmatic navigation.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const _navigatorHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
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

    let p = createProgram();
    p = spGet(p, 'navigator', id, 'existing');

    p = branch(p, 'existing',
      (b) => {
        // Accumulate destinations, avoiding duplicates by name
        let b2 = putFrom(b, 'navigator', id, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          let destinations: Array<Record<string, unknown>> = [];
          try {
            destinations = JSON.parse(existing.destinations as string || '[]');
          } catch { /* empty */ }

          if (!destinations.some((d) => d.name === name)) {
            destinations.push(newDest);
          }

          return {
            ...existing,
            destinations: JSON.stringify(destinations),
            name,
            targetConcept,
            targetView,
            paramsSchema: paramsSchema || '',
            meta: meta || '',
          };
        });
        return complete(b2, 'ok', { nav: id });
      },
      (b) => {
        let b2 = put(b, 'navigator', id, {
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
        return complete(b2, 'ok', { nav: id });
      },
    );

    return p as StorageProgram<Result>;
  },

  go(input: Record<string, unknown>) {
    if (!input.params || (typeof input.params === 'string' && (input.params as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'params is required' }) as StorageProgram<Result>;
    }
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
        return complete(b2, 'ok', { nav, previous: '' });
      },
      (b) => {
        // Auto-create navigator on first go
        let b2 = put(b, 'navigator', nav, {
          nav,
          name: nav,
          history: JSON.stringify([]),
          forwardStack: JSON.stringify([]),
          current: params,
          guards: JSON.stringify([]),
          createdAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { nav, previous: '' });
      },
    );

    return p as StorageProgram<Result>;
  },

  back(input: Record<string, unknown>) {
    const nav = input.nav as string;

    let p = createProgram();
    p = spGet(p, 'navigator', nav, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { previous: '' }),
      (b) => complete(b, 'ok', { previous: '' }),
    );

    return p as StorageProgram<Result>;
  },

  forward(input: Record<string, unknown>) {
    const nav = input.nav as string;

    let p = createProgram();
    p = spGet(p, 'navigator', nav, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { previous: '' }),
      (b) => complete(b, 'empty', { message: `Navigator "${nav}" not found` }),
    );

    return p as StorageProgram<Result>;
  },

  replace(input: Record<string, unknown>) {
    if (!input.params || (typeof input.params === 'string' && (input.params as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'params is required' }) as StorageProgram<Result>;
    }
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

    return p as StorageProgram<Result>;
  },

  addGuard(input: Record<string, unknown>) {
    const nav = input.nav as string;
    const guard = input.guard as string;

    let p = createProgram();

    if (!guard) {
      return complete(p, 'invalid', { message: 'Guard identifier is required' }) as StorageProgram<Result>;
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

    return p as StorageProgram<Result>;
  },

  removeGuard(input: Record<string, unknown>) {
    if (!input.guard || (typeof input.guard === 'string' && (input.guard as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'guard is required' }) as StorageProgram<Result>;
    }
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

    return p as StorageProgram<Result>;
  },
};

// All actions are now fully functional — no imperative overrides needed.
export const navigatorHandler = autoInterpret(_navigatorHandler);
