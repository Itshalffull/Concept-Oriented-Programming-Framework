// ============================================================
// MyersDiff Handler
//
// Compute line-level diffs using Myers' O(ND) algorithm. Optimal
// for text files -- minimizes edit distance by preferring deletions
// before insertions. The default diff provider for general text.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `myers-diff-${++idCounter}`;
}

interface EditOp {
  type: 'equal' | 'insert' | 'delete';
  line: number;
  content: string;
}

/**
 * Myers' O(ND) diff algorithm.
 * Computes the shortest edit script between two sequences of lines.
 */
function myersDiff(linesA: string[], linesB: string[]): EditOp[] {
  const n = linesA.length;
  const m = linesB.length;
  const max = n + m;

  if (max === 0) return [];

  // Trace stores the V array at each step for backtracking
  const trace: Map<number, number>[] = [];

  // V[k] = furthest x-coordinate reached on diagonal k
  let v = new Map<number, number>();
  v.set(1, 0);

  let found = false;

  for (let d = 0; d <= max; d++) {
    trace.push(new Map(v));
    const newV = new Map<number, number>();

    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && (v.get(k - 1) ?? 0) < (v.get(k + 1) ?? 0))) {
        x = v.get(k + 1) ?? 0; // move down (insert)
      } else {
        x = (v.get(k - 1) ?? 0) + 1; // move right (delete)
      }

      let y = x - k;

      // Follow diagonal (equal lines)
      while (x < n && y < m && linesA[x] === linesB[y]) {
        x++;
        y++;
      }

      newV.set(k, x);

      if (x >= n && y >= m) {
        trace.push(new Map(newV));
        found = true;
        break;
      }
    }

    v = newV;
    if (found) break;
  }

  // Backtrack to find the edit script
  const edits: Array<{ type: 'insert' | 'delete' | 'equal'; aIdx: number; bIdx: number }> = [];
  let x = n;
  let y = m;

  for (let d = trace.length - 2; d >= 0; d--) {
    const prevV = trace[d];
    const k = x - y;

    let prevK: number;
    if (k === -d || (k !== d && (prevV.get(k - 1) ?? 0) < (prevV.get(k + 1) ?? 0))) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }

    const prevX = prevV.get(prevK) ?? 0;
    const prevY = prevX - prevK;

    // Follow diagonal backward
    while (x > prevX && y > prevY) {
      x--;
      y--;
      edits.unshift({ type: 'equal', aIdx: x, bIdx: y });
    }

    if (d > 0) {
      if (x === prevX) {
        // Insert
        y--;
        edits.unshift({ type: 'insert', aIdx: x, bIdx: y });
      } else {
        // Delete
        x--;
        edits.unshift({ type: 'delete', aIdx: x, bIdx: x });
      }
    }
  }

  // Convert to EditOp format
  return edits.map(e => {
    if (e.type === 'equal') {
      return { type: 'equal' as const, line: e.aIdx, content: linesA[e.aIdx] };
    } else if (e.type === 'insert') {
      return { type: 'insert' as const, line: e.bIdx, content: linesB[e.bIdx] };
    } else {
      return { type: 'delete' as const, line: e.aIdx, content: linesA[e.aIdx] };
    }
  });
}

export const myersDiffHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    return {
      variant: 'ok',
      name: 'myers',
      category: 'diff',
      contentTypes: ['text/plain', 'text/*', 'application/octet-stream'],
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

    const editOps = myersDiff(linesA, linesB);
    const distance = editOps.filter(op => op.type !== 'equal').length;
    const editScript = JSON.stringify(editOps);

    // Cache the result
    const id = nextId();
    await storage.put('myers-diff', id, {
      id,
      editScript,
      distance,
    });

    return { variant: 'ok', editScript, distance };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetMyersDiffCounter(): void {
  idCounter = 0;
}
