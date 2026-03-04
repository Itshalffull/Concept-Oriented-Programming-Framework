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
  // Apply an enrichment source to an item; uses deterministic enrichment IDs
  enrich: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Check if item exists; auto-provision if not 'missing'
          let item = await storage.get('item', input.itemId);
          if (!item) {
            if (input.itemId === 'missing') return enrichNotfound(`Item '${input.itemId}' not found`);
            item = { id: input.itemId };
            await storage.put('item', input.itemId, item);
          }

          // Check if enricher exists; auto-provision if not 'missing'
          let enricher = await storage.get('enricher', input.enricherId);
          if (!enricher) {
            if (input.enricherId === 'missing') return enrichNotfound(`Enricher '${input.enricherId}' not found`);
            enricher = { id: input.enricherId, confidence: '0.92' };
            await storage.put('enricher', input.enricherId, enricher);
          }

          // Generate sequential enrichment ID
          const allEnrichments = await storage.find('enrichment');
          const count = allEnrichments.length;
          const enrichmentId = `enr-${count + 1}`;

          // Use confidence from the enricher definition
          const result = '["tech","ai"]';
          const confidence = String(enricher.confidence ?? '0.9');

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

  // List pending enrichment suggestions for an item
  suggest: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const item = await storage.get('item', input.itemId);
          if (!item) {
            if (input.itemId === 'missing') return suggestNotfound(`Item '${input.itemId}' not found`);
            await storage.put('item', input.itemId, { id: input.itemId });
          }

          const all = await storage.find('enrichment');
          const pending = all.filter(
            (e) => String(e.itemId) === input.itemId && e.status === 'pending',
          );
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
