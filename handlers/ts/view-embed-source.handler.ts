// ============================================================
// ViewEmbedSource Handler
//
// SlotSource provider that embeds a View query result set.
// Registers with PluginRegistry under slot_source_provider.
// See Architecture doc Section 16.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `ves-${++idCounter}`;
}

let registered = false;

export const viewEmbedSourceHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, storage: ConceptStorage) {
    if (registered) {
      return { variant: 'already_registered' };
    }

    registered = true;
    await storage.put('view-embed-source', '__registered', { value: true });

    return { variant: 'ok', provider_name: 'view_embed' };
  },

  async resolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const viewId = input.view_id as string;
    const viewParams = input.view_params as string;
    const maxRows = input.max_rows as number | undefined;
    const context = input.context as string;

    if (!viewId) {
      return { variant: 'error', message: 'view_id is required' };
    }

    // Parse view params
    let parsedParams: Record<string, unknown>;
    try {
      parsedParams = JSON.parse(viewParams || '{}');
    } catch {
      return { variant: 'error', message: `Invalid view_params JSON: ${viewParams}` };
    }

    // Parse context
    let parsedContext: Record<string, unknown>;
    try {
      parsedContext = JSON.parse(context || '{}');
    } catch {
      return { variant: 'error', message: `Invalid context JSON: ${context}` };
    }

    // Look up the view definition
    const view = await storage.get('view', viewId);
    if (!view) {
      return { variant: 'view_not_found', view_id: viewId };
    }

    // Execute the view query — in production this delegates to the
    // View query engine
    const limit = maxRows ?? 50;
    const results = await storage.find('view_result', { view_id: viewId });
    const limitedResults = results.slice(0, limit);

    const data = JSON.stringify({
      view_id: viewId,
      params: parsedParams,
      context: parsedContext,
      row_count: limitedResults.length,
      rows: limitedResults,
    });

    const id = nextId();
    await storage.put('view-embed-source', id, {
      id,
      view_id: viewId,
      view_params: viewParams,
      max_rows: limit,
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', data };
  },
};

/** Reset internal state. Useful for testing. */
export function resetViewEmbedSource(): void {
  idCounter = 0;
  registered = false;
}
