// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// EntityReferenceDisplaySource Handler
//
// SlotSource provider that resolves a referenced entity's display
// rendering. Registers with PluginRegistry under slot_source_provider.
// See Architecture doc Section 16.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `erds-${++idCounter}`;
}

let registered = false;

const VALID_DISPLAY_MODES = ['title', 'summary', 'badge', 'card'];

/**
 * Build display rendering based on mode. Pure helper.
 */
function buildDisplayData(
  displayMode: string,
  targetEntity: Record<string, unknown>,
  targetEntityId: string,
): Record<string, unknown> {
  switch (displayMode) {
    case 'title':
      return {
        display_mode: 'title',
        text: targetEntity.title || targetEntity.name || String(targetEntityId),
      };
    case 'summary':
      return {
        display_mode: 'summary',
        title: targetEntity.title || targetEntity.name || String(targetEntityId),
        description: targetEntity.description || targetEntity.summary || '',
      };
    case 'badge':
      return {
        display_mode: 'badge',
        label: targetEntity.title || targetEntity.name || String(targetEntityId),
        color: targetEntity.color || null,
        icon: targetEntity.icon || null,
      };
    case 'card':
      return {
        display_mode: 'card',
        title: targetEntity.title || targetEntity.name || String(targetEntityId),
        description: targetEntity.description || targetEntity.summary || '',
        image: targetEntity.image || targetEntity.avatar || null,
        metadata: targetEntity.metadata || null,
      };
    default:
      return { display_mode: displayMode, entity: targetEntity };
  }
}

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    if (registered) {
      const p = createProgram();
      return complete(p, 'already_registered', {}) as StorageProgram<Result>;
    }

    registered = true;
    let p = createProgram();
    p = put(p, 'entity-reference-display-source', '__registered', { value: true });

    return complete(p, 'ok', { provider_name: 'entity_reference_display' }) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const referenceField = input.reference_field as string;
    const displayMode = input.display_mode as string;
    const entityId = input.entity_id as string;
    const context = input.context as string;

    if (!referenceField || !displayMode || !entityId) {
      const p = createProgram();
      return complete(p, 'error', { message: 'reference_field, display_mode, and entity_id are required' }) as StorageProgram<Result>;
    }

    if (!VALID_DISPLAY_MODES.includes(displayMode)) {
      const p = createProgram();
      return complete(p, 'invalid_display_mode', { display_mode: displayMode }) as StorageProgram<Result>;
    }

    let parsedContext: Record<string, unknown>;
    try {
      parsedContext = JSON.parse(context || '{}');
    } catch {
      const p = createProgram();
      return complete(p, 'error', { message: `Invalid context JSON: ${context}` }) as StorageProgram<Result>;
    }

    const entityType = (parsedContext.entity_type as string) || 'entity';

    let p = createProgram();
    p = get(p, entityType, entityId, 'sourceEntity');

    return branch(p, 'sourceEntity',
      (thenP) => {
        return completeFrom(thenP, 'dynamic', (bindings) => {
          const sourceEntity = bindings.sourceEntity as Record<string, unknown>;
          const targetEntityId = sourceEntity[referenceField] as string;

          if (!targetEntityId) {
            return {
              variant: 'reference_broken',
              entity_id: entityId,
              reference_field: referenceField,
            };
          }

          // Since we cannot do a second get inside completeFrom,
          // return the target entity id for sync dispatch to resolve.
          // For direct resolution, the caller must pass target data in context.
          const targetType = (parsedContext.target_entity_type as string) || 'entity';
          return {
            variant: 'ok',
            data: JSON.stringify({
              source_entity_id: entityId,
              reference_field: referenceField,
              target_entity_id: targetEntityId,
              display_mode: displayMode,
            }),
          };
        });
      },
      (elseP) => complete(elseP, 'source_not_found', { entity_id: entityId }),
    ) as StorageProgram<Result>;
  },
};

export const entityReferenceDisplaySourceHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetEntityReferenceDisplaySource(): void {
  idCounter = 0;
  registered = false;
}
