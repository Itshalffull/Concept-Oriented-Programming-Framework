// ============================================================
// ThreeWayMerge Handler
//
// Merge two divergent text files relative to a common base using
// classic three-way merge. Standard algorithm used in Git, POSIX
// merge, and most version control systems.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

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
 * Compares ours and theirs against a common base.
 * Non-conflicting changes are merged automatically.
 * Conflicting changes (both sides modified the same region) produce conflict markers.
 */
function threeWayMerge(
  baseStr: string,
  oursStr: string,
  theirsStr: string,
): { result: string | null; conflicts: string[] } {
  const baseLines = baseStr.split('\n');
  const ourLines = oursStr.split('\n');
  const theirLines = theirsStr.split('\n');

  // Build LCS between base and ours
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
      // Past end of base; collect remaining lines
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
      // Both agree
      if (ourLine !== undefined) resultLines.push(ourLine);
      baseIdx++;
      oursIdx++;
      theirsIdx++;
    } else if (ourLine === baseLine && theirLine !== baseLine) {
      // Only theirs changed
      if (theirLine !== undefined) resultLines.push(theirLine);
      baseIdx++;
      oursIdx++;
      theirsIdx++;
    } else if (theirLine === baseLine && ourLine !== baseLine) {
      // Only ours changed
      if (ourLine !== undefined) resultLines.push(ourLine);
      baseIdx++;
      oursIdx++;
      theirsIdx++;
    } else {
      // Both changed differently -- conflict
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

export const threeWayMergeHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    return {
      variant: 'ok',
      name: 'three-way',
      category: 'merge',
      contentTypes: ['text/plain', 'text/*'],
    };
  },

  async execute(input: Record<string, unknown>, storage: ConceptStorage) {
    const base = input.base as string;
    const ours = input.ours as string;
    const theirs = input.theirs as string;

    if (typeof base !== 'string' || typeof ours !== 'string' || typeof theirs !== 'string') {
      return { variant: 'unsupportedContent', message: 'Content must be text strings' };
    }

    // Trivial cases
    if (ours === theirs) {
      return { variant: 'clean', result: ours };
    }
    if (ours === base) {
      return { variant: 'clean', result: theirs };
    }
    if (theirs === base) {
      return { variant: 'clean', result: ours };
    }

    const { result, conflicts } = threeWayMerge(base, ours, theirs);

    if (result !== null) {
      return { variant: 'clean', result };
    }

    return { variant: 'conflicts', regions: conflicts };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetThreeWayMergeCounter(): void {
  idCounter = 0;
}
