// @clef-handler style=functional
// ProcessVariable Concept Implementation
// Store typed, scoped data within process runs that steps can read and write.
// Supports explicit merge strategies for parallel branch convergence.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, branch, complete, completeFrom, putFrom,
  mapBindings, del,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `pvar-${Date.now()}-${++idCounter}`;
}

function applyMergeStrategy(
  existingValue: string,
  update: string,
  strategy: string,
  valueType: string,
): { success: boolean; merged?: string; message?: string } {
  try {
    switch (strategy) {
      case 'replace':
        return { success: true, merged: update };
      case 'append': {
        const existing = JSON.parse(existingValue);
        const updateVal = JSON.parse(update);
        const merged = Array.isArray(existing)
          ? [...existing, ...(Array.isArray(updateVal) ? updateVal : [updateVal])]
          : [existing, updateVal];
        return { success: true, merged: JSON.stringify(merged) };
      }
      case 'sum': {
        const a = Number(existingValue);
        const b = Number(update);
        if (isNaN(a) || isNaN(b)) {
          return { success: false, message: 'sum strategy requires numeric values' };
        }
        return { success: true, merged: String(a + b) };
      }
      case 'max': {
        const a = Number(existingValue);
        const b = Number(update);
        if (isNaN(a) || isNaN(b)) {
          return { success: false, message: 'max strategy requires numeric values' };
        }
        return { success: true, merged: String(Math.max(a, b)) };
      }
      case 'min': {
        const a = Number(existingValue);
        const b = Number(update);
        if (isNaN(a) || isNaN(b)) {
          return { success: false, message: 'min strategy requires numeric values' };
        }
        return { success: true, merged: String(Math.min(a, b)) };
      }
      default:
        return { success: true, merged: update };
    }
  } catch {
    return { success: false, message: `Merge strategy '${strategy}' failed` };
  }
}

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'process-variable', '__registered', 'existing');
    return branch(p, 'existing',
      (b) => complete(b, 'already_registered', { name: 'ProcessVariable' }),
      (b) => {
        let b2 = put(b, 'process-variable', '__registered', { value: true });
        return complete(b2, 'ok', { name: 'ProcessVariable' });
      },
    ) as StorageProgram<Result>;
  },

  set(input: Record<string, unknown>) {
    const runRef = input.run_ref as string;
    const name = input.name as string;
    const value = input.value as string;
    const valueType = input.value_type as string;
    const scope = input.scope as string;

    if (!runRef || runRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'run_ref is required' }) as StorageProgram<Result>;
    }

    const compositeKey = `${runRef}:${name}`;
    const id = nextId();
    let p = createProgram();
    p = get(p, 'process-variable', compositeKey, 'existingVar');
    return branch(p, 'existingVar',
      (b) => {
        // Variable exists - update or apply merge strategy
        let b2 = putFrom(b, 'process-variable', compositeKey, (bindings) => {
          const rec = bindings.existingVar as Record<string, unknown>;
          const mergeStrategy = rec.merge_strategy as string | null;
          if (mergeStrategy) {
            const result = applyMergeStrategy(rec.value as string, value, mergeStrategy, valueType);
            if (result.success) {
              return { ...rec, value: result.merged, value_type: valueType };
            }
          }
          return { ...rec, value, value_type: valueType, scope };
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const rec = bindings.existingVar as Record<string, unknown>;
          return { var: rec.id as string || compositeKey };
        });
      },
      (b) => {
        // New variable
        let b2 = put(b, 'process-variable', compositeKey, {
          id,
          run_ref: runRef,
          name,
          value,
          value_type: valueType,
          scope,
          merge_strategy: (input.merge_strategy as string) || null,
        });
        return complete(b2, 'ok', { var: id });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const runRef = input.run_ref as string;
    const name = input.name as string;

    if (!runRef || runRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'run_ref is required' }) as StorageProgram<Result>;
    }

    const compositeKey = `${runRef}:${name}`;
    let p = createProgram();
    p = get(p, 'process-variable', compositeKey, 'existing');
    return branch(p, 'existing',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return {
            var: rec.id as string || compositeKey,
            value: rec.value as string,
            value_type: rec.value_type as string,
          };
        });
      },
      (b) => complete(b, 'not_found', { run_ref: runRef, name }),
    ) as StorageProgram<Result>;
  },

  merge(input: Record<string, unknown>) {
    const runRef = input.run_ref as string;
    const name = input.name as string;
    const update = input.update as string;
    const strategy = input.strategy as string;

    if (!runRef || runRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'run_ref is required' }) as StorageProgram<Result>;
    }

    const compositeKey = `${runRef}:${name}`;
    let p = createProgram();
    p = get(p, 'process-variable', compositeKey, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'process-variable', compositeKey, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const result = applyMergeStrategy(rec.value as string, update, strategy, rec.value_type as string);
          if (result.success) {
            return { ...rec, value: result.merged };
          }
          // On failure, keep original value; the completion variant will indicate error
          return rec;
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const result = applyMergeStrategy(rec.value as string, update, strategy, rec.value_type as string);
          if (!result.success) {
            return { message: result.message };
          }
          return {
            var: rec.id as string || compositeKey,
            merged_value: result.merged,
          };
        });
      },
      (b) => complete(b, 'not_found', { run_ref: runRef, name }),
    ) as StorageProgram<Result>;
  },

  delete(input: Record<string, unknown>) {
    const runRef = input.run_ref as string;
    const name = input.name as string;

    const compositeKey = `${runRef}:${name}`;
    let p = createProgram();
    p = get(p, 'process-variable', compositeKey, 'existing');
    return branch(p, 'existing',
      (b) => {
        let b2 = del(b, 'process-variable', compositeKey);
        return complete(b2, 'ok', { run_ref: runRef, name });
      },
      (b) => complete(b, 'not_found', { run_ref: runRef, name }),
    ) as StorageProgram<Result>;
  },

  list(input: Record<string, unknown>) {
    const runRef = input.run_ref as string;
    let p = createProgram();
    p = find(p, 'process-variable', { run_ref: runRef }, 'allVars');
    return completeFrom(p, 'ok', (bindings) => {
      const vars = bindings.allVars as Array<Record<string, unknown>> || [];
      return { variables: JSON.stringify(vars) };
    }) as StorageProgram<Result>;
  },

  snapshot(input: Record<string, unknown>) {
    const runRef = input.run_ref as string;
    let p = createProgram();
    p = find(p, 'process-variable', { run_ref: runRef }, 'allVars');
    return completeFrom(p, 'ok', (bindings) => {
      const vars = bindings.allVars as Array<Record<string, unknown>> || [];
      const snapshot = vars.map((v) => ({
        name: v.name,
        value: v.value,
        value_type: v.value_type,
        scope: v.scope,
        merge_strategy: v.merge_strategy,
      }));
      return { snapshot: JSON.stringify(snapshot) };
    }) as StorageProgram<Result>;
  },
};

export const processVariableHandler = autoInterpret(_handler);
