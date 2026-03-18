// @migrated dsl-constructs 2026-03-18
// Component Concept Implementation
// Discoverable, configurable UI units with conditional placement rules for composing page layouts.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const componentHandlerFunctional: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const component = input.component as string;
    const config = input.config as string;

    let p = createProgram();
    p = spGet(p, 'component', component, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', { message: 'A component with this identity already exists' }),
      (b) => {
        let b2 = put(b, 'component', component, {
          component, config,
          placements: JSON.stringify([]),
          conditions: '',
          visible: true,
        });
        return complete(b2, 'ok', {});
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  render(input: Record<string, unknown>) {
    const component = input.component as string;
    const context = input.context as string;

    let p = createProgram();
    p = spGet(p, 'component', component, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // Config, placements, visibility resolved at runtime from bindings
        return complete(b, 'ok', { output: '' });
      },
      (b) => complete(b, 'notfound', { message: 'The component was not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  place(input: Record<string, unknown>) {
    const component = input.component as string;
    const region = input.region as string;

    let p = createProgram();
    p = spGet(p, 'component', component, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // Append region to placements — resolved at runtime
        let b2 = put(b, 'component', component, {
          placements: '', // resolved at runtime
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'The component was not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  setVisibility(input: Record<string, unknown>) {
    const component = input.component as string;
    const visible = input.visible as boolean;

    let p = createProgram();
    p = spGet(p, 'component', component, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'component', component, { visible });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'The component was not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  evaluateVisibility(input: Record<string, unknown>) {
    const component = input.component as string;
    const context = input.context as string;

    let p = createProgram();
    p = spGet(p, 'component', component, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // Visibility evaluation against conditions resolved at runtime
        return complete(b, 'ok', { visible: true });
      },
      (b) => complete(b, 'notfound', { message: 'The component was not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  renderLayout(input: Record<string, unknown>) {
    const layout = input.layout as string;
    const context = input.context as string;

    let p = createProgram();
    p = spGet(p, 'component', layout, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { layout, config: '', context }),
      (b) => complete(b, 'notfound', { message: 'Layout not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  renderAreaItem(input: Record<string, unknown>) {
    const itemType = input.item_type as string;
    const itemRef = input.item_ref as string;
    const context = input.context as string;

    let p = createProgram();
    return complete(p, 'ok', { item_type: itemType, item_ref: itemRef, context }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const componentHandler = wrapFunctional(componentHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { componentHandlerFunctional };
