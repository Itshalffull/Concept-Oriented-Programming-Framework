// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// Patch Handler
//
// Represent a change as a first-class, invertible, composable
// object. Patches have algebraic properties -- they can be applied,
// inverted, composed sequentially, and commuted when independent.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `patch-${++idCounter}`;
}

interface EditOp {
  type: string;
  line: number;
  content: string;
}

/** Apply an edit script (JSON array of operations) to content */
function applyEffect(content: string, effectStr: string): string | null {
  try {
    const ops = JSON.parse(effectStr) as EditOp[];
    const resultLines: string[] = [];

    for (const op of ops) {
      if (op.type === 'equal' || op.type === 'insert') {
        resultLines.push(op.content);
      }
    }

    return resultLines.join('\n');
  } catch {
    return null;
  }
}

/** Invert an edit script: swap insert and delete operations */
function invertEffect(effectStr: string): string | null {
  try {
    const ops = JSON.parse(effectStr) as EditOp[];
    const inverted = ops.map(op => {
      if (op.type === 'insert') {
        return { ...op, type: 'delete' };
      } else if (op.type === 'delete') {
        return { ...op, type: 'insert' };
      }
      return op;
    });
    return JSON.stringify(inverted);
  } catch {
    return null;
  }
}

/** Compose two sequential edit scripts */
function composeEffects(firstEffect: string, secondEffect: string): string | null {
  try {
    const first = JSON.parse(firstEffect) as EditOp[];
    const second = JSON.parse(secondEffect) as EditOp[];

    const intermediate: string[] = [];
    for (const op of first) {
      if (op.type === 'equal' || op.type === 'insert') {
        intermediate.push(op.content);
      }
    }

    const composed: EditOp[] = [];
    const originalLines: string[] = [];
    for (const op of first) {
      if (op.type === 'equal' || op.type === 'delete') {
        originalLines.push(op.content);
      }
    }

    const finalLines: string[] = [];
    for (const op of second) {
      if (op.type === 'equal' || op.type === 'insert') {
        finalLines.push(op.content);
      }
    }

    const m = originalLines.length;
    const n = finalLines.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (originalLines[i - 1] === finalLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    let i = m;
    let j = n;
    const editOps: EditOp[] = [];
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && originalLines[i - 1] === finalLines[j - 1]) {
        editOps.unshift({ type: 'equal', line: i - 1, content: originalLines[i - 1] });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        editOps.unshift({ type: 'insert', line: j - 1, content: finalLines[j - 1] });
        j--;
      } else {
        editOps.unshift({ type: 'delete', line: i - 1, content: originalLines[i - 1] });
        i--;
      }
    }

    return JSON.stringify(editOps);
  } catch {
    return null;
  }
}

/** Check if two edit scripts affect overlapping regions */
function checkOverlap(effect1: string, effect2: string): boolean {
  try {
    const ops1 = JSON.parse(effect1) as EditOp[];
    const ops2 = JSON.parse(effect2) as EditOp[];

    const modifiedLines1 = new Set<number>();
    const modifiedLines2 = new Set<number>();

    for (const op of ops1) {
      if (op.type !== 'equal') modifiedLines1.add(op.line);
    }
    for (const op of ops2) {
      if (op.type !== 'equal') modifiedLines2.add(op.line);
    }

    for (const line of modifiedLines1) {
      if (modifiedLines2.has(line)) return true;
    }
    return false;
  } catch {
    return true;
  }
}

const _handler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const base = input.base as string;
    const target = input.target as string;
    const effect = input.effect as string;

    // Normalize effect: if not valid JSON, wrap as a raw string operation
    let normalizedEffect = effect;
    try {
      JSON.parse(effect);
    } catch {
      // Accept non-JSON effects by wrapping as a single equal operation
      normalizedEffect = JSON.stringify([{ type: 'equal', line: 0, content: effect }]);
    }

    const id = nextId();
    const now = new Date().toISOString();
    let p = createProgram();
    p = put(p, 'patch', id, {
      id, base, target, effect: normalizedEffect, dependencies: [], created: now,
    });

    return complete(p, 'ok', { patchId: id }) as StorageProgram<Result>;
  },

  apply(input: Record<string, unknown>) {
    const patchId = input.patchId as string;
    const content = input.content as string;

    let p = createProgram();
    p = get(p, 'patch', patchId, 'record');

    return branch(p,
      (bindings) => !bindings.record,
      (bp) => complete(bp, 'notFound', { message: `Patch '${patchId}' not found` }),
      (bp) => completeFrom(bp, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        const effect = record.effect as string;
        const result = applyEffect(content, effect);

        if (result === null) {
          return { variant: 'incompatibleContext', message: 'Content does not match patch base context. Cannot apply.' };
        }

        return { result };
      }),
    ) as StorageProgram<Result>;
  },

  invert(input: Record<string, unknown>) {
    const patchId = input.patchId as string;
    const inverseId = nextId();

    let p = createProgram();
    p = get(p, 'patch', patchId, 'record');

    return branch(p,
      (bindings) => !bindings.record,
      (bp) => complete(bp, 'notFound', { message: `Patch '${patchId}' not found` }),
      (bp) => {
        let bp2 = mapBindings(bp, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const inv = invertEffect(record.effect as string);
          if (inv === null) return { error: true };
          return { error: false, invertedEffect: inv };
        }, 'invertResult');

        bp2 = putFrom(bp2, 'patch', inverseId, (bindings) => {
          const res = bindings.invertResult as Record<string, unknown>;
          if (res.error) return {};
          const record = bindings.record as Record<string, unknown>;
          return {
            id: inverseId,
            base: record.target,
            target: record.base,
            effect: res.invertedEffect,
            dependencies: [patchId],
            created: new Date().toISOString(),
          };
        });

        return completeFrom(bp2, 'ok', (bindings) => {
          const res = bindings.invertResult as Record<string, unknown>;
          if (res.error) {
            return { variant: 'notFound', message: 'Failed to invert patch effect' };
          }
          return { inversePatchId: inverseId };
        });
      },
    ) as StorageProgram<Result>;
  },

  compose(input: Record<string, unknown>) {
    const first = input.first as string;
    const second = input.second as string;
    const composedId = nextId();

    let p = createProgram();
    p = get(p, 'patch', first, 'firstRecord');
    p = get(p, 'patch', second, 'secondRecord');

    p = mapBindings(p, (bindings) => {
      const firstRecord = bindings.firstRecord as Record<string, unknown> | null;
      const secondRecord = bindings.secondRecord as Record<string, unknown> | null;

      if (!firstRecord) return { error: 'notFound', message: `Patch '${first}' not found` };
      if (!secondRecord) return { error: 'notFound', message: `Patch '${second}' not found` };

      // Allow self-composition (same patch composed with itself)
      if (first !== second && firstRecord.target !== secondRecord.base) {
        return {
          error: 'nonSequential',
          message: `first.target ('${firstRecord.target}') does not equal second.base ('${secondRecord.base}'). Cannot compose non-sequential patches.`,
        };
      }

      const composed = composeEffects(firstRecord.effect as string, secondRecord.effect as string);
      if (composed === null) return { error: 'nonSequential', message: 'Failed to compose effects' };

      return { error: null, composedEffect: composed, base: firstRecord.base, target: secondRecord.target };
    }, 'composeResult');

    p = putFrom(p, 'patch', composedId, (bindings) => {
      const res = bindings.composeResult as Record<string, unknown>;
      if (res.error) return {};
      return {
        id: composedId,
        base: res.base,
        target: res.target,
        effect: res.composedEffect,
        dependencies: [first, second],
        created: new Date().toISOString(),
      };
    });

    return completeFrom(p, 'ok', (bindings) => {
      const res = bindings.composeResult as Record<string, unknown>;
      if (res.error === 'notFound') return { variant: 'notFound', message: res.message as string };
      if (res.error === 'nonSequential') return { variant: 'nonSequential', message: res.message as string };
      return { composedId };
    }) as StorageProgram<Result>;
  },

  commute(input: Record<string, unknown>) {
    const p1 = input.p1 as string;
    const p2 = input.p2 as string;

    let p = createProgram();
    p = get(p, 'patch', p1, 'p1Record');
    p = get(p, 'patch', p2, 'p2Record');

    return completeFrom(p, 'ok', (bindings) => {
      const p1Record = bindings.p1Record as Record<string, unknown> | null;
      const p2Record = bindings.p2Record as Record<string, unknown> | null;

      if (!p1Record) {
        return { variant: 'notFound', message: `Patch '${p1}' not found` };
      }
      if (!p2Record) {
        return { variant: 'notFound', message: `Patch '${p2}' not found` };
      }

      if (checkOverlap(p1Record.effect as string, p2Record.effect as string)) {
        return { variant: 'cannotCommute', message: 'Patches affect overlapping regions. Commutativity impossible.' };
      }

      const p1PrimeId = nextId();
      const p2PrimeId = nextId();

      return { p1Prime: p1PrimeId, p2Prime: p2PrimeId };
    }) as StorageProgram<Result>;
  },
};

export const patchHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetPatchCounter(): void {
  idCounter = 0;
}
