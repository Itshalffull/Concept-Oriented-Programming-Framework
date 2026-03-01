// Diff — handler.ts
// Compute the minimal representation of differences between two content
// states, using a pluggable algorithm selected by content type and context.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  DiffStorage,
  DiffRegisterProviderInput,
  DiffRegisterProviderOutput,
  DiffDiffInput,
  DiffDiffOutput,
  DiffPatchInput,
  DiffPatchOutput,
} from './types.js';

import {
  registerProviderOk,
  registerProviderDuplicate,
  diffIdentical,
  diffDiffed,
  diffNoProvider,
  patchOk,
  patchIncompatible,
} from './types.js';

export interface DiffError {
  readonly code: string;
  readonly message: string;
}

export interface DiffHandler {
  readonly registerProvider: (
    input: DiffRegisterProviderInput,
    storage: DiffStorage,
  ) => TE.TaskEither<DiffError, DiffRegisterProviderOutput>;
  readonly diff: (
    input: DiffDiffInput,
    storage: DiffStorage,
  ) => TE.TaskEither<DiffError, DiffDiffOutput>;
  readonly patch: (
    input: DiffPatchInput,
    storage: DiffStorage,
  ) => TE.TaskEither<DiffError, DiffPatchOutput>;
}

// --- Helpers ---

const storageError = (error: unknown): DiffError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const nowISO = (): string => new Date().toISOString();

// Simple line-level Myers-style diff implementation.
// Computes an edit script as a JSON-encoded array of operations:
// { op: 'keep' | 'insert' | 'delete', line: string }
interface EditOp {
  readonly op: 'keep' | 'insert' | 'delete';
  readonly line: string;
}

const computeEditScript = (textA: string, textB: string): readonly EditOp[] => {
  const linesA = textA.split('\n');
  const linesB = textB.split('\n');
  const ops: EditOp[] = [];

  // LCS-based diff for correctness
  const m = linesA.length;
  const n = linesB.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce edit operations
  let i = m;
  let j = n;
  const reversedOps: EditOp[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      reversedOps.push({ op: 'keep', line: linesA[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      reversedOps.push({ op: 'insert', line: linesB[j - 1] });
      j--;
    } else {
      reversedOps.push({ op: 'delete', line: linesA[i - 1] });
      i--;
    }
  }

  return reversedOps.reverse();
};

const computeEditDistance = (ops: readonly EditOp[]): number =>
  ops.filter((op) => op.op !== 'keep').length;

// Apply an edit script to content to produce transformed result
const applyEditScript = (
  content: string,
  editScript: readonly EditOp[],
): E.Either<string, string> => {
  const contentLines = content.split('\n');
  const resultLines: string[] = [];
  let contentIdx = 0;

  for (const op of editScript) {
    switch (op.op) {
      case 'keep':
        if (contentIdx >= contentLines.length) {
          return E.left(
            `Edit script incompatible: expected line "${op.line}" at position ${contentIdx}, but content has only ${contentLines.length} lines`,
          );
        }
        if (contentLines[contentIdx] !== op.line) {
          return E.left(
            `Edit script incompatible at line ${contentIdx}: expected "${op.line}", got "${contentLines[contentIdx]}"`,
          );
        }
        resultLines.push(op.line);
        contentIdx++;
        break;
      case 'delete':
        if (contentIdx >= contentLines.length) {
          return E.left(
            `Edit script incompatible: cannot delete at position ${contentIdx}`,
          );
        }
        contentIdx++;
        break;
      case 'insert':
        resultLines.push(op.line);
        break;
    }
  }

  return E.right(resultLines.join('\n'));
};

const parseContentTypes = (raw: unknown): readonly string[] => {
  if (Array.isArray(raw)) {
    return raw as string[];
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  }
  return [];
};

// --- Implementation ---

export const diffHandler: DiffHandler = {
  // Registers a new diff algorithm provider for the given content types.
  // Returns duplicate if the provider name is already registered.
  registerProvider: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('diff_provider', input.name),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  const record: Record<string, unknown> = {
                    name: input.name,
                    contentTypes: JSON.stringify(input.contentTypes),
                    createdAt: nowISO(),
                  };
                  await storage.put('diff_provider', input.name, record);

                  // If no default provider exists, set this as default
                  const defaultRecord = await storage.get('diff_config', 'default');
                  if (defaultRecord === null) {
                    await storage.put('diff_config', 'default', {
                      defaultProvider: input.name,
                    });
                  }

                  return registerProviderOk(input.name);
                },
                storageError,
              ),
            () =>
              TE.right<DiffError, DiffRegisterProviderOutput>(
                registerProviderDuplicate(`Provider "${input.name}" already registered`),
              ),
          ),
        ),
      ),
    ),

  // Computes the diff between contentA and contentB.
  // Returns identical if contents are the same, diffed with edit script otherwise.
  // Selects provider by algorithm param, content type, or default.
  diff: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // If contents are byte-identical, short-circuit
          if (input.contentA === input.contentB) {
            return diffIdentical();
          }

          // Resolve provider: by explicit algorithm name, or default
          const requestedAlgo = pipe(
            input.algorithm,
            O.getOrElse(() => ''),
          );

          if (requestedAlgo !== '') {
            const provider = await storage.get('diff_provider', requestedAlgo);
            if (provider === null) {
              return diffNoProvider(`No provider registered with name "${requestedAlgo}"`);
            }
          } else {
            // Check that at least one provider exists
            const defaultConfig = await storage.get('diff_config', 'default');
            if (defaultConfig === null) {
              return diffNoProvider('No diff providers registered');
            }
          }

          // Compute edit script using built-in LCS-based diff
          const editOps = computeEditScript(input.contentA, input.contentB);
          const distance = computeEditDistance(editOps);
          const editScript = Buffer.from(JSON.stringify(editOps), 'utf-8');

          // Cache the result keyed by content pair
          const cacheKey = `${input.contentA.length}:${input.contentB.length}:${distance}`;
          await storage.put('diff_cache', cacheKey, {
            contentA: input.contentA,
            contentB: input.contentB,
            editScript: editScript.toString('base64'),
            distance,
            createdAt: nowISO(),
          });

          return diffDiffed(editScript, distance);
        },
        storageError,
      ),
    ),

  // Applies an edit script to content, producing transformed result.
  // Returns incompatible if the edit script does not apply cleanly.
  patch: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          let editOps: readonly EditOp[];
          try {
            editOps = JSON.parse(input.editScript.toString('utf-8')) as EditOp[];
          } catch {
            return patchIncompatible('Edit script is not valid JSON');
          }

          return pipe(
            applyEditScript(input.content, editOps),
            E.fold(
              (err) => patchIncompatible(err),
              (result) => patchOk(result),
            ),
          );
        },
        storageError,
      ),
    ),
};
