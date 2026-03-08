// ============================================================
// EntityFieldSource Handler
//
// SlotSource provider that reads a field value from an entity.
// Registers with PluginRegistry under slot_source_provider.
// See Architecture doc Section 16.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `efs-${++idCounter}`;
}

let registered = false;

export const entityFieldSourceHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, storage: ConceptStorage) {
    if (registered) {
      return { variant: 'already_registered' };
    }

    registered = true;
    await storage.put('entity-field-source', '__registered', { value: true });

    return { variant: 'ok', provider_name: 'entity_field' };
  },

  async resolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const entityType = input.entity_type as string;
    const fieldPath = input.field_path as string;
    const entityId = input.entity_id as string;
    const context = input.context as string;

    if (!entityType || !fieldPath || !entityId) {
      return { variant: 'error', message: 'entity_type, field_path, and entity_id are required' };
    }

    // Parse context
    let parsedContext: Record<string, unknown>;
    try {
      parsedContext = JSON.parse(context || '{}');
    } catch {
      return { variant: 'error', message: `Invalid context JSON: ${context}` };
    }

    // Look up the entity
    const entity = await storage.get(entityType, entityId);
    if (!entity) {
      return { variant: 'not_found', entity_type: entityType, entity_id: entityId };
    }

    // Traverse the field path (supports dot-notation)
    const pathParts = fieldPath.split('.');
    let current: unknown = entity;
    for (const part of pathParts) {
      if (current == null || typeof current !== 'object') {
        return { variant: 'field_missing', entity_type: entityType, field_path: fieldPath };
      }
      current = (current as Record<string, unknown>)[part];
    }

    if (current === undefined) {
      return { variant: 'field_missing', entity_type: entityType, field_path: fieldPath };
    }

    const data = typeof current === 'string' ? current : JSON.stringify(current);
    const id = nextId();
    await storage.put('entity-field-source', id, {
      id,
      entity_type: entityType,
      field_path: fieldPath,
      entity_id: entityId,
      resolved_data: data,
      context: parsedContext,
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', data };
  },
};

/** Reset internal state. Useful for testing. */
export function resetEntityFieldSource(): void {
  idCounter = 0;
  registered = false;
}
