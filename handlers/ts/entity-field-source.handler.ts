// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// EntityFieldSource Handler
//
// SlotSource provider that reads a field value from an entity.
// Registers with PluginRegistry under slot_source_provider.
// See Architecture doc Section 16.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

let idCounter = 0;
function nextId(): string {
  return `efs-${++idCounter}`;
}

let registered = false;

type Result = { variant: string; [key: string]: unknown };

/**
 * Traverse a dot-notation field path on an object.
 * Returns undefined if any segment is missing.
 */
function traverseFieldPath(obj: unknown, fieldPath: string): unknown {
  const pathParts = fieldPath.split('.');
  let current: unknown = obj;
  for (const part of pathParts) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

const _entityFieldSourceHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    if (registered) {
      return complete(createProgram(), 'already_registered', {}) as StorageProgram<Result>;
    }

    registered = true;
    let p = createProgram();
    p = put(p, 'entity-field-source', '__registered', { value: true });

    return complete(p, 'ok', { provider_name: 'entity_field' }) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const entityType = input.entity_type as string;
    const fieldPath = input.field_path as string;
    const entityId = input.entity_id as string;
    const context = input.context as string;

    if (!entityType || !fieldPath || !entityId) {
      return complete(createProgram(), 'error', {
        message: 'entity_type, field_path, and entity_id are required',
      }) as StorageProgram<Result>;
    }

    // Parse context
    let parsedContext: Record<string, unknown>;
    try {
      parsedContext = JSON.parse(context || '{}');
    } catch {
      return complete(createProgram(), 'error', {
        message: `Invalid context JSON: ${context}`,
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, entityType, entityId, 'entity');

    p = branch(p, 'entity',
      (b) => {
        // Entity found — traverse field path
        let b2 = mapBindings(b, (bindings) => {
          const entity = bindings.entity as Record<string, unknown>;
          const value = traverseFieldPath(entity, fieldPath);
          if (value === undefined) return undefined;
          return typeof value === 'string' ? value : JSON.stringify(value);
        }, 'resolvedData');

        b2 = branch(b2, 'resolvedData',
          (inner) => {
            const id = nextId();
            let inner2 = put(inner, 'entity-field-source', id, {
              id,
              entity_type: entityType,
              field_path: fieldPath,
              entity_id: entityId,
              resolved_data: '', // placeholder — actual value set via completeFrom
              context: parsedContext,
              createdAt: new Date().toISOString(),
            });
            return completeFrom(inner2, 'ok', (bindings) => ({
              data: bindings.resolvedData as string,
            }));
          },
          (inner) => complete(inner, 'field_missing', {
            entity_type: entityType,
            field_path: fieldPath,
          }),
        );
        return b2;
      },
      (b) => complete(b, 'not_found', { entity_type: entityType, entity_id: entityId }),
    );

    return p as StorageProgram<Result>;
  },
};

export const entityFieldSourceHandler = autoInterpret(_entityFieldSourceHandler);

/** Reset internal state. Useful for testing. */
export function resetEntityFieldSource(): void {
  idCounter = 0;
  registered = false;
}
