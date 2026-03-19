// @migrated dsl-constructs 2026-03-18
// Control Concept Implementation
// Bind interactive elements (buttons, sliders, toggles) to data values and actions,
// enabling direct manipulation in content.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _controlHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const control = input.control as string;
    const type = input.type as string;
    const binding = input.binding as string;

    let p = createProgram();
    p = spGet(p, 'control', control, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', { message: 'A control with this identity already exists' }),
      (b) => {
        let b2 = put(b, 'control', control, {
          control, type, value: '', binding, action: '',
        });
        return complete(b2, 'ok', {});
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  interact(input: Record<string, unknown>) {
    const control = input.control as string;
    const interactionInput = input.input as string;

    let p = createProgram();
    p = spGet(p, 'control', control, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'control', control, { value: interactionInput });
        return completeFrom(b2, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { result: `${existing.type}:${existing.binding}:${interactionInput}` };
        });
      },
      (b) => complete(b, 'notfound', { message: 'The control was not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getValue(input: Record<string, unknown>) {
    const control = input.control as string;

    let p = createProgram();
    p = spGet(p, 'control', control, 'existing');
    p = branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { value: (existing.value as string) || '' };
        }),
      (b) => complete(b, 'notfound', { message: 'The control was not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  setValue(input: Record<string, unknown>) {
    const control = input.control as string;
    const value = input.value as string;

    let p = createProgram();
    p = spGet(p, 'control', control, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'control', control, { value });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'The control was not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  triggerAction(input: Record<string, unknown>) {
    const control = input.control as string;

    let p = createProgram();
    p = spGet(p, 'control', control, 'existing');
    p = branch(p, 'existing',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { result: `${existing.type}:${existing.binding}:${existing.action}:${existing.value}` };
        });
      },
      (b) => complete(b, 'notfound', { message: 'The control was not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const controlHandler = autoInterpret(_controlHandler);

