// @clef-handler style=imperative
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, putLens, complete, relation, at,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';

// Lens for storing analysis results — dogfooding the lens DSL
const resultsRel = relation('results');

/**
 * Walk a parsed instruction tree and extract all reachable completion
 * variant tags from pure/pureFrom terminals.
 *
 * Fast path: if the serialized program includes structural
 * completionVariants (accumulated during construction), use those
 * directly — O(1).
 *
 * Fallback: recursively walk the instruction tree, extracting
 * variant tags from pure instruction values.
 */
function extractVariants(programStr: string): { variants: string[]; branchCount: number } {
  const variants = new Set<string>();
  let branchCount = 0;

  try {
    const parsed = JSON.parse(programStr);

    // Fast path: structural completionVariants from the program itself
    if (parsed.effects?.completionVariants && Array.isArray(parsed.effects.completionVariants) && parsed.effects.completionVariants.length > 0) {
      return {
        variants: parsed.effects.completionVariants,
        branchCount: countBranches(parsed.instructions || []),
      };
    }

    // Fallback: walk instruction tree
    walkInstructions(parsed.instructions || parsed.input || [], variants, (n) => { branchCount += n; });

    // Also try string-based parsing for simple format
    if (variants.size === 0 && typeof (parsed.instructions || parsed.input) === 'string') {
      const str = parsed.instructions || parsed.input;
      const pureMatch = str.match(/pure\(\s*\{[^}]*variant:\s*['"](\w+)['"]/g);
      if (pureMatch) {
        for (const m of pureMatch) {
          const tag = m.match(/variant:\s*['"](\w+)['"]/);
          if (tag) variants.add(tag[1]);
        }
      }
    }
  } catch {
    // Try string-based parsing for completely non-JSON input
    const pureMatch = programStr.match(/variant:\s*['"](\w+)['"]/g);
    if (pureMatch) {
      for (const m of pureMatch) {
        const tag = m.match(/variant:\s*['"](\w+)['"]/);
        if (tag) variants.add(tag[1]);
      }
    }
  }

  return { variants: [...variants], branchCount };
}

function walkInstructions(
  instructions: unknown[],
  variants: Set<string>,
  addBranches: (n: number) => void,
): void {
  if (!Array.isArray(instructions)) return;

  for (const instr of instructions) {
    if (!instr || typeof instr !== 'object') continue;
    const i = instr as Record<string, unknown>;

    if (i.tag === 'pure' && i.value && typeof i.value === 'object') {
      const val = i.value as Record<string, unknown>;
      if (typeof val.variant === 'string') {
        variants.add(val.variant);
      }
    }

    if (i.tag === 'branch') {
      addBranches(1);
      // Recurse into both branches
      const thenBranch = i.thenBranch as Record<string, unknown> | undefined;
      const elseBranch = i.elseBranch as Record<string, unknown> | undefined;

      if (thenBranch) {
        // Handle nested serialized programs (string or object)
        if (typeof thenBranch === 'string') {
          try {
            const parsed = JSON.parse(thenBranch);
            walkInstructions(parsed.instructions || [], variants, addBranches);
          } catch { /* skip */ }
        } else {
          walkInstructions(
            (thenBranch.instructions || []) as unknown[],
            variants,
            addBranches,
          );
        }
      }

      if (elseBranch) {
        if (typeof elseBranch === 'string') {
          try {
            const parsed = JSON.parse(elseBranch);
            walkInstructions(parsed.instructions || [], variants, addBranches);
          } catch { /* skip */ }
        } else {
          walkInstructions(
            (elseBranch.instructions || []) as unknown[],
            variants,
            addBranches,
          );
        }
      }
    }

    if (i.tag === 'bind') {
      const first = i.first as Record<string, unknown> | undefined;
      const second = i.second as Record<string, unknown> | undefined;

      if (first) {
        if (typeof first === 'string') {
          try {
            const parsed = JSON.parse(first);
            walkInstructions(parsed.instructions || [], variants, addBranches);
          } catch { /* skip */ }
        } else {
          walkInstructions(
            (first.instructions || []) as unknown[],
            variants,
            addBranches,
          );
        }
      }

      if (second) {
        if (typeof second === 'string') {
          try {
            const parsed = JSON.parse(second);
            walkInstructions(parsed.instructions || [], variants, addBranches);
          } catch { /* skip */ }
        } else {
          walkInstructions(
            (second.instructions || []) as unknown[],
            variants,
            addBranches,
          );
        }
      }
    }
  }
}

function countBranches(instructions: unknown[]): number {
  let count = 0;
  if (!Array.isArray(instructions)) return 0;
  for (const instr of instructions) {
    if (!instr || typeof instr !== 'object') continue;
    const i = instr as Record<string, unknown>;
    if (i.tag === 'branch') {
      count += 1;
      const thenB = i.thenBranch as Record<string, unknown> | undefined;
      const elseB = i.elseBranch as Record<string, unknown> | undefined;
      if (thenB && typeof thenB === 'object') count += countBranches((thenB.instructions || []) as unknown[]);
      if (elseB && typeof elseB === 'object') count += countBranches((elseB.instructions || []) as unknown[]);
    }
    if (i.tag === 'bind') {
      const first = i.first as Record<string, unknown> | undefined;
      const second = i.second as Record<string, unknown> | undefined;
      if (first && typeof first === 'object') count += countBranches((first.instructions || []) as unknown[]);
      if (second && typeof second === 'object') count += countBranches((second.instructions || []) as unknown[]);
    }
  }
  return count;
}

/**
 * VariantExtractionProvider — functional handler.
 *
 * Analyzes a serialized StorageProgram and returns a StorageProgram
 * that stores the extracted variant set and branch count.
 *
 * Prefers structural completionVariants from the program's built-in
 * effect tracking. Falls back to instruction-tree walk.
 */
export const variantExtractionProviderHandler: FunctionalConceptHandler = {
  analyze(input: Record<string, unknown>) {
    if (!input.program || (typeof input.program === 'string' && (input.program as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'program is required' }) as StorageProgram<Result>;
    }
    const program = input.program as string;
    try { JSON.parse(program); } catch { return complete(createProgram(), 'error', { message: 'program must be valid JSON' }) as StorageProgram<Result>; }

    try {
      const { variants, branchCount } = extractVariants(program);
      const resultId = `vep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      let p = createProgram();
      p = putLens(p, at(resultsRel, resultId), {
        variants: JSON.stringify(variants),
        branchCount,
      });
      p = complete(p, 'ok', {
        result: resultId,
        variants: JSON.stringify(variants),
        branchCount,
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
