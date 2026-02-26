// ============================================================
// Patch Handler
//
// Represent a change as a first-class, invertible, composable
// object. Patches have algebraic properties -- they can be applied,
// inverted, composed sequentially, and commuted when independent.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

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
      // 'delete' lines are skipped
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

    // The composed effect applies first, then second.
    // Produce the intermediate content from first, then second gives final.
    // The composed edit script goes from first's input to second's output.
    const intermediate: string[] = [];
    for (const op of first) {
      if (op.type === 'equal' || op.type === 'insert') {
        intermediate.push(op.content);
      }
    }

    // Now apply second to intermediate
    // The composed effect is effectively: delete lines from original that first deletes,
    // keep lines from second's output
    const composed: EditOp[] = [];
    // Collect original lines from first
    const originalLines: string[] = [];
    for (const op of first) {
      if (op.type === 'equal' || op.type === 'delete') {
        originalLines.push(op.content);
      }
    }

    // Final output lines from second
    const finalLines: string[] = [];
    for (const op of second) {
      if (op.type === 'equal' || op.type === 'insert') {
        finalLines.push(op.content);
      }
    }

    // Build composed edit script from original to final using LCS
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

export const patchHandler: ConceptHandler = {
  async create(input: Record<string, unknown>, storage: ConceptStorage) {
    const base = input.base as string;
    const target = input.target as string;
    const effect = input.effect as string;

    // Validate effect is parseable
    try {
      JSON.parse(effect);
    } catch {
      return { variant: 'invalidEffect', message: 'Effect bytes are not a valid edit script (must be JSON)' };
    }

    const id = nextId();
    const now = new Date().toISOString();
    await storage.put('patch', id, {
      id,
      base,
      target,
      effect,
      dependencies: [],
      created: now,
    });

    return { variant: 'ok', patchId: id };
  },

  async apply(input: Record<string, unknown>, storage: ConceptStorage) {
    const patchId = input.patchId as string;
    const content = input.content as string;

    const record = await storage.get('patch', patchId);
    if (!record) {
      return { variant: 'notFound', message: `Patch '${patchId}' not found` };
    }

    const effect = record.effect as string;
    const result = applyEffect(content, effect);

    if (result === null) {
      return { variant: 'incompatibleContext', message: 'Content does not match patch base context. Cannot apply.' };
    }

    return { variant: 'ok', result };
  },

  async invert(input: Record<string, unknown>, storage: ConceptStorage) {
    const patchId = input.patchId as string;

    const record = await storage.get('patch', patchId);
    if (!record) {
      return { variant: 'notFound', message: `Patch '${patchId}' not found` };
    }

    const invertedEffect = invertEffect(record.effect as string);
    if (invertedEffect === null) {
      return { variant: 'notFound', message: 'Failed to invert patch effect' };
    }

    const inverseId = nextId();
    const now = new Date().toISOString();
    await storage.put('patch', inverseId, {
      id: inverseId,
      base: record.target,
      target: record.base,
      effect: invertedEffect,
      dependencies: [patchId],
      created: now,
    });

    return { variant: 'ok', inversePatchId: inverseId };
  },

  async compose(input: Record<string, unknown>, storage: ConceptStorage) {
    const first = input.first as string;
    const second = input.second as string;

    const firstRecord = await storage.get('patch', first);
    if (!firstRecord) {
      return { variant: 'notFound', message: `Patch '${first}' not found` };
    }

    const secondRecord = await storage.get('patch', second);
    if (!secondRecord) {
      return { variant: 'notFound', message: `Patch '${second}' not found` };
    }

    // Check sequential: first.target must equal second.base
    if (firstRecord.target !== secondRecord.base) {
      return {
        variant: 'nonSequential',
        message: `first.target ('${firstRecord.target}') does not equal second.base ('${secondRecord.base}'). Cannot compose non-sequential patches.`,
      };
    }

    const composedEffect = composeEffects(firstRecord.effect as string, secondRecord.effect as string);
    if (composedEffect === null) {
      return { variant: 'nonSequential', message: 'Failed to compose effects' };
    }

    const composedId = nextId();
    const now = new Date().toISOString();
    await storage.put('patch', composedId, {
      id: composedId,
      base: firstRecord.base,
      target: secondRecord.target,
      effect: composedEffect,
      dependencies: [first, second],
      created: now,
    });

    return { variant: 'ok', composedId };
  },

  async commute(input: Record<string, unknown>, storage: ConceptStorage) {
    const p1 = input.p1 as string;
    const p2 = input.p2 as string;

    const p1Record = await storage.get('patch', p1);
    if (!p1Record) {
      return { variant: 'notFound', message: `Patch '${p1}' not found` };
    }

    const p2Record = await storage.get('patch', p2);
    if (!p2Record) {
      return { variant: 'notFound', message: `Patch '${p2}' not found` };
    }

    // Check if patches affect overlapping regions
    if (checkOverlap(p1Record.effect as string, p2Record.effect as string)) {
      return { variant: 'cannotCommute', message: 'Patches affect overlapping regions. Commutativity impossible.' };
    }

    // For non-overlapping patches, commuted versions are the same effects
    // but with swapped ordering context
    const p1PrimeId = nextId();
    const p2PrimeId = nextId();
    const now = new Date().toISOString();

    await storage.put('patch', p2PrimeId, {
      id: p2PrimeId,
      base: p1Record.base,
      target: p2Record.target,
      effect: p2Record.effect,
      dependencies: [p2],
      created: now,
    });

    await storage.put('patch', p1PrimeId, {
      id: p1PrimeId,
      base: p2Record.base,
      target: p1Record.target,
      effect: p1Record.effect,
      dependencies: [p1],
      created: now,
    });

    return { variant: 'ok', p1Prime: p1PrimeId, p2Prime: p2PrimeId };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetPatchCounter(): void {
  idCounter = 0;
}
