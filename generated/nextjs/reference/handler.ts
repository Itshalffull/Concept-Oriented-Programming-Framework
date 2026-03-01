// Reference — handler.ts
// Forward reference tracking: source-to-target link graph with deduplication
// and broken-link detection.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ReferenceStorage,
  ReferenceAddRefInput,
  ReferenceAddRefOutput,
  ReferenceRemoveRefInput,
  ReferenceRemoveRefOutput,
  ReferenceGetRefsInput,
  ReferenceGetRefsOutput,
  ReferenceResolveTargetInput,
  ReferenceResolveTargetOutput,
} from './types.js';

import {
  addRefOk,
  addRefExists,
  removeRefOk,
  removeRefNotfound,
  getRefsOk,
  getRefsNotfound,
  resolveTargetOk,
} from './types.js';

export interface ReferenceError {
  readonly code: string;
  readonly message: string;
}

export interface ReferenceHandler {
  readonly addRef: (
    input: ReferenceAddRefInput,
    storage: ReferenceStorage,
  ) => TE.TaskEither<ReferenceError, ReferenceAddRefOutput>;
  readonly removeRef: (
    input: ReferenceRemoveRefInput,
    storage: ReferenceStorage,
  ) => TE.TaskEither<ReferenceError, ReferenceRemoveRefOutput>;
  readonly getRefs: (
    input: ReferenceGetRefsInput,
    storage: ReferenceStorage,
  ) => TE.TaskEither<ReferenceError, ReferenceGetRefsOutput>;
  readonly resolveTarget: (
    input: ReferenceResolveTargetInput,
    storage: ReferenceStorage,
  ) => TE.TaskEither<ReferenceError, ReferenceResolveTargetOutput>;
}

// --- Pure helpers ---

const storageErr = (error: unknown): ReferenceError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Parse a JSON-encoded string array, returning empty on failure. */
const parseTargets = (raw: unknown): readonly string[] => {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? (raw as readonly string[]) : [];
};

/** Composite key for the ref edge to support per-edge storage. */
const refEdgeKey = (source: string, target: string): string =>
  `${source}::${target}`;

// --- Implementation ---

export const referenceHandler: ReferenceHandler = {
  /**
   * Add a forward reference from source to target.
   * Uses a composite edge key for uniqueness checking.
   * Appends the target to the source's target set stored in the 'refs' relation.
   */
  addRef: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('ref_edges', refEdgeKey(input.source, input.target)),
        storageErr,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              pipe(
                // Store the edge
                TE.tryCatch(
                  () =>
                    storage.put('ref_edges', refEdgeKey(input.source, input.target), {
                      source: input.source,
                      target: input.target,
                      createdAt: new Date().toISOString(),
                    }),
                  storageErr,
                ),
                // Also update the source's aggregate target list
                TE.chain(() =>
                  TE.tryCatch(
                    async () => {
                      const sourceRec = await storage.get('refs', input.source);
                      const currentTargets = sourceRec
                        ? parseTargets(sourceRec['targets'])
                        : [];
                      const updatedTargets = [...currentTargets, input.target];
                      await storage.put('refs', input.source, {
                        source: input.source,
                        targets: JSON.stringify(updatedTargets),
                      });
                    },
                    storageErr,
                  ),
                ),
                TE.map(() => addRefOk(input.source, input.target)),
              ),
            () => TE.right(addRefExists(input.source, input.target)),
          ),
        ),
      ),
    ),

  /**
   * Remove a forward reference from source to target.
   * Deletes the edge record and updates the source's aggregate list.
   */
  removeRef: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('ref_edges', refEdgeKey(input.source, input.target)),
        storageErr,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () => TE.right(removeRefNotfound(input.source, input.target)),
            () =>
              pipe(
                TE.tryCatch(
                  () => storage.delete('ref_edges', refEdgeKey(input.source, input.target)),
                  storageErr,
                ),
                TE.chain(() =>
                  TE.tryCatch(
                    async () => {
                      const sourceRec = await storage.get('refs', input.source);
                      const currentTargets = sourceRec
                        ? parseTargets(sourceRec['targets'])
                        : [];
                      const updatedTargets = currentTargets.filter(
                        (t) => t !== input.target,
                      );
                      await storage.put('refs', input.source, {
                        source: input.source,
                        targets: JSON.stringify(updatedTargets),
                      });
                    },
                    storageErr,
                  ),
                ),
                TE.map(() => removeRefOk(input.source, input.target)),
              ),
          ),
        ),
      ),
    ),

  /**
   * Get all targets referenced by a source entity.
   * Returns the JSON-encoded target list from the aggregate record.
   */
  getRefs: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('refs', input.source),
        storageErr,
      ),
      TE.map((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => getRefsNotfound(input.source),
            (found) => {
              const targets = found['targets'];
              return getRefsOk(
                typeof targets === 'string' ? targets : JSON.stringify([]),
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Check whether a referenced target entity actually exists.
   * Looks up the target in the 'entities' relation to detect broken links.
   */
  resolveTarget: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('entities', input.target),
        storageErr,
      ),
      TE.map((record) => resolveTargetOk(record !== null)),
    ),
};
