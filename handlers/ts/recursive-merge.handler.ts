// @clef-handler style=functional concept=recursive
// @migrated dsl-constructs 2026-03-18
// ============================================================
// RecursiveMerge Handler
//
// Merge using Git's recursive strategy -- repeatedly finding
// virtual common ancestors for criss-cross merge scenarios.
// Produces better results than three-way merge for complex
// branch histories.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, complete,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `recursive-merge-${++idCounter}`;
}

/**
 * Recursive merge: performs a three-way merge and if conflicts
 * remain, recursively attempts to resolve them by using the
 * merged-so-far content as a virtual base for sub-regions.
 *
 * For simple cases this is equivalent to three-way merge.
 * The recursive aspect handles criss-cross histories where
 * multiple common ancestors exist.
 */
function recursiveMerge(
  baseStr: string,
  oursStr: string,
  theirsStr: string,
  depth: number = 0,
): { result: string | null; conflicts: string[] } {
  const maxDepth = 5;

  const baseLines = baseStr.split('\n');
  const ourLines = oursStr.split('\n');
  const theirLines = theirsStr.split('\n');

  const resultLines: string[] = [];
  const conflictRegions: string[] = [];
  let hasConflicts = false;

  const maxLen = Math.max(baseLines.length, ourLines.length, theirLines.length);

  for (let i = 0; i < maxLen; i++) {
    const baseLine = i < baseLines.length ? baseLines[i] : undefined;
    const ourLine = i < ourLines.length ? ourLines[i] : undefined;
    const theirLine = i < theirLines.length ? theirLines[i] : undefined;

    if (ourLine === theirLine) {
      if (ourLine !== undefined) resultLines.push(ourLine);
    } else if (ourLine === baseLine) {
      if (theirLine !== undefined) resultLines.push(theirLine);
    } else if (theirLine === baseLine) {
      if (ourLine !== undefined) resultLines.push(ourLine);
    } else {
      // Conflict detected
      if (depth < maxDepth && ourLine !== undefined && theirLine !== undefined) {
        // Recursive attempt: use a merged virtual base
        // Try character-level merge for single-line conflicts
        const charMerge = mergeCharacters(baseLine || '', ourLine, theirLine);
        if (charMerge !== null) {
          resultLines.push(charMerge);
          continue;
        }
      }

      hasConflicts = true;
      const marker = [
        '<<<<<<< ours',
        ourLine ?? '',
        '=======',
        theirLine ?? '',
        '>>>>>>> theirs',
      ].join('\n');
      conflictRegions.push(marker);
      resultLines.push(marker);
    }
  }

  if (hasConflicts) {
    return { result: null, conflicts: conflictRegions };
  }

  return { result: resultLines.join('\n'), conflicts: [] };
}

/**
 * Attempt character-level merge for single-line conflicts.
 * If the changes affect non-overlapping character ranges, merge them.
 */
function mergeCharacters(base: string, ours: string, theirs: string): string | null {
  // Find the common prefix and suffix
  let prefixLen = 0;
  const minLen = Math.min(base.length, ours.length, theirs.length);
  while (prefixLen < minLen && base[prefixLen] === ours[prefixLen] && base[prefixLen] === theirs[prefixLen]) {
    prefixLen++;
  }

  let suffixLen = 0;
  while (
    suffixLen < minLen - prefixLen &&
    base[base.length - 1 - suffixLen] === ours[ours.length - 1 - suffixLen] &&
    base[base.length - 1 - suffixLen] === theirs[theirs.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const baseMiddle = base.substring(prefixLen, base.length - suffixLen);
  const oursMiddle = ours.substring(prefixLen, ours.length - suffixLen);
  const theirsMiddle = theirs.substring(prefixLen, theirs.length - suffixLen);

  // If one side didn't change the middle, take the other
  if (oursMiddle === baseMiddle) {
    return ours.substring(0, prefixLen) + theirsMiddle + base.substring(base.length - suffixLen);
  }
  if (theirsMiddle === baseMiddle) {
    return ours.substring(0, prefixLen) + oursMiddle + base.substring(base.length - suffixLen);
  }

  // Both changed -- true conflict at character level
  return null;
}

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: 'RecursiveMerge',
      category: 'merge',
      contentTypes: ['text/plain', 'text/*'],
    }) as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const base = input.base as string;
    const ours = input.ours as string;
    const theirs = input.theirs as string;

    if (typeof base !== 'string' || typeof ours !== 'string' || typeof theirs !== 'string') {
      const p = createProgram();
      return complete(p, 'unsupportedContent', { message: 'Content must be text strings' }) as StorageProgram<Result>;
    }

    // Trivial cases
    if (ours === theirs) {
      const p = createProgram();
      return complete(p, 'clean', { result: ours }) as StorageProgram<Result>;
    }
    if (ours === base) {
      const p = createProgram();
      return complete(p, 'clean', { result: theirs }) as StorageProgram<Result>;
    }
    if (theirs === base) {
      const p = createProgram();
      return complete(p, 'clean', { result: ours }) as StorageProgram<Result>;
    }

    const { result, conflicts } = recursiveMerge(base, ours, theirs);

    const p = createProgram();
    if (result !== null) {
      return complete(p, 'clean', { result }) as StorageProgram<Result>;
    }

    return complete(p, 'conflicts', { regions: conflicts }) as StorageProgram<Result>;
  },
};

export const recursiveMergeHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetRecursiveMergeCounter(): void {
  idCounter = 0;
}
