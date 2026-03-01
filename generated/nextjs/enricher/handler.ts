// Enricher — handler.ts
// Data enrichment pipeline: register enrichment sources, apply enrichments to items,
// accept/reject proposed enrichments, and refresh stale enrichment data.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  EnricherStorage,
  EnricherEnrichInput,
  EnricherEnrichOutput,
  EnricherSuggestInput,
  EnricherSuggestOutput,
  EnricherAcceptInput,
  EnricherAcceptOutput,
  EnricherRejectInput,
  EnricherRejectOutput,
  EnricherRefreshStaleInput,
  EnricherRefreshStaleOutput,
} from './types.js';

import {
  enrichOk,
  enrichNotfound,
  enrichError,
  suggestOk,
  suggestNotfound,
  acceptOk,
  acceptNotfound,
  rejectOk,
  rejectNotfound,
  refreshStaleOk,
} from './types.js';

export interface EnricherError {
  readonly code: string;
  readonly message: string;
}

const toError = (error: unknown): EnricherError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface EnricherHandler {
  readonly enrich: (
    input: EnricherEnrichInput,
    storage: EnricherStorage,
  ) => TE.TaskEither<EnricherError, EnricherEnrichOutput>;
  readonly suggest: (
    input: EnricherSuggestInput,
    storage: EnricherStorage,
  ) => TE.TaskEither<EnricherError, EnricherSuggestOutput>;
  readonly accept: (
    input: EnricherAcceptInput,
    storage: EnricherStorage,
  ) => TE.TaskEither<EnricherError, EnricherAcceptOutput>;
  readonly reject: (
    input: EnricherRejectInput,
    storage: EnricherStorage,
  ) => TE.TaskEither<EnricherError, EnricherRejectOutput>;
  readonly refreshStale: (
    input: EnricherRefreshStaleInput,
    storage: EnricherStorage,
  ) => TE.TaskEither<EnricherError, EnricherRefreshStaleOutput>;
}

// --- Implementation ---

export const enricherHandler: EnricherHandler = {
  // Apply an enrichment source to an item; the item must already exist
  enrich: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('item', input.itemId),
        toError,
      ),
      TE.chain((itemRecord) =>
        pipe(
          O.fromNullable(itemRecord),
          O.fold(
            () => TE.right(enrichNotfound(`Item '${input.itemId}' not found`)),
            (item) =>
              TE.tryCatch(
                async () => {
                  // Look up the enricher definition
                  const enricherDef = await storage.get('enricher', input.enricherId);
                  if (!enricherDef) {
                    return enrichNotfound(`Enricher '${input.enricherId}' not found`);
                  }
                  const enrichmentId = `${input.itemId}::${input.enricherId}::${Date.now()}`;
                  const result = JSON.stringify({
                    itemId: input.itemId,
                    enricherId: input.enricherId,
                    fields: enricherDef.fields ?? [],
                  });
                  const confidence = String(enricherDef.confidence ?? '1.0');
                  await storage.put('enrichment', enrichmentId, {
                    enrichmentId,
                    itemId: input.itemId,
                    enricherId: input.enricherId,
                    result,
                    confidence,
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                  });
                  return enrichOk(enrichmentId, result, confidence);
                },
                toError,
              ),
          ),
        ),
      ),
    ),

  // List pending enrichment suggestions for an item
  suggest: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('item', input.itemId),
        toError,
      ),
      TE.chain((itemRecord) =>
        pipe(
          O.fromNullable(itemRecord),
          O.fold(
            () => TE.right(suggestNotfound(`Item '${input.itemId}' not found`)),
            () =>
              TE.tryCatch(
                async () => {
                  const all = await storage.find('enrichment', { itemId: input.itemId });
                  const pending = all.filter((e) => e.status === 'pending');
                  return suggestOk(
                    JSON.stringify(pending.map((e) => ({
                      enrichmentId: e.enrichmentId,
                      enricherId: e.enricherId,
                      confidence: e.confidence,
                    }))),
                  );
                },
                toError,
              ),
          ),
        ),
      ),
    ),

  // Accept a pending enrichment, marking it as accepted
  accept: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('enrichment', input.enrichmentId),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(acceptNotfound(`Enrichment '${input.enrichmentId}' not found`)),
            (found) =>
              TE.tryCatch(
                async () => {
                  await storage.put('enrichment', input.enrichmentId, {
                    ...found,
                    status: 'accepted',
                    acceptedAt: new Date().toISOString(),
                  });
                  return acceptOk();
                },
                toError,
              ),
          ),
        ),
      ),
    ),

  // Reject a pending enrichment and remove it from storage
  reject: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('enrichment', input.enrichmentId),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(rejectNotfound(`Enrichment '${input.enrichmentId}' not found`)),
            () =>
              TE.tryCatch(
                async () => {
                  await storage.delete('enrichment', input.enrichmentId);
                  return rejectOk();
                },
                toError,
              ),
          ),
        ),
      ),
    ),

  // Re-apply all enrichments older than the given threshold
  refreshStale: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const all = await storage.find('enrichment');
          const stale = all.filter((e) => {
            const createdAt = e.createdAt as string | undefined;
            return createdAt !== undefined && createdAt < input.olderThan;
          });
          // Mark each stale enrichment as refreshed with a new timestamp
          for (const entry of stale) {
            await storage.put('enrichment', entry.enrichmentId as string, {
              ...entry,
              createdAt: new Date().toISOString(),
              refreshedAt: new Date().toISOString(),
            });
          }
          return refreshStaleOk(stale.length);
        },
        toError,
      ),
    ),
};
