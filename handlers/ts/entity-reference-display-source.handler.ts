// ============================================================
// EntityReferenceDisplaySource Handler
//
// SlotSource provider that resolves a referenced entity's display
// rendering. Registers with PluginRegistry under slot_source_provider.
// See Architecture doc Section 16.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `erds-${++idCounter}`;
}

let registered = false;

const VALID_DISPLAY_MODES = ['title', 'summary', 'badge', 'card'];

export const entityReferenceDisplaySourceHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, storage: ConceptStorage) {
    if (registered) {
      return { variant: 'already_registered' };
    }

    registered = true;
    await storage.put('entity-reference-display-source', '__registered', { value: true });

    return { variant: 'ok', provider_name: 'entity_reference_display' };
  },

  async resolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const referenceField = input.reference_field as string;
    const displayMode = input.display_mode as string;
    const entityId = input.entity_id as string;
    const context = input.context as string;

    if (!referenceField || !displayMode || !entityId) {
      return { variant: 'error', message: 'reference_field, display_mode, and entity_id are required' };
    }

    // Validate display mode
    if (!VALID_DISPLAY_MODES.includes(displayMode)) {
      return { variant: 'invalid_display_mode', display_mode: displayMode };
    }

    // Parse context
    let parsedContext: Record<string, unknown>;
    try {
      parsedContext = JSON.parse(context || '{}');
    } catch {
      return { variant: 'error', message: `Invalid context JSON: ${context}` };
    }

    // Look up the source entity
    const entityType = (parsedContext.entity_type as string) || 'entity';
    const sourceEntity = await storage.get(entityType, entityId);
    if (!sourceEntity) {
      return { variant: 'source_not_found', entity_id: entityId };
    }

    // Follow the reference field to get the target entity ID
    const targetEntityId = sourceEntity[referenceField] as string;
    if (!targetEntityId) {
      return {
        variant: 'reference_broken',
        entity_id: entityId,
        reference_field: referenceField,
      };
    }

    // Load the target entity
    const targetType = (parsedContext.target_entity_type as string) || 'entity';
    const targetEntity = await storage.get(targetType, targetEntityId);
    if (!targetEntity) {
      return {
        variant: 'reference_broken',
        entity_id: entityId,
        reference_field: referenceField,
      };
    }

    // Build display rendering based on mode
    let displayData: Record<string, unknown>;
    switch (displayMode) {
      case 'title':
        displayData = {
          display_mode: 'title',
          text: targetEntity.title || targetEntity.name || String(targetEntityId),
        };
        break;

      case 'summary':
        displayData = {
          display_mode: 'summary',
          title: targetEntity.title || targetEntity.name || String(targetEntityId),
          description: targetEntity.description || targetEntity.summary || '',
        };
        break;

      case 'badge':
        displayData = {
          display_mode: 'badge',
          label: targetEntity.title || targetEntity.name || String(targetEntityId),
          color: targetEntity.color || null,
          icon: targetEntity.icon || null,
        };
        break;

      case 'card':
        displayData = {
          display_mode: 'card',
          title: targetEntity.title || targetEntity.name || String(targetEntityId),
          description: targetEntity.description || targetEntity.summary || '',
          image: targetEntity.image || targetEntity.avatar || null,
          metadata: targetEntity.metadata || null,
        };
        break;

      default:
        displayData = { display_mode: displayMode, entity: targetEntity };
        break;
    }

    const data = JSON.stringify({
      source_entity_id: entityId,
      reference_field: referenceField,
      target_entity_id: targetEntityId,
      ...displayData,
    });

    const id = nextId();
    await storage.put('entity-reference-display-source', id, {
      id,
      reference_field: referenceField,
      display_mode: displayMode,
      entity_id: entityId,
      target_entity_id: targetEntityId,
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', data };
  },
};

/** Reset internal state. Useful for testing. */
export function resetEntityReferenceDisplaySource(): void {
  idCounter = 0;
  registered = false;
}
