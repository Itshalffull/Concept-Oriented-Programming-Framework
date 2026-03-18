// @migrated dsl-constructs 2026-03-18
// ============================================================
// ViewEmbedSource Handler
//
// SlotSource provider that embeds a View query result set.
// Registers with PluginRegistry under slot_source_provider.
// See Architecture doc Section 16.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `ves-${++idCounter}`;
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
    p = put(p, 'view-embed-source', '__registered', { value: true });

    return complete(p, 'ok', { provider_name: 'view_embed' }) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const viewId = input.view_id as string;
    const viewParams = input.view_params as string;
    const maxRows = input.max_rows as number | undefined;
    const context = input.context as string;

    if (!viewId) {
      const p = createProgram();
      return complete(p, 'error', { message: 'view_id is required' }) as StorageProgram<Result>;
    }

    // Parse view params
    let parsedParams: Record<string, unknown>;
    try {
      parsedParams = JSON.parse(viewParams || '{}');
    } catch {
      const p = createProgram();
      return complete(p, 'error', { message: `Invalid view_params JSON: ${viewParams}` }) as StorageProgram<Result>;
    }

    // Parse context
    let parsedContext: Record<string, unknown>;
    try {
      parsedContext = JSON.parse(context || '{}');
    } catch {
      const p = createProgram();
      return complete(p, 'error', { message: `Invalid context JSON: ${context}` }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'view', viewId, 'view');

    return branch(p, 'view',
      (thenP) => {
        const limit = maxRows ?? 50;
        thenP = find(thenP, 'view_result', { view_id: viewId }, 'results');

        return completeFrom(thenP, 'ok', (bindings) => {
          const results = bindings.results as Record<string, unknown>[];
          const limitedResults = results.slice(0, limit);

          const data = JSON.stringify({
            view_id: viewId,
            params: parsedParams,
            context: parsedContext,
            row_count: limitedResults.length,
            rows: limitedResults,
          });

          return { data };
        });
      },
      (elseP) => complete(elseP, 'view_not_found', { view_id: viewId }),
    ) as StorageProgram<Result>;
  },
};

export const viewEmbedSourceHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetViewEmbedSource(): void {
  idCounter = 0;
  registered = false;
}
