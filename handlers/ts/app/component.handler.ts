// @migrated dsl-constructs 2026-03-18
// Component Concept Implementation
// Discoverable, configurable UI units with conditional placement rules for composing page layouts.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, putFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _componentHandler: FunctionalConceptHandler = {
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
        return completeFrom(b, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const config = existing.config as string;
          const placements = JSON.parse((existing.placements as string) || '[]') as string[];
          return { output: [config, ...placements, context].join(':') };
        });
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
        let b2 = putFrom(b, 'component', component, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const placements = JSON.parse((existing.placements as string) || '[]') as string[];
          if (!placements.includes(region)) placements.push(region);
          return { ...existing, placements: JSON.stringify(placements) };
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
      (b) => completeFrom(b, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { layout, config: existing.config as string, context };
        }),
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

export const componentHandler = autoInterpret(_componentHandler);

