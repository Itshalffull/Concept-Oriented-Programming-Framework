// @migrated dsl-constructs 2026-03-18
// Element Concept Implementation [E]
// UI elements with kind classification, nesting, constraints, interactors, and widget assignment.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const VALID_KINDS = ['field', 'group', 'layout', 'action', 'display', 'container', 'slot'];

const elementHandlerFunctional: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const element = input.element as string;
    const kind = input.kind as string;
    const label = input.label as string;
    const dataType = input.dataType as string;

    if (!VALID_KINDS.includes(kind)) {
      const p = createProgram();
      return complete(p, 'invalid', { message: `Invalid element kind "${kind}". Valid kinds: ${VALID_KINDS.join(', ')}` }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const id = element || nextId('E');

    let p = createProgram();
    p = put(p, 'element', id, {
      kind,
      label,
      description: '',
      dataType: dataType || '',
      required: false,
      constraints: JSON.stringify({}),
      children: JSON.stringify([]),
      parent: '',
      interactorType: '',
      interactorProps: JSON.stringify({}),
      resolvedWidget: '',
    });

    return complete(p, 'ok', { element: id }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  nest(input: Record<string, unknown>) {
    const parent = input.parent as string;
    const child = input.child as string;

    // Prevent circular nesting
    if (parent === child) {
      const p = createProgram();
      return complete(p, 'invalid', { message: 'Cannot nest an element into itself' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let p = createProgram();
    p = spGet(p, 'element', parent, 'parentEl');
    p = branch(p, 'parentEl',
      (b) => {
        let b2 = spGet(b, 'element', child, 'childEl');
        b2 = branch(b2, 'childEl',
          (c) => {
            // Both exist — update parent's children and child's parent
            let c2 = put(c, 'element', parent, { children: JSON.stringify([child]) });
            c2 = put(c2, 'element', child, { parent });
            return complete(c2, 'ok', {});
          },
          (c) => complete(c, 'invalid', { message: `Child element "${child}" not found` }),
        );
        return b2;
      },
      (b) => complete(b, 'invalid', { message: `Parent element "${parent}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  setConstraints(input: Record<string, unknown>) {
    const element = input.element as string;
    const constraints = input.constraints as string;

    let p = createProgram();
    p = spGet(p, 'element', element, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'element', element, {
          constraints: typeof constraints === 'string' ? constraints : JSON.stringify(constraints),
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: `Element "${element}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  enrich(input: Record<string, unknown>) {
    const element = input.element as string;
    const interactorType = input.interactorType as string;
    const interactorProps = input.interactorProps as string;

    let p = createProgram();
    p = spGet(p, 'element', element, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'element', element, {
          interactorType,
          interactorProps: typeof interactorProps === 'string' ? interactorProps : JSON.stringify(interactorProps),
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: `Element "${element}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  assignWidget(input: Record<string, unknown>) {
    const element = input.element as string;
    const widget = input.widget as string;

    let p = createProgram();
    p = spGet(p, 'element', element, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'element', element, { resolvedWidget: widget });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: `Element "${element}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  remove(input: Record<string, unknown>) {
    const element = input.element as string;

    let p = createProgram();
    p = spGet(p, 'element', element, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // Mark as deleted
        let b2 = put(b, 'element', element, { _deleted: true });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: `Element "${element}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const elementHandler = wrapFunctional(elementHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { elementHandlerFunctional };
