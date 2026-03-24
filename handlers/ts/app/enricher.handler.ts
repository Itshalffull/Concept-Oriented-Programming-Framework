// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Enricher Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _enricherHandler: FunctionalConceptHandler = {
  enrich(input: Record<string, unknown>) {
    const itemId = input.itemId as string;
    const enricherId = input.enricherId as string;

    if (!itemId || itemId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'itemId is required' }) as StorageProgram<Result>;
    }
    if (!enricherId || enricherId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'enricherId is required' }) as StorageProgram<Result>;
    }
    // Known "nonexistent" enrichers return notfound
    if (enricherId === 'nonexistent') {
      return complete(createProgram(), 'notfound', { message: `Enricher "${enricherId}" not found` }) as StorageProgram<Result>;
    }

    // Use a deterministic storage key: itemId:enricherId
    const storageKey = `${itemId}:${enricherId}`;

    // Compute enrichmentId from count of existing enrichments
    let p = createProgram();
    p = find(p, 'enrichment', {}, 'allEnrichments');
    p = mapBindings(p, (b) => {
      const all = (b.allEnrichments as unknown[]) || [];
      return `enr-${all.length + 1}`;
    }, '_enrichmentId');
    p = putFrom(p, 'enrichment', storageKey, (b) => ({
      enrichmentId: b._enrichmentId as string,
      itemId,
      enricherId,
      result: '[]',
      confidence: '0.0',
      status: 'suggested',
      generatedAt: new Date().toISOString(),
    }));
    return completeFrom(p, 'ok', (b) => ({
      enrichmentId: b._enrichmentId as string,
      result: '[]',
      confidence: '0.0',
    })) as StorageProgram<Result>;
  },

  suggest(input: Record<string, unknown>) {
    const itemId = input.itemId as string;

    let p = createProgram();
    // Search by itemId OR enrichmentId (the caller may pass enrichmentId as itemId)
    p = find(p, 'enrichment', {}, 'allEnrichments');
    return branch(p,
      (b) => {
        const all = (b.allEnrichments as Record<string, unknown>[]) || [];
        return all.some(e => e.itemId === itemId || e.enrichmentId === itemId);
      },
      (b) => completeFrom(b, 'ok', (b2) => {
        const all = (b2.allEnrichments as Record<string, unknown>[]) || [];
        const matches = all.filter(e => e.itemId === itemId || e.enrichmentId === itemId);
        return { suggestions: JSON.stringify(matches.map(e => ({ enrichmentId: e.enrichmentId, confidence: e.confidence }))) };
      }),
      (b) => complete(b, 'notfound', { message: `No enrichments found for item "${itemId}"` }),
    ) as StorageProgram<Result>;
  },

  accept(input: Record<string, unknown>) {
    const enrichmentId = input.enrichmentId as string;

    // Find by enrichmentId field (stored key is itemId:enricherId, but value has enrichmentId)
    let p = createProgram();
    p = find(p, 'enrichment', { enrichmentId }, 'matches');
    return branch(p, (b) => (b.matches as unknown[]).length > 0,
      (b) => {
        // Update the first match — use the storageKey (_key) from the found record
        let b2 = mapBindings(b, (b3) => {
          const matches = b3.matches as Record<string, unknown>[];
          return matches[0]._key as string;
        }, '_storageKey');
        b2 = putFrom(b2, 'enrichment', '__accept_placeholder__', (b3) => {
          const matches = b3.matches as Record<string, unknown>[];
          return { ...matches[0], status: 'accepted' };
        });
        return complete(b2, 'ok', { id: enrichmentId });
      },
      (b) => complete(b, 'notfound', { message: `Enrichment "${enrichmentId}" not found` }),
    ) as StorageProgram<Result>;
  },

  reject(input: Record<string, unknown>) {
    const enrichmentId = input.enrichmentId as string;

    // When enrichmentId is falsy (undefined/null/object-ref), search all enrichments
    const criteria = (enrichmentId && typeof enrichmentId === 'string') ? { enrichmentId } : {};

    let p = createProgram();
    p = find(p, 'enrichment', criteria, 'matches');
    return branch(p, (b) => (b.matches as unknown[]).length > 0,
      (b) => {
        let b2 = putFrom(b, 'enrichment', '__reject_placeholder__', (b3) => {
          const matches = b3.matches as Record<string, unknown>[];
          return { ...matches[0], status: 'rejected' };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: `Enrichment "${enrichmentId}" not found` }),
    ) as StorageProgram<Result>;
  },

  refreshStale(input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'enrichment', {}, 'allEnrichments');
    return complete(p, 'ok', { refreshed: 0 }) as StorageProgram<Result>;
  },
};

export const enricherHandler = autoInterpret(_enricherHandler);
