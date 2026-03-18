// @migrated dsl-constructs 2026-03-18
// Navigator Concept Implementation [N]
// Client-side navigation with route registration, history stack, guards, and programmatic navigation.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const navigatorHandlerFunctional: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const nav = input.nav as string;
    const name = input.name as string;
    const targetConcept = input.targetConcept as string;
    const targetView = input.targetView as string;
    const paramsSchema = input.paramsSchema as string;
    const meta = input.meta as string;

    const id = nav || nextId('N');

    let p = createProgram();
    p = spGet(p, 'navigator', id, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // Update existing navigator with new destination
        let b2 = put(b, 'navigator', id, {
          name,
          targetConcept,
          targetView,
          paramsSchema: paramsSchema || '',
          meta: meta || '',
        });
        return complete(b2, 'ok', { nav: id });
      },
      (b) => {
        let b2 = put(b, 'navigator', id, {
          destinations: JSON.stringify([{
            name,
            targetConcept,
            targetView,
            paramsSchema: paramsSchema || '',
            meta: meta || '',
          }]),
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

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
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

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const navigatorHandler = wrapFunctional(navigatorHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { navigatorHandlerFunctional };
