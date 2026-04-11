// @clef-handler style=functional
// SchemaUsage Concept Implementation
// Tracks where schema fields are referenced across the system for safe destructive operations.
// See schema-editor-plan.md §1.3, §9.4 for design rationale.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// Composite key: "<field>::<usageRef>"
function usageKey(field: string, usageRef: string): string {
  return `${field}::${usageRef}`;
}

const _schemaUsageHandler: FunctionalConceptHandler = {

  register(input: Record<string, unknown>) {
    const field = (input.field as string | undefined) ?? '';
    const usageType = (input.usageType as string | undefined) ?? '';
    const usageRef = (input.usageRef as string | undefined) ?? '';
    const usageLabel = (input.usageLabel as string | undefined) ?? '';

    if (!field || field.trim() === '') {
      return complete(createProgram(), 'error', { message: 'field is required' }) as StorageProgram<Result>;
    }
    if (!usageRef || usageRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'usageRef is required' }) as StorageProgram<Result>;
    }

    const key = usageKey(field, usageRef);

    let p = createProgram();
    p = spGet(p, 'schemaUsage', key, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'duplicate', { field, usageRef }),
      (b) => {
        let b2 = put(b, 'schemaUsage', key, {
          field,
          usageType,
          usageRef,
          usageLabel,
          registeredAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { id: key });
      },
    );
    return p as StorageProgram<Result>;
  },

  unregister(input: Record<string, unknown>) {
    const field = (input.field as string | undefined) ?? '';
    const usageRef = (input.usageRef as string | undefined) ?? '';
    const key = usageKey(field, usageRef);

    let p = createProgram();
    p = spGet(p, 'schemaUsage', key, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = del(b, 'schemaUsage', key);
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'not_found', { message: `No usage record for field '${field}' and usageRef '${usageRef}'` }),
    );
    return p as StorageProgram<Result>;
  },

  scan(input: Record<string, unknown>) {
    const field = (input.field as string | undefined) ?? '';

    let p = createProgram();
    p = find(p, 'schemaUsage', {}, 'allUsages');
    p = mapBindings(p, (bindings) => {
      const all = Array.isArray(bindings.allUsages)
        ? (bindings.allUsages as Array<Record<string, unknown>>)
        : [];
      const matches = all.filter((u) => u.field === field);
      return JSON.stringify(matches);
    }, 'usagesJson');
    return complete(p, 'ok', { usages: '' }) as StorageProgram<Result>;
  },

  scanSchema(input: Record<string, unknown>) {
    const schema = (input.schema as string | undefined) ?? '';

    let p = createProgram();
    p = find(p, 'schemaUsage', {}, 'allUsages');
    p = mapBindings(p, (bindings) => {
      const all = Array.isArray(bindings.allUsages)
        ? (bindings.allUsages as Array<Record<string, unknown>>)
        : [];
      // A field key has the form "schema:fieldId"; match prefix "schema:"
      const prefix = `${schema}:`;
      const matches = all.filter((u) => {
        const fieldKey = u.field as string;
        return fieldKey.startsWith(prefix);
      });
      return JSON.stringify(matches);
    }, 'usagesJson');
    return complete(p, 'ok', { usages: '' }) as StorageProgram<Result>;
  },

  remove(input: Record<string, unknown>) {
    const field = (input.field as string | undefined) ?? '';
    const usageRef = (input.usageRef as string | undefined) ?? '';
    const key = usageKey(field, usageRef);

    let p = createProgram();
    p = spGet(p, 'schemaUsage', key, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = del(b, 'schemaUsage', key);
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'not_found', { message: `No usage record for field '${field}' and usageRef '${usageRef}'` }),
    );
    return p as StorageProgram<Result>;
  },

};

export const schemaUsageHandler = autoInterpret(_schemaUsageHandler);
