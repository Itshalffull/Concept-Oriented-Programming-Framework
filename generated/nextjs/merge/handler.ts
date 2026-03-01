// Merge — handler.ts
// Combine two divergent versions of content sharing a common ancestor,
// producing a unified result or identifying conflicts. Strategy is
// selected by content type and configuration.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  MergeStorage,
  MergeRegisterStrategyInput,
  MergeRegisterStrategyOutput,
  MergeMergeInput,
  MergeMergeOutput,
  MergeResolveConflictInput,
  MergeResolveConflictOutput,
  MergeFinalizeInput,
  MergeFinalizeOutput,
} from './types.js';

import {
  registerStrategyOk,
  registerStrategyDuplicate,
  mergeClean,
  mergeConflicts,
  mergeNoStrategy,
  resolveConflictOk,
  resolveConflictInvalidIndex,
  resolveConflictAlreadyResolved,
  finalizeOk,
  finalizeUnresolvedConflicts,
} from './types.js';

export interface MergeError {
  readonly code: string;
  readonly message: string;
}

export interface MergeHandler {
  readonly registerStrategy: (
    input: MergeRegisterStrategyInput,
    storage: MergeStorage,
  ) => TE.TaskEither<MergeError, MergeRegisterStrategyOutput>;
  readonly merge: (
    input: MergeMergeInput,
    storage: MergeStorage,
  ) => TE.TaskEither<MergeError, MergeMergeOutput>;
  readonly resolveConflict: (
    input: MergeResolveConflictInput,
    storage: MergeStorage,
  ) => TE.TaskEither<MergeError, MergeResolveConflictOutput>;
  readonly finalize: (
    input: MergeFinalizeInput,
    storage: MergeStorage,
  ) => TE.TaskEither<MergeError, MergeFinalizeOutput>;
}

// --- Helpers ---

const storageError = (error: unknown): MergeError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const nowISO = (): string => new Date().toISOString();

const generateId = (): string =>
  `merge_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// Conflict record stored in the merge state
interface ConflictRecord {
  readonly region: string;
  readonly oursContent: string;
  readonly theirsContent: string;
  readonly status: 'unresolved' | 'resolved';
  readonly resolution: string | null;
}

// Three-way line-level merge: compares base with ours and theirs,
// merging non-conflicting changes and flagging conflicts.
const threeWayMerge = (
  base: string,
  ours: string,
  theirs: string,
): { readonly result: string; readonly conflicts: readonly ConflictRecord[] } => {
  const baseLines = base.split('\n');
  const ourLines = ours.split('\n');
  const theirLines = theirs.split('\n');
  const maxLen = Math.max(baseLines.length, ourLines.length, theirLines.length);

  const resultLines: string[] = [];
  const conflicts: ConflictRecord[] = [];

  for (let i = 0; i < maxLen; i++) {
    const baseLine = i < baseLines.length ? baseLines[i] : undefined;
    const ourLine = i < ourLines.length ? ourLines[i] : undefined;
    const theirLine = i < theirLines.length ? theirLines[i] : undefined;

    const ourChanged = ourLine !== baseLine;
    const theirChanged = theirLine !== baseLine;

    if (!ourChanged && !theirChanged) {
      // Neither side changed — keep base
      resultLines.push(baseLine ?? '');
    } else if (ourChanged && !theirChanged) {
      // Only our side changed — take ours
      if (ourLine !== undefined) {
        resultLines.push(ourLine);
      }
    } else if (!ourChanged && theirChanged) {
      // Only their side changed — take theirs
      if (theirLine !== undefined) {
        resultLines.push(theirLine);
      }
    } else if (ourLine === theirLine) {
      // Both changed identically — take either
      resultLines.push(ourLine ?? '');
    } else {
      // Both changed differently — conflict
      conflicts.push({
        region: `line:${i}`,
        oursContent: ourLine ?? '',
        theirsContent: theirLine ?? '',
        status: 'unresolved',
        resolution: null,
      });
      // Insert conflict marker placeholder in result
      resultLines.push(`<<<CONFLICT:${conflicts.length - 1}>>>`);
    }
  }

  return { result: resultLines.join('\n'), conflicts };
};

const parseConflicts = (raw: unknown): ConflictRecord[] => {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as ConflictRecord[];
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) {
    return raw as ConflictRecord[];
  }
  return [];
};

// --- Implementation ---

export const mergeHandler: MergeHandler = {
  // Registers a merge strategy provider.
  // Returns duplicate if strategy name is already registered.
  registerStrategy: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('merge_strategy', input.name),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  await storage.put('merge_strategy', input.name, {
                    name: input.name,
                    contentTypes: JSON.stringify(input.contentTypes),
                    createdAt: nowISO(),
                  });

                  // Set as default strategy if none exists
                  const defaultRecord = await storage.get('merge_config', 'default');
                  if (defaultRecord === null) {
                    await storage.put('merge_config', 'default', {
                      defaultStrategy: input.name,
                    });
                  }

                  return registerStrategyOk(input.name);
                },
                storageError,
              ),
            () =>
              TE.right<MergeError, MergeRegisterStrategyOutput>(
                registerStrategyDuplicate(`Strategy "${input.name}" already registered`),
              ),
          ),
        ),
      ),
    ),

  // Performs a three-way merge of base, ours, and theirs.
  // Returns clean if no conflicts, or conflicts with a merge ID for resolution.
  merge: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Resolve strategy
          const requestedStrategy = pipe(
            input.strategy,
            O.getOrElse(() => ''),
          );

          if (requestedStrategy !== '') {
            const strategy = await storage.get('merge_strategy', requestedStrategy);
            if (strategy === null) {
              return mergeNoStrategy(`No strategy registered with name "${requestedStrategy}"`);
            }
          } else {
            const defaultConfig = await storage.get('merge_config', 'default');
            if (defaultConfig === null) {
              return mergeNoStrategy('No merge strategies registered');
            }
          }

          const { result, conflicts } = threeWayMerge(input.base, input.ours, input.theirs);

          if (conflicts.length === 0) {
            return mergeClean(result);
          }

          // Store merge state for conflict resolution workflow
          const mergeId = generateId();
          await storage.put('active_merge', mergeId, {
            id: mergeId,
            base: input.base,
            ours: input.ours,
            theirs: input.theirs,
            result,
            conflicts: JSON.stringify(conflicts),
            createdAt: nowISO(),
            updatedAt: nowISO(),
          });

          return mergeConflicts(mergeId, conflicts.length);
        },
        storageError,
      ),
    ),

  // Resolves a specific conflict by index. Returns remaining unresolved count.
  resolveConflict: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('active_merge', String(input.mergeId)),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.left<MergeError>({
                code: 'MERGE_NOT_FOUND',
                message: `Merge ${String(input.mergeId)} not found`,
              }),
            (mergeState) =>
              TE.tryCatch(
                async () => {
                  const conflicts = parseConflicts(mergeState.conflicts);

                  if (input.conflictIndex < 0 || input.conflictIndex >= conflicts.length) {
                    return resolveConflictInvalidIndex(
                      `Conflict index ${input.conflictIndex} out of range (0-${conflicts.length - 1})`,
                    );
                  }

                  const conflict = conflicts[input.conflictIndex];
                  if (conflict.status === 'resolved') {
                    return resolveConflictAlreadyResolved(
                      `Conflict ${input.conflictIndex} already resolved`,
                    );
                  }

                  // Apply resolution
                  const resolutionText = input.resolution.toString('utf-8');
                  const updatedConflicts = conflicts.map((c, idx) =>
                    idx === input.conflictIndex
                      ? { ...c, status: 'resolved' as const, resolution: resolutionText }
                      : c,
                  );

                  const remaining = updatedConflicts.filter(
                    (c) => c.status === 'unresolved',
                  ).length;

                  await storage.put('active_merge', String(input.mergeId), {
                    ...mergeState,
                    conflicts: JSON.stringify(updatedConflicts),
                    updatedAt: nowISO(),
                  });

                  return resolveConflictOk(remaining);
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Finalizes a merge after all conflicts are resolved.
  // Returns the merged result with conflict markers replaced by resolutions.
  finalize: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('active_merge', String(input.mergeId)),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.left<MergeError>({
                code: 'MERGE_NOT_FOUND',
                message: `Merge ${String(input.mergeId)} not found`,
              }),
            (mergeState) =>
              TE.tryCatch(
                async () => {
                  const conflicts = parseConflicts(mergeState.conflicts);
                  const unresolved = conflicts.filter(
                    (c) => c.status === 'unresolved',
                  );

                  if (unresolved.length > 0) {
                    return finalizeUnresolvedConflicts(unresolved.length);
                  }

                  // Replace conflict markers with resolved content
                  let result = typeof mergeState.result === 'string'
                    ? mergeState.result
                    : '';

                  for (let i = 0; i < conflicts.length; i++) {
                    const marker = `<<<CONFLICT:${i}>>>`;
                    const resolution = conflicts[i].resolution ?? '';
                    result = result.replace(marker, resolution);
                  }

                  // Clean up the active merge record
                  await storage.delete('active_merge', String(input.mergeId));

                  return finalizeOk(result);
                },
                storageError,
              ),
          ),
        ),
      ),
    ),
};
