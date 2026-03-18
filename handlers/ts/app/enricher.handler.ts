// @migrated dsl-constructs 2026-03-18
// Enricher Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const enricherHandlerFunctional: FunctionalConceptHandler = {
  enrich(input: Record<string, unknown>) {
    const itemId = input.itemId as string;
    const enricherId = input.enricherId as string;

    let p = createProgram();
    p = spGet(p, 'enricherTrigger', enricherId, 'trigger');
    p = branch(p, 'trigger',
      (b) => {
        const enrichmentId = `enr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const enrichment = {
          enrichmentId,
          itemId,
          pluginId: '',
          result: '{}',
          confidence: '0.0',
          status: 'suggested',
          generatedAt: new Date().toISOString(),
        };
        let b2 = put(b, 'enrichment', enrichmentId, enrichment);
        return complete(b2, 'ok', {
          enrichmentId,
          result: enrichment.result,
          confidence: enrichment.confidence,
        });
      },
      (b) => complete(b, 'notfound', { message: `Enricher "${enricherId}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  suggest(input: Record<string, unknown>) {
    const itemId = input.itemId as string;

    let p = createProgram();
    p = find(p, 'enricherTrigger', {}, 'triggers');
    return complete(p, 'ok', { suggestions: JSON.stringify([]) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  accept(input: Record<string, unknown>) {
    const itemId = input.itemId as string;
    const enrichmentId = input.enrichmentId as string;

    let p = createProgram();
    p = spGet(p, 'enrichment', enrichmentId, 'enrichment');
    p = branch(p, 'enrichment',
      (b) => {
        let b2 = put(b, 'enrichment', enrichmentId, { status: 'accepted' });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: `Enrichment "${enrichmentId}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  reject(input: Record<string, unknown>) {
    const itemId = input.itemId as string;
    const enrichmentId = input.enrichmentId as string;

    let p = createProgram();
    p = spGet(p, 'enrichment', enrichmentId, 'enrichment');
    p = branch(p, 'enrichment',
      (b) => {
        let b2 = put(b, 'enrichment', enrichmentId, { status: 'rejected' });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: `Enrichment "${enrichmentId}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  refreshStale(input: Record<string, unknown>) {
    const olderThan = input.olderThan as string;

    let p = createProgram();
    p = find(p, 'enrichment', {}, 'allEnrichments');
    return complete(p, 'ok', { refreshed: 0 }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const enricherHandler = wrapFunctional(enricherHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { enricherHandlerFunctional };
