// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ExposedFilter Concept Implementation
// Expose interactive filter and sort controls to end users,
// allowing them to modify query parameters through the UI.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _exposedFilterHandler: FunctionalConceptHandler = {
  expose(input: Record<string, unknown>) {
    if (!input.fieldName || (typeof input.fieldName === 'string' && (input.fieldName as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'fieldName is required' }) as StorageProgram<Result>;
    }
    const filter = input.filter as string;
    const fieldName = input.fieldName as string;
    const operator = input.operator as string;
    const defaultValue = input.defaultValue as string;

    let p = createProgram();
    p = spGet(p, 'exposedFilter', filter, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', { filter }),
      (b) => {
        let b2 = put(b, 'exposedFilter', filter, {
          filter,
          fieldName,
          operator,
          defaultValue,
          userInput: defaultValue,
        });
        return complete(b2, 'ok', { filter });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  collectInput(input: Record<string, unknown>) {
    if (!input.value || (typeof input.value === 'string' && (input.value as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'value is required' }) as StorageProgram<Result>;
    }
    const filter = input.filter as string;
    const value = input.value as string;

    let p = createProgram();
    p = spGet(p, 'exposedFilter', filter, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'exposedFilter', filter, { userInput: value });
        return complete(b2, 'ok', { filter });
      },
      (b) => complete(b, 'notfound', { filter }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  applyToQuery(input: Record<string, unknown>) {
    const filter = input.filter as string;

    let p = createProgram();
    p = spGet(p, 'exposedFilter', filter, 'record');
    p = branch(p, 'record',
      (b) => complete(b, 'ok', { queryMod: '' }),
      (b) => complete(b, 'notfound', { filter }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resetToDefaults(input: Record<string, unknown>) {
    const filter = input.filter as string;

    let p = createProgram();
    p = spGet(p, 'exposedFilter', filter, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'exposedFilter', filter, { userInput: '' });
        return complete(b2, 'ok', { filter });
      },
      (b) => complete(b, 'notfound', { filter }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const exposedFilterHandler = autoInterpret(_exposedFilterHandler);

