// Backlink — handler.ts
// Bidirectional reference tracking: reverse index from target back to sources.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as A from 'fp-ts/Array';
import { pipe } from 'fp-ts/function';

import type {
  BacklinkStorage,
  BacklinkGetBacklinksInput,
  BacklinkGetBacklinksOutput,
  BacklinkGetUnlinkedMentionsInput,
  BacklinkGetUnlinkedMentionsOutput,
  BacklinkReindexInput,
  BacklinkReindexOutput,
} from './types.js';

import {
  getBacklinksOk,
  getUnlinkedMentionsOk,
  reindexOk,
} from './types.js';

export interface BacklinkError {
  readonly code: string;
  readonly message: string;
}

export interface BacklinkHandler {
  readonly getBacklinks: (
    input: BacklinkGetBacklinksInput,
    storage: BacklinkStorage,
  ) => TE.TaskEither<BacklinkError, BacklinkGetBacklinksOutput>;
  readonly getUnlinkedMentions: (
    input: BacklinkGetUnlinkedMentionsInput,
    storage: BacklinkStorage,
  ) => TE.TaskEither<BacklinkError, BacklinkGetUnlinkedMentionsOutput>;
  readonly reindex: (
    input: BacklinkReindexInput,
    storage: BacklinkStorage,
  ) => TE.TaskEither<BacklinkError, BacklinkReindexOutput>;
}

// --- Pure helpers ---

const storageErr = (error: unknown): BacklinkError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Extract a string array from a JSON-encoded field, defaulting to empty. */
const parseJsonArray = (raw: unknown): readonly string[] => {
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

// --- Implementation ---

export const backlinkHandler: BacklinkHandler = {
  /**
   * Retrieve all source entities that have forward references pointing to this entity.
   * Reads the backlinks index for the given entity key and returns the
   * JSON-encoded source list. If no backlinks exist, returns an empty array.
   */
  getBacklinks: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('backlinks', input.entity),
        storageErr,
      ),
      TE.map((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => getBacklinksOk(JSON.stringify([])),
            (found) => {
              const sources = found['sources'];
              const parsed = typeof sources === 'string'
                ? sources
                : JSON.stringify(parseJsonArray(sources));
              return getBacklinksOk(parsed);
            },
          ),
        ),
      ),
    ),

  /**
   * Return text mentions of this entity that have not been converted into
   * formal forward references. These are stored separately from backlinks
   * in the 'mentions' relation for the entity key.
   */
  getUnlinkedMentions: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('mentions', input.entity),
        storageErr,
      ),
      TE.map((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => getUnlinkedMentionsOk(JSON.stringify([])),
            (found) => {
              const mentions = found['mentions'];
              const parsed = typeof mentions === 'string'
                ? mentions
                : JSON.stringify(parseJsonArray(mentions));
              return getUnlinkedMentionsOk(parsed);
            },
          ),
        ),
      ),
    ),

  /**
   * Rebuild the entire backlink reverse index from all forward references.
   * Scans every record in the 'refs' relation, extracts source->target pairs,
   * and writes an inverted index into the 'backlinks' relation keyed by target.
   */
  reindex: (_input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('refs'),
        storageErr,
      ),
      TE.chain((allRefs) => {
        // Build the reverse index: target -> set of sources
        const reverseIndex = new Map<string, Set<string>>();

        for (const ref of allRefs) {
          const source = String(ref['source'] ?? '');
          const targetsRaw = ref['targets'];
          const targets: readonly string[] =
            typeof targetsRaw === 'string'
              ? parseJsonArray(targetsRaw)
              : Array.isArray(targetsRaw)
                ? (targetsRaw as readonly string[])
                : [];

          for (const target of targets) {
            const existing = reverseIndex.get(target) ?? new Set<string>();
            existing.add(source);
            reverseIndex.set(target, existing);
          }
        }

        // Persist each target's backlink set
        const writes = Array.from(reverseIndex.entries()).map(
          ([target, sources]) =>
            TE.tryCatch(
              () =>
                storage.put('backlinks', target, {
                  entity: target,
                  sources: JSON.stringify([...sources]),
                }),
              storageErr,
            ),
        );

        // Count total backlink edges
        const totalCount = Array.from(reverseIndex.values()).reduce(
          (acc, s) => acc + s.size,
          0,
        );

        return pipe(
          writes.length > 0
            ? pipe(
                TE.sequenceArray(writes),
                TE.map(() => reindexOk(totalCount)),
              )
            : TE.right(reindexOk(0)),
        );
      }),
    ),
};
