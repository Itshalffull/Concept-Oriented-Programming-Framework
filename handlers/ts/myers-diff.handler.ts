// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// MyersDiff Handler
//
// Compute line-level diffs using Myers' O(ND) algorithm. Optimal
// for text files -- minimizes edit distance by preferring deletions
// before insertions. The default diff provider for general text.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, put, complete, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

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

  const trace: Map<number, number>[] = [];

  let v = new Map<number, number>();
  v.set(1, 0);

  let found = false;

  for (let d = 0; d <= max; d++) {
    trace.push(new Map(v));
    const newV = new Map<number, number>();

    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && (v.get(k - 1) ?? 0) < (v.get(k + 1) ?? 0))) {
        x = v.get(k + 1) ?? 0;
      } else {
        x = (v.get(k - 1) ?? 0) + 1;
      }

      let y = x - k;

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

    while (x > prevX && y > prevY) {
      x--;
      y--;
      edits.unshift({ type: 'equal', aIdx: x, bIdx: y });
    }

    if (d > 0) {
      if (x === prevX) {
        y--;
        edits.unshift({ type: 'insert', aIdx: x, bIdx: y });
      } else {
        x--;
        edits.unshift({ type: 'delete', aIdx: x, bIdx: x });
      }
    }
  }

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

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: 'myers',
      category: 'diff',
      contentTypes: ['text/plain', 'text/*', 'application/octet-stream'],
    }) as StorageProgram<Result>;
  },

  compute(input: Record<string, unknown>) {
    const contentA = input.contentA as string;
    const contentB = input.contentB as string;

    if (typeof contentA !== 'string' || typeof contentB !== 'string') {
      const p = createProgram();
      return complete(p, 'unsupportedContent', { message: 'Content must be text strings' }) as StorageProgram<Result>;
    }

    const linesA = contentA.split('\n');
    const linesB = contentB.split('\n');

    const editOps = myersDiff(linesA, linesB);
    const distance = editOps.filter(op => op.type !== 'equal').length;
    const editScript = JSON.stringify(editOps);

    const id = nextId();
    let p = createProgram();
    p = put(p, 'myers-diff', id, {
      id,
      editScript,
      distance,
    });

    return complete(p, 'ok', { editScript, distance }) as StorageProgram<Result>;
  },
};

export const myersDiffHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetMyersDiffCounter(): void {
  idCounter = 0;
}
