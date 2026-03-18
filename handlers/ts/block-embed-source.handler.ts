// @migrated dsl-constructs 2026-03-18
// ============================================================
// BlockEmbedSource Handler
//
// SlotSource provider that embeds a block (Canvas child) by reference.
// Registers with PluginRegistry under slot_source_provider.
// See Architecture doc Section 16.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `bes-${++idCounter}`;
}

let registered = false;

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    if (registered) {
      const p = createProgram();
      return complete(p, 'already_registered', {}) as StorageProgram<Result>;
    }

    registered = true;
    let p = createProgram();
    p = put(p, 'block-embed-source', '__registered', { value: true });

    return complete(p, 'ok', { provider_name: 'block_embed' }) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const blockId = input.block_id as string;
    const canvasId = input.canvas_id as string;
    const renderDepth = input.render_depth as number | undefined;
    const context = input.context as string;

    if (!blockId || !canvasId) {
      const p = createProgram();
      return complete(p, 'error', { message: 'block_id and canvas_id are required' }) as StorageProgram<Result>;
    }

    let parsedContext: Record<string, unknown>;
    try {
      parsedContext = JSON.parse(context || '{}');
    } catch {
      const p = createProgram();
      return complete(p, 'error', { message: `Invalid context JSON: ${context}` }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'block', blockId, 'block');

    return branch(p, 'block',
      (thenP) => {
        thenP = mapBindings(thenP, (bindings) => {
          const block = bindings.block as Record<string, unknown>;
          if (block.canvas_id && String(block.canvas_id) !== canvasId) {
            return null; // block not in this canvas
          }
          return block;
        }, 'validBlock');

        return branch(thenP, 'validBlock',
          (validP) => {
            const depth = renderDepth ?? 1;
            const id = nextId();

            validP = put(validP, 'block-embed-source', id, {
              id,
              block_id: blockId,
              canvas_id: canvasId,
              render_depth: depth,
              createdAt: new Date().toISOString(),
            });

            return completeFrom(validP, 'ok', (bindings) => {
              const block = bindings.validBlock as Record<string, unknown>;
              const data = JSON.stringify({
                block_id: blockId,
                canvas_id: canvasId,
                render_depth: depth,
                block_type: block.type || 'unknown',
                content: block.content || null,
                context: parsedContext,
                rendered: true,
              });
              return { data };
            });
          },
          (invalidP) => complete(invalidP, 'block_not_found', { block_id: blockId, canvas_id: canvasId }),
        );
      },
      (elseP) => complete(elseP, 'block_not_found', { block_id: blockId, canvas_id: canvasId }),
    ) as StorageProgram<Result>;
  },
};

export const blockEmbedSourceHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetBlockEmbedSource(): void {
  idCounter = 0;
  registered = false;
}
