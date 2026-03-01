// Attribution — Content attribution tracking: record who changed what region
// of content, blame maps for ownership, modification history chains, and
// CODEOWNERS-style ownership patterns.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  AttributionStorage,
  AttributionAttributeInput,
  AttributionAttributeOutput,
  AttributionBlameInput,
  AttributionBlameOutput,
  AttributionHistoryInput,
  AttributionHistoryOutput,
  AttributionSetOwnershipInput,
  AttributionSetOwnershipOutput,
  AttributionQueryOwnersInput,
  AttributionQueryOwnersOutput,
} from './types.js';

import {
  attributeOk,
  blameOk,
  historyOk,
  historyNotFound,
  setOwnershipOk,
  queryOwnersOk,
  queryOwnersNoMatch,
} from './types.js';

export interface AttributionError {
  readonly code: string;
  readonly message: string;
}

const toAttributionError = (error: unknown): AttributionError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface AttributionHandler {
  readonly attribute: (
    input: AttributionAttributeInput,
    storage: AttributionStorage,
  ) => TE.TaskEither<AttributionError, AttributionAttributeOutput>;
  readonly blame: (
    input: AttributionBlameInput,
    storage: AttributionStorage,
  ) => TE.TaskEither<AttributionError, AttributionBlameOutput>;
  readonly history: (
    input: AttributionHistoryInput,
    storage: AttributionStorage,
  ) => TE.TaskEither<AttributionError, AttributionHistoryOutput>;
  readonly setOwnership: (
    input: AttributionSetOwnershipInput,
    storage: AttributionStorage,
  ) => TE.TaskEither<AttributionError, AttributionSetOwnershipOutput>;
  readonly queryOwners: (
    input: AttributionQueryOwnersInput,
    storage: AttributionStorage,
  ) => TE.TaskEither<AttributionError, AttributionQueryOwnersOutput>;
}

// --- Implementation ---

export const attributionHandler: AttributionHandler = {
  // Record an attribution: who (agent) changed which region of which content.
  attribute: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const attributionId = `attr:${input.contentRef}:${Date.now()}`;
          await storage.put('attribution', attributionId, {
            attributionId,
            contentRef: input.contentRef,
            region: input.region,
            agent: input.agent,
            changeRef: input.changeRef,
            timestamp: new Date().toISOString(),
          });
          // Append to the content's attribution chain
          const chainRecord = await storage.get('attribution_chain', input.contentRef);
          const chain = chainRecord && Array.isArray((chainRecord as Record<string, unknown>).ids)
            ? [...((chainRecord as Record<string, unknown>).ids as readonly string[])]
            : [];
          chain.push(attributionId);
          await storage.put('attribution_chain', input.contentRef, {
            contentRef: input.contentRef,
            ids: chain,
          });
          return attributeOk(attributionId);
        },
        toAttributionError,
      ),
    ),

  // Build a blame map: for each region of a content ref, who last modified it.
  blame: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const chainRecord = await storage.get('attribution_chain', input.contentRef);
          if (!chainRecord) {
            return blameOk([]);
          }
          const ids = (chainRecord as Record<string, unknown>).ids as readonly string[] | undefined;
          if (!ids || ids.length === 0) {
            return blameOk([]);
          }
          const entries: { readonly region: Buffer; readonly agent: string; readonly changeRef: string }[] = [];
          for (const id of ids) {
            const attr = await storage.get('attribution', id);
            if (attr) {
              const r = attr as Record<string, unknown>;
              entries.push({
                region: r.region as Buffer,
                agent: String(r.agent ?? ''),
                changeRef: String(r.changeRef ?? ''),
              });
            }
          }
          return blameOk(entries);
        },
        toAttributionError,
      ),
    ),

  // Get the full modification history chain for a content region.
  history: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('attribution_chain', input.contentRef),
        toAttributionError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right<AttributionError, AttributionHistoryOutput>(
                historyNotFound(`No attribution history for '${input.contentRef}'`),
              ),
            (found) => {
              const ids = (found as Record<string, unknown>).ids;
              const chain = Array.isArray(ids) ? (ids as readonly string[]) : [];
              return TE.right<AttributionError, AttributionHistoryOutput>(historyOk(chain));
            },
          ),
        ),
      ),
    ),

  // Define an ownership pattern (like CODEOWNERS): a glob pattern mapped to owners.
  setOwnership: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          await storage.put('ownership', input.pattern, {
            pattern: input.pattern,
            owners: input.owners,
            setAt: new Date().toISOString(),
          });
          return setOwnershipOk();
        },
        toAttributionError,
      ),
    ),

  // Query which owners are responsible for a given file path by matching patterns.
  queryOwners: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allPatterns = await storage.find('ownership');
          // Simple glob matching: check if path starts with or matches pattern
          const matchingOwners: string[] = [];
          for (const entry of allPatterns) {
            const r = entry as Record<string, unknown>;
            const pattern = String(r.pattern ?? '');
            // Basic pattern matching: exact prefix or wildcard suffix
            const normalizedPattern = pattern.replace(/\*\*/g, '').replace(/\*/g, '');
            if (input.path.startsWith(normalizedPattern) || normalizedPattern === '') {
              const owners = Array.isArray(r.owners) ? (r.owners as readonly string[]) : [];
              for (const owner of owners) {
                if (!matchingOwners.includes(owner)) {
                  matchingOwners.push(owner);
                }
              }
            }
          }
          if (matchingOwners.length === 0) {
            return queryOwnersNoMatch(`No ownership rules match path '${input.path}'`);
          }
          return queryOwnersOk(matchingOwners);
        },
        toAttributionError,
      ),
    ),
};
