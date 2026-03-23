// @clef-handler style=imperative
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, putLens, complete, relation, at,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';

// Lens for storing analysis results — dogfooding the lens DSL
const resultsRel = relation('results');

/**
 * Walk a parsed instruction tree and extract all transport effect
 * tags (protocol:operation) from perform/performFrom instructions.
 *
 * Fast path: if the serialized program includes structural performs
 * (accumulated during construction), use those directly — O(1).
 *
 * Fallback: recursively walk the instruction tree.
 */
function extractPerforms(programStr: string): { performs: string[]; performCount: number } {
  const performs = new Set<string>();
  let performCount = 0;

  try {
    const parsed = JSON.parse(programStr);

    // Fast path: structural performs from the program itself
    if (parsed.effects?.performs && Array.isArray(parsed.effects.performs) && parsed.effects.performs.length > 0) {
      return {
        performs: parsed.effects.performs,
        performCount: countPerforms(parsed.instructions || []),
      };
    }

    // Fallback: walk instruction tree
    walkInstructions(parsed.instructions || parsed.input || [], performs, (n) => { performCount += n; });
  } catch {
    // Non-JSON input — no transport effects extractable
    return { performs: [], performCount: 0 };
  }

  return { performs: [...performs], performCount };
}

function walkInstructions(
  instructions: unknown[],
  performs: Set<string>,
  addCount: (n: number) => void,
): void {
  if (!Array.isArray(instructions)) return;

  for (const instr of instructions) {
    if (!instr || typeof instr !== 'object') continue;
    const i = instr as Record<string, unknown>;

    if (i.tag === 'perform' || i.tag === 'performFrom') {
      const protocol = i.protocol as string;
      const operation = i.operation as string;
      if (protocol && operation) {
        performs.add(`${protocol}:${operation}`);
        addCount(1);
      }
    }

    if (i.tag === 'branch') {
      const thenBranch = i.thenBranch as Record<string, unknown> | string | undefined;
      const elseBranch = i.elseBranch as Record<string, unknown> | string | undefined;

      if (thenBranch) {
        if (typeof thenBranch === 'string') {
          try {
            const parsed = JSON.parse(thenBranch);
            walkInstructions(parsed.instructions || [], performs, addCount);
          } catch { /* skip */ }
        } else {
          walkInstructions(
            (thenBranch.instructions || []) as unknown[],
            performs,
            addCount,
          );
        }
      }

      if (elseBranch) {
        if (typeof elseBranch === 'string') {
          try {
            const parsed = JSON.parse(elseBranch);
            walkInstructions(parsed.instructions || [], performs, addCount);
          } catch { /* skip */ }
        } else {
          walkInstructions(
            (elseBranch.instructions || []) as unknown[],
            performs,
            addCount,
          );
        }
      }
    }

    if (i.tag === 'bind') {
      const first = i.first as Record<string, unknown> | string | undefined;
      const second = i.second as Record<string, unknown> | string | undefined;

      if (first) {
        if (typeof first === 'string') {
          try {
            const parsed = JSON.parse(first);
            walkInstructions(parsed.instructions || [], performs, addCount);
          } catch { /* skip */ }
        } else {
          walkInstructions(
            (first.instructions || []) as unknown[],
            performs,
            addCount,
          );
        }
      }

      if (second) {
        if (typeof second === 'string') {
          try {
            const parsed = JSON.parse(second);
            walkInstructions(parsed.instructions || [], performs, addCount);
          } catch { /* skip */ }
        } else {
          walkInstructions(
            (second.instructions || []) as unknown[],
            performs,
            addCount,
          );
        }
      }
    }
  }
}

function countPerforms(instructions: unknown[]): number {
  let count = 0;
  if (!Array.isArray(instructions)) return 0;
  for (const instr of instructions) {
    if (!instr || typeof instr !== 'object') continue;
    const i = instr as Record<string, unknown>;
    if (i.tag === 'perform' || i.tag === 'performFrom') {
      count += 1;
    }
    if (i.tag === 'branch') {
      const thenB = i.thenBranch as Record<string, unknown> | undefined;
      const elseB = i.elseBranch as Record<string, unknown> | undefined;
      if (thenB && typeof thenB === 'object') count += countPerforms((thenB.instructions || []) as unknown[]);
      if (elseB && typeof elseB === 'object') count += countPerforms((elseB.instructions || []) as unknown[]);
    }
    if (i.tag === 'bind') {
      const first = i.first as Record<string, unknown> | undefined;
      const second = i.second as Record<string, unknown> | undefined;
      if (first && typeof first === 'object') count += countPerforms((first.instructions || []) as unknown[]);
      if (second && typeof second === 'object') count += countPerforms((second.instructions || []) as unknown[]);
    }
  }
  return count;
}

/**
 * TransportEffectProvider — functional handler.
 *
 * Analyzes a serialized StorageProgram and returns a StorageProgram
 * that stores the extracted transport effect set and perform count.
 *
 * Prefers structural performs from the program's built-in effect
 * tracking. Falls back to instruction-tree walk.
 */
export const transportEffectProviderHandler: FunctionalConceptHandler = {
  analyze(input: Record<string, unknown>) {
    if (!input.program || (typeof input.program === 'string' && (input.program as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'program is required' }) as StorageProgram<Result>;
    }
    const program = input.program as string;
    try { JSON.parse(program); } catch { return complete(createProgram(), 'error', { message: 'program must be valid JSON' }) as StorageProgram<Result>; }

    try {
      const { performs, performCount } = extractPerforms(program);
      const resultId = `tep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      let p = createProgram();
      p = putLens(p, at(resultsRel, resultId), {
        performs: JSON.stringify(performs),
        performCount,
      });
      p = complete(p, 'ok', {
        result: resultId,
        performs: JSON.stringify(performs),
        performCount,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    } catch (e) {
      const p = complete(createProgram(), 'error', {
        message: `Failed to analyze program: ${(e as Error).message}`,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
  },
};
