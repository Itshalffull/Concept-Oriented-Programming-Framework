// @migrated dsl-constructs 2026-03-18
// ProgressiveSchema Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _progressiveSchemaHandler: FunctionalConceptHandler = {
  captureFreeform(input: Record<string, unknown>) {
    const content = input.content as string;

    const itemId = `ps-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    let p = createProgram();
    p = put(p, 'progressiveItem', itemId, {
      itemId,
      content,
      formality: 'freeform',
      detectedStructure: [],
      schema: null,
      promotionHistory: [],
    });

    return complete(p, 'ok', { itemId }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  detectStructure(input: Record<string, unknown>) {
    const itemId = input.itemId as string;

    let p = createProgram();
    p = spGet(p, 'progressiveItem', itemId, 'item');
    p = branch(p, 'item',
      (b) => {
        // Detection requires content from binding; simplified
        let b2 = put(b, 'progressiveItem', itemId, {
          formality: 'inline_metadata',
        });
        return complete(b2, 'ok', { suggestions: JSON.stringify([]) });
      },
      (b) => complete(b, 'notfound', { message: `Item "${itemId}" not found` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  acceptSuggestion(input: Record<string, unknown>) {
    const itemId = input.itemId as string;
    const suggestionId = input.suggestionId as string;

    let p = createProgram();
    p = spGet(p, 'progressiveItem', itemId, 'item');
    p = branch(p, 'item',
      (b) => {
        let b2 = put(b, 'progressiveItem', itemId, {
          formality: 'typed_properties',
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: `Item "${itemId}" not found` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  rejectSuggestion(input: Record<string, unknown>) {
    const itemId = input.itemId as string;
    const suggestionId = input.suggestionId as string;

    let p = createProgram();
    p = spGet(p, 'progressiveItem', itemId, 'item');
    p = branch(p, 'item',
      (b) => complete(b, 'ok', {}),
      (b) => complete(b, 'notfound', { message: `Item "${itemId}" not found` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  promote(input: Record<string, unknown>) {
    const itemId = input.itemId as string;
    const targetSchema = input.targetSchema as string;

    let p = createProgram();
    p = spGet(p, 'progressiveItem', itemId, 'item');
    p = branch(p, 'item',
      (b) => {
        let b2 = put(b, 'progressiveItem', itemId, {
          schema: targetSchema,
          formality: 'schema_conformant',
        });
        return complete(b2, 'ok', { result: JSON.stringify({ schema: targetSchema, fields: 0 }) });
      },
      (b) => complete(b, 'notfound', { message: `Item "${itemId}" not found` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  inferSchema(input: Record<string, unknown>) {
    const items = input.items as string;

    let p = createProgram();

    let itemIds: string[];
    try {
      itemIds = JSON.parse(items);
    } catch {
      itemIds = items.split(',').map(id => id.trim());
    }

    if (itemIds.length === 0) {
      return complete(p, 'error', { message: 'No items provided for schema inference' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    return complete(p, 'ok', { proposedSchema: JSON.stringify({ fields: [] }) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const progressiveSchemaHandler = autoInterpret(_progressiveSchemaHandler);

