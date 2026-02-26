// ============================================================
// PatienceDiff Handler
//
// Compute diffs using the Patience diff algorithm. Produces more
// human-readable diffs by aligning unique lines first. Better than
// Myers for refactored or moved code blocks.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `patience-diff-${++idCounter}`;
}

interface EditOp {
  type: 'equal' | 'insert' | 'delete';
  line: number;
  content: string;
}

/**
 * Find unique lines in a sequence and return their indices.
 * A line is unique if it appears exactly once.
 */
function findUniqueLines(lines: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  const positions = new Map<string, number>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    counts.set(line, (counts.get(line) || 0) + 1);
    positions.set(line, i);
  }

  const unique = new Map<string, number>();
  for (const [line, count] of counts) {
    if (count === 1) {
      unique.set(line, positions.get(line)!);
    }
  }

  return unique;
}

/**
 * Longest Increasing Subsequence of indices.
 * Used to find the LCS of unique matching lines.
 */
function lis(pairs: Array<{ aIdx: number; bIdx: number }>): Array<{ aIdx: number; bIdx: number }> {
  if (pairs.length === 0) return [];

  // Sort by aIdx
  const sorted = [...pairs].sort((a, b) => a.aIdx - b.aIdx);

  // Find LIS by bIdx using patience sorting
  const piles: Array<{ aIdx: number; bIdx: number }>[] = [];
  const backPtrs: number[] = [];

  for (const pair of sorted) {
    // Binary search for the leftmost pile where top.bIdx >= pair.bIdx
    let lo = 0;
    let hi = piles.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (piles[mid][piles[mid].length - 1].bIdx < pair.bIdx) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    if (lo === piles.length) {
      piles.push([pair]);
    } else {
      piles[lo].push(pair);
    }

    backPtrs.push(lo > 0 ? piles[lo - 1].length - 1 : -1);
  }

  // Reconstruct LIS
  const result: Array<{ aIdx: number; bIdx: number }> = [];
  if (piles.length > 0) {
    let idx = piles[piles.length - 1].length - 1;
    for (let pile = piles.length - 1; pile >= 0; pile--) {
      result.unshift(piles[pile][Math.min(idx, piles[pile].length - 1)]);
      idx = backPtrs[idx] >= 0 ? backPtrs[idx] : 0;
    }
  }

  return result;
}

/**
 * Simple LCS-based diff for filling gaps between anchors.
 */
function simpleDiff(linesA: string[], linesB: string[]): EditOp[] {
  const m = linesA.length;
  const n = linesB.length;

  if (m === 0 && n === 0) return [];
  if (m === 0) return linesB.map((line, i) => ({ type: 'insert' as const, line: i, content: line }));
  if (n === 0) return linesA.map((line, i) => ({ type: 'delete' as const, line: i, content: line }));

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const ops: EditOp[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      ops.unshift({ type: 'equal', line: i - 1, content: linesA[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'insert', line: j - 1, content: linesB[j - 1] });
      j--;
    } else {
      ops.unshift({ type: 'delete', line: i - 1, content: linesA[i - 1] });
      i--;
    }
  }

  return ops;
}

/**
 * Patience diff algorithm:
 * 1. Find unique lines common to both sequences
 * 2. Find the LIS of these common unique lines (the anchors)
 * 3. Recursively diff the gaps between anchors
 */
function patienceDiff(linesA: string[], linesB: string[]): EditOp[] {
  const uniqueA = findUniqueLines(linesA);
  const uniqueB = findUniqueLines(linesB);

  // Find matching unique lines
  const matches: Array<{ aIdx: number; bIdx: number; content: string }> = [];
  for (const [line, aIdx] of uniqueA) {
    const bIdx = uniqueB.get(line);
    if (bIdx !== undefined) {
      matches.push({ aIdx, bIdx, content: line });
    }
  }

  if (matches.length === 0) {
    // No unique anchors; fall back to simple LCS diff
    return simpleDiff(linesA, linesB);
  }

  // Find LIS of bIdx values to get the anchors in order
  const anchors = lis(matches);

  if (anchors.length === 0) {
    return simpleDiff(linesA, linesB);
  }

  // Build edit script by diffing gaps between anchors
  const ops: EditOp[] = [];
  let prevAIdx = 0;
  let prevBIdx = 0;

  for (const anchor of anchors) {
    // Diff the gap before this anchor
    const gapA = linesA.slice(prevAIdx, anchor.aIdx);
    const gapB = linesB.slice(prevBIdx, anchor.bIdx);
    ops.push(...simpleDiff(gapA, gapB));

    // Add the anchor as equal
    ops.push({ type: 'equal', line: anchor.aIdx, content: linesA[anchor.aIdx] });

    prevAIdx = anchor.aIdx + 1;
    prevBIdx = anchor.bIdx + 1;
  }

  // Diff the remaining gap after the last anchor
  const gapA = linesA.slice(prevAIdx);
  const gapB = linesB.slice(prevBIdx);
  ops.push(...simpleDiff(gapA, gapB));

  return ops;
}

export const patienceDiffHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    return {
      variant: 'ok',
      name: 'patience',
      category: 'diff',
      contentTypes: ['text/plain', 'text/*'],
    };
  },

  async compute(input: Record<string, unknown>, storage: ConceptStorage) {
    const contentA = input.contentA as string;
    const contentB = input.contentB as string;

    if (typeof contentA !== 'string' || typeof contentB !== 'string') {
      return { variant: 'unsupportedContent', message: 'Content must be text strings' };
    }

    const linesA = contentA.split('\n');
    const linesB = contentB.split('\n');

    const editOps = patienceDiff(linesA, linesB);
    const distance = editOps.filter(op => op.type !== 'equal').length;
    const editScript = JSON.stringify(editOps);

    const id = nextId();
    await storage.put('patience-diff', id, {
      id,
      editScript,
      distance,
    });

    return { variant: 'ok', editScript, distance };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetPatienceDiffCounter(): void {
  idCounter = 0;
}
