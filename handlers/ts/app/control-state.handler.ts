// @clef-handler style=functional
// ControlState Concept Implementation — Functional (StorageProgram) style
// Section 3.3: Reactive UI control state for sliders, dropdowns, date pickers, toggles.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, putFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _controlStateHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const control = input.control as string;
    const controlType = input.controlType as string;
    const defaultValue = input.defaultValue as string;
    const options = (input.options ?? null) as string | null;
    const personal = input.personal as boolean;

    if (!control || control.trim() === '') {
      return complete(createProgram(), 'error', { message: 'control identifier is required' }) as StorageProgram<Result>;
    }
    if (!controlType || controlType.trim() === '') {
      return complete(createProgram(), 'error', { message: 'controlType is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, 'controlState', control, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'duplicate', { message: `Control "${control}" already exists` }),
      (b) => {
        let b2 = put(b, 'controlState', control, {
          control,
          controlType,
          value: defaultValue,
          defaultValue,
          options: options !== null && options !== undefined ? options : '',
          hasOptions: options !== null && options !== undefined ? 'true' : 'false',
          personal: personal ? 'true' : 'false',
        });
        return complete(b2, 'ok', { control });
      },
    );
    return p as StorageProgram<Result>;
  },

  set(input: Record<string, unknown>) {
    const control = input.control as string;
    const value = input.value as string;

    if (value === '' || value === null || value === undefined) {
      return complete(createProgram(), 'invalid', { violations: 'value must not be empty' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, 'controlState', control, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'controlState', control, () => ({ value }));
        return completeFrom(b2, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return {
            previous: existing.value as string,
            current: value,
          };
        });
      },
      (b) => complete(b, 'notfound', { message: `Control "${control}" not found` }),
    );
    return p as StorageProgram<Result>;
  },

  reset(input: Record<string, unknown>) {
    const control = input.control as string;

    let p = createProgram();
    p = spGet(p, 'controlState', control, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'controlState', control, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { value: existing.defaultValue as string };
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { value: existing.defaultValue as string };
        });
      },
      (b) => complete(b, 'notfound', { message: `Control "${control}" not found` }),
    );
    return p as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const control = input.control as string;

    let p = createProgram();
    p = spGet(p, 'controlState', control, 'existing');
    p = branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>;
        const hasOptions = existing.hasOptions === 'true';
        const options = hasOptions && existing.options ? existing.options : null;
        return {
          value: existing.value as string,
          controlType: existing.controlType as string,
          options,
        };
      }),
      (b) => complete(b, 'notfound', { message: `Control "${control}" not found` }),
    );
    return p as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'controlState', {}, 'allControls');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allControls as Array<Record<string, unknown>>) || [];
      const controls = all.map((c) => ({
        control: c.control,
        controlType: c.controlType,
        value: c.value,
        defaultValue: c.defaultValue,
        personal: c.personal === 'true',
      }));
      return { controls: JSON.stringify(controls) };
    }) as StorageProgram<Result>;
  },

  remove(input: Record<string, unknown>) {
    const control = input.control as string;

    let p = createProgram();
    p = spGet(p, 'controlState', control, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = del(b, 'controlState', control);
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: `Control "${control}" not found` }),
    );
    return p as StorageProgram<Result>;
  },
};

export const controlStateHandler = autoInterpret(_controlStateHandler);
