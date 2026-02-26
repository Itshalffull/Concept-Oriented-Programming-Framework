// ============================================================
// HistogramDiff Handler
//
// Compute diffs using the Histogram diff algorithm. A variant of
// Patience diff that uses frequency histograms. Generally superior
// for source code with common boilerplate lines.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `histogram-diff-${++idCounter}`;
}

interface EditOp {
  type: 'equal' | 'insert' | 'delete';
  line: number;
  content: string;
}

/**
 * Build a frequency histogram for lines in a sequence.
 */
function buildHistogram(lines: string[]): Map<string, number> {
  const hist = new Map<string, number>();
  for (const line of lines) {
    hist.set(line, (hist.get(line) || 0) + 1);
  }
  return hist;
}

/**
 * Simple LCS-based diff as fallback.
 */
function lcsDiff(linesA: string[], linesB: string[]): EditOp[] {
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
 * Histogram diff algorithm:
 * Similar to patience diff but uses line frequency to find the
 * lowest-frequency common lines as anchors. Lines that appear
 * least frequently are the most distinctive and make the best
 * alignment anchors.
 */
function histogramDiff(linesA: string[], linesB: string[]): EditOp[] {
  if (linesA.length === 0 && linesB.length === 0) return [];
  if (linesA.length === 0) return linesB.map((line, i) => ({ type: 'insert' as const, line: i, content: line }));
  if (linesB.length === 0) return linesA.map((line, i) => ({ type: 'delete' as const, line: i, content: line }));

  const histA = buildHistogram(linesA);
  const histB = buildHistogram(linesB);

  // Find common lines and their combined frequency
  const commonLines = new Map<string, number>();
  for (const [line, countA] of histA) {
    const countB = histB.get(line);
    if (countB !== undefined) {
      commonLines.set(line, countA + countB);
    }
  }

  if (commonLines.size === 0) {
    return lcsDiff(linesA, linesB);
  }

  // Find the lowest-frequency common line to use as anchor
  let bestLine = '';
  let bestFreq = Infinity;
  for (const [line, freq] of commonLines) {
    if (freq < bestFreq) {
      bestFreq = freq;
      bestLine = line;
    }
  }

  // Find positions of the best anchor in both sequences
  const positionsA: number[] = [];
  const positionsB: number[] = [];
  for (let i = 0; i < linesA.length; i++) {
    if (linesA[i] === bestLine) positionsA.push(i);
  }
  for (let i = 0; i < linesB.length; i++) {
    if (linesB[i] === bestLine) positionsB.push(i);
  }

  // Use the first occurrence in each as the anchor
  if (positionsA.length === 0 || positionsB.length === 0) {
    return lcsDiff(linesA, linesB);
  }

  const anchorA = positionsA[0];
  const anchorB = positionsB[0];

  // Recursively diff the regions before and after the anchor
  const ops: EditOp[] = [];

  // Before the anchor
  const beforeOps = histogramDiff(
    linesA.slice(0, anchorA),
    linesB.slice(0, anchorB),
  );
  ops.push(...beforeOps);

  // The anchor itself
  ops.push({ type: 'equal', line: anchorA, content: bestLine });

  // After the anchor
  const afterOps = histogramDiff(
    linesA.slice(anchorA + 1),
    linesB.slice(anchorB + 1),
  );
  ops.push(...afterOps);

  return ops;
}

export const histogramDiffHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    return {
      variant: 'ok',
      name: 'histogram',
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

    const editOps = histogramDiff(linesA, linesB);
    const distance = editOps.filter(op => op.type !== 'equal').length;
    const editScript = JSON.stringify(editOps);

    const id = nextId();
    await storage.put('histogram-diff', id, {
      id,
      editScript,
      distance,
    });

    return { variant: 'ok', editScript, distance };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetHistogramDiffCounter(): void {
  idCounter = 0;
}
