// ============================================================
// BlockEmbedSource Handler
//
// SlotSource provider that embeds a block (Canvas child) by reference.
// Registers with PluginRegistry under slot_source_provider.
// See Architecture doc Section 16.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `bes-${++idCounter}`;
}

let registered = false;

export const blockEmbedSourceHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, storage: ConceptStorage) {
    if (registered) {
      return { variant: 'already_registered' };
    }

    registered = true;
    await storage.put('block-embed-source', '__registered', { value: true });

    return { variant: 'ok', provider_name: 'block_embed' };
  },

  async resolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const blockId = input.block_id as string;
    const canvasId = input.canvas_id as string;
    const renderDepth = input.render_depth as number | undefined;
    const context = input.context as string;

    if (!blockId || !canvasId) {
      return { variant: 'error', message: 'block_id and canvas_id are required' };
    }

    // Parse context
    let parsedContext: Record<string, unknown>;
    try {
      parsedContext = JSON.parse(context || '{}');
    } catch {
      return { variant: 'error', message: `Invalid context JSON: ${context}` };
    }

    // Look up the block in the canvas
    const block = await storage.get('block', blockId);
    if (!block) {
      return { variant: 'block_not_found', block_id: blockId, canvas_id: canvasId };
    }

    // Verify block belongs to the specified canvas
    if (block.canvas_id && String(block.canvas_id) !== canvasId) {
      return { variant: 'block_not_found', block_id: blockId, canvas_id: canvasId };
    }

    // Render the block — in production this delegates to the Canvas
    // block render pipeline with depth limiting
    const depth = renderDepth ?? 1;
    const data = JSON.stringify({
      block_id: blockId,
      canvas_id: canvasId,
      render_depth: depth,
      block_type: block.type || 'unknown',
      content: block.content || null,
      context: parsedContext,
      rendered: true,
    });

    const id = nextId();
    await storage.put('block-embed-source', id, {
      id,
      block_id: blockId,
      canvas_id: canvasId,
      render_depth: depth,
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', data };
  },
};

/** Reset internal state. Useful for testing. */
export function resetBlockEmbedSource(): void {
  idCounter = 0;
  registered = false;
}
