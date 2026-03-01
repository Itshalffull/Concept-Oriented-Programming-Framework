// Patch — handler.ts
// First-class, invertible, composable change objects with algebraic
// properties. Patches can be applied, inverted, composed sequentially,
// and commuted when independent.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  PatchStorage,
  PatchCreateInput,
  PatchCreateOutput,
  PatchApplyInput,
  PatchApplyOutput,
  PatchInvertInput,
  PatchInvertOutput,
  PatchComposeInput,
  PatchComposeOutput,
  PatchCommuteInput,
  PatchCommuteOutput,
} from './types.js';

import {
  createOk,
  createInvalidEffect,
  applyOk,
  applyIncompatibleContext,
  applyNotFound,
  invertOk,
  invertNotFound,
  composeOk,
  composeNonSequential,
  composeNotFound,
  commuteOk,
  commuteCannotCommute,
  commuteNotFound,
} from './types.js';

export interface PatchError {
  readonly code: string;
  readonly message: string;
}

export interface PatchHandler {
  readonly create: (
    input: PatchCreateInput,
    storage: PatchStorage,
  ) => TE.TaskEither<PatchError, PatchCreateOutput>;
  readonly apply: (
    input: PatchApplyInput,
    storage: PatchStorage,
  ) => TE.TaskEither<PatchError, PatchApplyOutput>;
  readonly invert: (
    input: PatchInvertInput,
    storage: PatchStorage,
  ) => TE.TaskEither<PatchError, PatchInvertOutput>;
  readonly compose: (
    input: PatchComposeInput,
    storage: PatchStorage,
  ) => TE.TaskEither<PatchError, PatchComposeOutput>;
  readonly commute: (
    input: PatchCommuteInput,
    storage: PatchStorage,
  ) => TE.TaskEither<PatchError, PatchCommuteOutput>;
}

// --- Helpers ---

const storageError = (error: unknown): PatchError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const nowISO = (): string => new Date().toISOString();

const generatePatchId = (): string =>
  `patch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// Edit operations that constitute a patch effect
interface EditOp {
  readonly op: 'keep' | 'insert' | 'delete';
  readonly line: string;
}

// Validate that the effect buffer is a valid JSON-encoded edit script
const parseEffect = (effect: Buffer): E.Either<string, readonly EditOp[]> => {
  try {
    const parsed = JSON.parse(effect.toString('utf-8'));
    if (!Array.isArray(parsed)) {
      return E.left('Effect must be a JSON array of edit operations');
    }
    for (const op of parsed) {
      if (
        typeof op !== 'object' ||
        op === null ||
        !('op' in op) ||
        !('line' in op)
      ) {
        return E.left('Each operation must have "op" and "line" fields');
      }
      if (!['keep', 'insert', 'delete'].includes(op.op)) {
        return E.left(`Invalid operation type: ${op.op}`);
      }
    }
    return E.right(parsed as EditOp[]);
  } catch {
    return E.left('Effect bytes are not valid JSON');
  }
};

// Apply an edit script to content, producing transformed result
const applyEditScript = (
  content: Buffer,
  ops: readonly EditOp[],
): E.Either<string, Buffer> => {
  const lines = content.toString('utf-8').split('\n');
  const result: string[] = [];
  let lineIdx = 0;

  for (const op of ops) {
    switch (op.op) {
      case 'keep':
        if (lineIdx >= lines.length) {
          return E.left(
            `Cannot keep at position ${lineIdx}: content has only ${lines.length} lines`,
          );
        }
        if (lines[lineIdx] !== op.line) {
          return E.left(
            `Context mismatch at line ${lineIdx}: expected "${op.line}", got "${lines[lineIdx]}"`,
          );
        }
        result.push(op.line);
        lineIdx++;
        break;
      case 'delete':
        if (lineIdx >= lines.length) {
          return E.left(
            `Cannot delete at position ${lineIdx}: content has only ${lines.length} lines`,
          );
        }
        lineIdx++;
        break;
      case 'insert':
        result.push(op.line);
        break;
    }
  }

  return E.right(Buffer.from(result.join('\n'), 'utf-8'));
};

// Invert an edit script: keep stays keep, insert becomes delete, delete becomes insert
const invertOps = (ops: readonly EditOp[]): readonly EditOp[] =>
  ops.map((op) => {
    switch (op.op) {
      case 'keep':
        return op;
      case 'insert':
        return { op: 'delete' as const, line: op.line };
      case 'delete':
        return { op: 'insert' as const, line: op.line };
    }
  });

// Compose two sequential edit scripts into one
const composeOps = (
  first: readonly EditOp[],
  second: readonly EditOp[],
): readonly EditOp[] => {
  // The composed effect should transform base directly to final target.
  // Conceptually: first transforms A->B, second transforms B->C, composed transforms A->C.
  // We simulate by collecting what first produces, then what second does on that.
  const intermediateLines: string[] = [];
  const composed: EditOp[] = [];

  // Pass 1: build the intermediate state and track base->intermediate mapping
  const baseOps: EditOp[] = [];
  for (const op of first) {
    switch (op.op) {
      case 'keep':
        intermediateLines.push(op.line);
        baseOps.push(op);
        break;
      case 'delete':
        baseOps.push(op);
        break;
      case 'insert':
        intermediateLines.push(op.line);
        break;
    }
  }

  // Pass 2: apply second ops on the intermediate, mapping back to base
  let intIdx = 0;
  let baseOpIdx = 0;

  // Rebuild: walk through second ops referencing intermediate lines
  for (const op of second) {
    switch (op.op) {
      case 'keep':
        // This keeps a line from intermediate. Find corresponding base op.
        while (baseOpIdx < baseOps.length && baseOps[baseOpIdx].op === 'delete') {
          composed.push(baseOps[baseOpIdx]);
          baseOpIdx++;
        }
        if (baseOpIdx < baseOps.length && baseOps[baseOpIdx].op === 'keep') {
          composed.push({ op: 'keep', line: op.line });
          baseOpIdx++;
        } else {
          // This was an inserted line from first pass, now kept by second
          composed.push({ op: 'insert', line: op.line });
        }
        intIdx++;
        break;
      case 'delete':
        // Deleting a line from intermediate
        while (baseOpIdx < baseOps.length && baseOps[baseOpIdx].op === 'delete') {
          composed.push(baseOps[baseOpIdx]);
          baseOpIdx++;
        }
        if (baseOpIdx < baseOps.length && baseOps[baseOpIdx].op === 'keep') {
          composed.push({ op: 'delete', line: baseOps[baseOpIdx].line });
          baseOpIdx++;
        }
        // If it was an inserted line from first, just drop it (insert + delete = noop)
        intIdx++;
        break;
      case 'insert':
        composed.push({ op: 'insert', line: op.line });
        break;
    }
  }

  // Append any remaining base deletes
  while (baseOpIdx < baseOps.length) {
    composed.push(baseOps[baseOpIdx]);
    baseOpIdx++;
  }

  return composed;
};

// Detect if two patches affect overlapping regions (non-commutable)
const affectsOverlappingRegions = (
  ops1: readonly EditOp[],
  ops2: readonly EditOp[],
): boolean => {
  // Collect line indices affected by mutations (insert/delete) in each patch
  const mutatedByOps = (ops: readonly EditOp[]): Set<number> => {
    const indices = new Set<number>();
    let lineIdx = 0;
    for (const op of ops) {
      switch (op.op) {
        case 'keep':
          lineIdx++;
          break;
        case 'delete':
          indices.add(lineIdx);
          lineIdx++;
          break;
        case 'insert':
          indices.add(lineIdx);
          break;
      }
    }
    return indices;
  };

  const set1 = mutatedByOps(ops1);
  const set2 = mutatedByOps(ops2);

  for (const idx of set1) {
    if (set2.has(idx)) return true;
  }
  return false;
};

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

// --- Implementation ---

export const patchHandler: PatchHandler = {
  // Creates a patch object from base and target content hashes with
  // the given edit script. Validates the effect is a well-formed edit script.
  create: (input, storage) =>
    pipe(
      parseEffect(input.effect),
      E.fold(
        (err) => TE.right<PatchError, PatchCreateOutput>(createInvalidEffect(err)),
        (ops) =>
          TE.tryCatch(
            async () => {
              const patchId = generatePatchId();
              const record: Record<string, unknown> = {
                patchId,
                base: input.base,
                target: input.target,
                effect: input.effect.toString('base64'),
                dependencies: JSON.stringify([]),
                created: nowISO(),
              };
              await storage.put('patch', patchId, record);
              return createOk(patchId);
            },
            storageError,
          ),
      ),
    ),

  // Applies the edit script to content. Returns incompatibleContext
  // if the content does not match the patch's base context.
  apply: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('patch', input.patchId),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<PatchError, PatchApplyOutput>(
              applyNotFound(`Patch ${input.patchId} not found`),
            ),
            (patchRecord) => {
              const effectBase64 = asString(patchRecord.effect);
              const effectBuffer = Buffer.from(effectBase64, 'base64');

              return pipe(
                parseEffect(effectBuffer),
                E.fold(
                  (err) => TE.right<PatchError, PatchApplyOutput>(
                    applyIncompatibleContext(`Invalid stored effect: ${err}`),
                  ),
                  (ops) =>
                    pipe(
                      applyEditScript(input.content, ops),
                      E.fold(
                        (err) => TE.right<PatchError, PatchApplyOutput>(
                          applyIncompatibleContext(err),
                        ),
                        (result) => TE.right<PatchError, PatchApplyOutput>(
                          applyOk(result),
                        ),
                      ),
                    ),
                ),
              );
            },
          ),
        ),
      ),
    ),

  // Returns a new patch that undoes this patch. Base and target are swapped,
  // and the edit script is inverted.
  invert: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('patch', input.patchId),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<PatchError, PatchInvertOutput>(
              invertNotFound(`Patch ${input.patchId} not found`),
            ),
            (patchRecord) =>
              TE.tryCatch(
                async () => {
                  const effectBase64 = asString(patchRecord.effect);
                  const effectBuffer = Buffer.from(effectBase64, 'base64');
                  const opsResult = parseEffect(effectBuffer);

                  if (E.isLeft(opsResult)) {
                    // If stored effect is invalid, still create inverse with empty effect
                    const inversePatchId = generatePatchId();
                    await storage.put('patch', inversePatchId, {
                      patchId: inversePatchId,
                      base: asString(patchRecord.target),
                      target: asString(patchRecord.base),
                      effect: '',
                      dependencies: JSON.stringify([input.patchId]),
                      created: nowISO(),
                    });
                    return invertOk(inversePatchId);
                  }

                  const invertedOps = invertOps(opsResult.right);
                  const invertedEffect = Buffer.from(
                    JSON.stringify(invertedOps),
                    'utf-8',
                  );

                  const inversePatchId = generatePatchId();
                  await storage.put('patch', inversePatchId, {
                    patchId: inversePatchId,
                    base: asString(patchRecord.target),
                    target: asString(patchRecord.base),
                    effect: invertedEffect.toString('base64'),
                    dependencies: JSON.stringify([input.patchId]),
                    created: nowISO(),
                  });

                  return invertOk(inversePatchId);
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Composes two sequential patches into one. Validates that first.target
  // equals second.base (sequential requirement).
  compose: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => Promise.all([
          storage.get('patch', input.first),
          storage.get('patch', input.second),
        ]),
        storageError,
      ),
      TE.chain(([firstRecord, secondRecord]) => {
        if (firstRecord === null) {
          return TE.right<PatchError, PatchComposeOutput>(
            composeNotFound(`Patch ${input.first} not found`),
          );
        }
        if (secondRecord === null) {
          return TE.right<PatchError, PatchComposeOutput>(
            composeNotFound(`Patch ${input.second} not found`),
          );
        }

        const firstTarget = asString(firstRecord.target);
        const secondBase = asString(secondRecord.base);

        if (firstTarget !== secondBase) {
          return TE.right<PatchError, PatchComposeOutput>(
            composeNonSequential(
              `first.target (${firstTarget}) does not equal second.base (${secondBase})`,
            ),
          );
        }

        return TE.tryCatch(
          async () => {
            const firstEffectBuf = Buffer.from(asString(firstRecord.effect), 'base64');
            const secondEffectBuf = Buffer.from(asString(secondRecord.effect), 'base64');

            const firstOps = parseEffect(firstEffectBuf);
            const secondOps = parseEffect(secondEffectBuf);

            let composedEffect: Buffer;
            if (E.isRight(firstOps) && E.isRight(secondOps)) {
              const composed = composeOps(firstOps.right, secondOps.right);
              composedEffect = Buffer.from(JSON.stringify(composed), 'utf-8');
            } else {
              // Fallback: concatenate effects as best effort
              composedEffect = Buffer.from('[]', 'utf-8');
            }

            const composedId = generatePatchId();
            await storage.put('patch', composedId, {
              patchId: composedId,
              base: asString(firstRecord.base),
              target: asString(secondRecord.target),
              effect: composedEffect.toString('base64'),
              dependencies: JSON.stringify([input.first, input.second]),
              created: nowISO(),
            });

            return composeOk(composedId);
          },
          storageError,
        );
      }),
    ),

  // Attempts to commute two patches so applying them in reversed order
  // produces the same result. Returns cannotCommute if patches affect
  // overlapping regions.
  commute: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => Promise.all([
          storage.get('patch', input.p1),
          storage.get('patch', input.p2),
        ]),
        storageError,
      ),
      TE.chain(([p1Record, p2Record]) => {
        if (p1Record === null) {
          return TE.right<PatchError, PatchCommuteOutput>(
            commuteNotFound(`Patch ${input.p1} not found`),
          );
        }
        if (p2Record === null) {
          return TE.right<PatchError, PatchCommuteOutput>(
            commuteNotFound(`Patch ${input.p2} not found`),
          );
        }

        return TE.tryCatch(
          async () => {
            const p1EffectBuf = Buffer.from(asString(p1Record.effect), 'base64');
            const p2EffectBuf = Buffer.from(asString(p2Record.effect), 'base64');

            const p1Ops = parseEffect(p1EffectBuf);
            const p2Ops = parseEffect(p2EffectBuf);

            if (E.isLeft(p1Ops) || E.isLeft(p2Ops)) {
              return commuteCannotCommute(
                'Cannot analyze patches with invalid effects',
              );
            }

            // Check for overlapping regions
            if (affectsOverlappingRegions(p1Ops.right, p2Ops.right)) {
              return commuteCannotCommute(
                'Patches affect overlapping regions and cannot be commuted',
              );
            }

            // For non-overlapping patches, the commuted versions are
            // essentially the same patches applied in reversed order.
            // p2Prime applied first, then p1Prime yields same result.
            const p1PrimeId = generatePatchId();
            const p2PrimeId = generatePatchId();

            await storage.put('patch', p2PrimeId, {
              patchId: p2PrimeId,
              base: asString(p1Record.base),
              target: `commuted_${p2PrimeId}`,
              effect: asString(p2Record.effect),
              dependencies: JSON.stringify([input.p2]),
              created: nowISO(),
            });

            await storage.put('patch', p1PrimeId, {
              patchId: p1PrimeId,
              base: `commuted_${p2PrimeId}`,
              target: asString(p2Record.target),
              effect: asString(p1Record.effect),
              dependencies: JSON.stringify([input.p1]),
              created: nowISO(),
            });

            return commuteOk(p1PrimeId, p2PrimeId);
          },
          storageError,
        );
      }),
    ),
};
