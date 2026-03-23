// @clef-handler style=functional concept=three-way
// @migrated dsl-constructs 2026-03-18
// ============================================================
// ThreeWayMerge Handler
//
// Merge two divergent text files relative to a common base using
// classic three-way merge. Standard algorithm used in Git, POSIX
// merge, and most version control systems.
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
  return `three-way-merge-${++idCounter}`;
}

interface ConflictRegion {
  baseStart: number;
  baseEnd: number;
  oursContent: string[];
  theirsContent: string[];
}

/**
 * Classic three-way merge algorithm.
 */
function threeWayMerge(
  baseStr: string,
  oursStr: string,
  theirsStr: string,
): { result: string | null; conflicts: string[] } {
  const baseLines = baseStr.split('\n');
  const ourLines = oursStr.split('\n');
  const theirLines = theirsStr.split('\n');

  const oursChanges = computeChanges(baseLines, ourLines);
  const theirsChanges = computeChanges(baseLines, theirLines);

  const resultLines: string[] = [];
  const conflictRegions: string[] = [];
  let baseIdx = 0;
  let oursIdx = 0;
  let theirsIdx = 0;
  let hasConflicts = false;

  const maxBase = baseLines.length;

  while (baseIdx < maxBase || oursIdx < ourLines.length || theirsIdx < theirLines.length) {
    if (baseIdx >= maxBase) {
      const oursRemaining = ourLines.slice(oursIdx);
      const theirsRemaining = theirLines.slice(theirsIdx);

      if (oursRemaining.join('\n') === theirsRemaining.join('\n')) {
        resultLines.push(...oursRemaining);
      } else if (oursIdx >= ourLines.length) {
        resultLines.push(...theirsRemaining);
      } else if (theirsIdx >= theirLines.length) {
        resultLines.push(...oursRemaining);
      } else {
        hasConflicts = true;
        const marker = [
          '<<<<<<< ours',
          ...oursRemaining,
          '=======',
          ...theirsRemaining,
          '>>>>>>> theirs',
        ].join('\n');
        conflictRegions.push(marker);
        resultLines.push(marker);
      }
      break;
    }

    const baseLine = baseLines[baseIdx];
    const ourLine = oursIdx < ourLines.length ? ourLines[oursIdx] : undefined;
    const theirLine = theirsIdx < theirLines.length ? theirLines[theirsIdx] : undefined;

    if (ourLine === theirLine) {
      if (ourLine !== undefined) resultLines.push(ourLine);
      baseIdx++;
      oursIdx++;
      theirsIdx++;
    } else if (ourLine === baseLine && theirLine !== baseLine) {
      if (theirLine !== undefined) resultLines.push(theirLine);
      baseIdx++;
      oursIdx++;
      theirsIdx++;
    } else if (theirLine === baseLine && ourLine !== baseLine) {
      if (ourLine !== undefined) resultLines.push(ourLine);
      baseIdx++;
      oursIdx++;
      theirsIdx++;
    } else {
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
      baseIdx++;
      oursIdx++;
      theirsIdx++;
    }
  }

  if (hasConflicts) {
    return { result: null, conflicts: conflictRegions };
  }

  return { result: resultLines.join('\n'), conflicts: [] };
}

/**
 * Compute line-level changes between base and modified.
 */
function computeChanges(
  base: string[],
  modified: string[],
): Map<number, { type: string; content: string }> {
  const changes = new Map<number, { type: string; content: string }>();
  const m = base.length;
  const n = modified.length;

  for (let i = 0; i < Math.max(m, n); i++) {
    if (i >= m) {
      changes.set(i, { type: 'insert', content: modified[i] });
    } else if (i >= n) {
      changes.set(i, { type: 'delete', content: base[i] });
    } else if (base[i] !== modified[i]) {
      changes.set(i, { type: 'modify', content: modified[i] });
    }
  }

  return changes;
}

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: 'ThreeWayMerge',
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

    const { result, conflicts } = threeWayMerge(base, ours, theirs);

    const p = createProgram();
    if (result !== null) {
      return complete(p, 'clean', { result }) as StorageProgram<Result>;
    }

    return complete(p, 'conflicts', { regions: conflicts }) as StorageProgram<Result>;
  },
};

export const threeWayMergeHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetThreeWayMergeCounter(): void {
  idCounter = 0;
}
