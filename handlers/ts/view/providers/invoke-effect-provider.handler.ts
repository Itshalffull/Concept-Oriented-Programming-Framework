// @clef-handler style=functional
// ============================================================
// InvokeEffectProvider Handler
//
// Extracts the set of concept action invocations (concept/action
// pairs) from a QueryProgram's instruction tree. Walks invoke,
// traverseInvoke, match (recursing into case sub-programs), and
// traverse (using declaredEffects or analyzing the body)
// instructions.
//
// See Architecture doc Section 16 (StorageProgram Monad) and
// the view suite for QueryProgram instruction definitions.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

/**
 * Walk a parsed instruction tree and extract all concept/action
 * invocation pairs as "Concept/action" strings.
 *
 * Fast path: if the serialized program includes structural
 * invocations (accumulated during construction), use those
 * directly — O(1).
 *
 * Fallback: recursively walk the instruction tree, extracting
 * concept/action from invoke, traverseInvoke, match, and
 * traverse instructions.
 */
function extractInvocations(programStr: string): { invocations: string[]; invokeCount: number } {
  const invocations = new Set<string>();

  try {
    const parsed = JSON.parse(programStr);

    // Fast path: structural invocations from the program's effect set
    if (
      parsed.effects?.invocations &&
      Array.isArray(parsed.effects.invocations) &&
      parsed.effects.invocations.length > 0
    ) {
      const unique = new Set<string>(parsed.effects.invocations as string[]);
      return {
        invocations: [...unique],
        invokeCount: countInvocations(parsed.instructions || []),
      };
    }

    // Fallback: walk instruction tree
    walkInstructions(parsed.instructions || parsed.input || [], invocations);
  } catch {
    // Non-parseable input — no invocations extractable
    return { invocations: [], invokeCount: 0 };
  }

  return { invocations: [...invocations], invokeCount: invocations.size };
}

function walkInstructions(
  instructions: unknown[],
  invocations: Set<string>,
): void {
  if (!Array.isArray(instructions)) return;

  for (const instr of instructions) {
    if (!instr || typeof instr !== 'object') continue;
    const i = instr as Record<string, unknown>;

    // Direct invoke instruction
    if (i.tag === 'invoke' || i.type === 'invoke') {
      const concept = i.concept as string | undefined;
      const action = i.action as string | undefined;
      if (concept && action) {
        invocations.add(`${concept}/${action}`);
      }
    }

    // Iterate-and-invoke instruction
    if (i.tag === 'traverseInvoke' || i.type === 'traverseInvoke') {
      const concept = i.concept as string | undefined;
      const action = i.action as string | undefined;
      if (concept && action) {
        invocations.add(`${concept}/${action}`);
      }
      // Also check declaredEffects.invocations for this instruction
      const declaredEffects = i.declaredEffects as Record<string, unknown> | undefined;
      if (declaredEffects?.invocations && Array.isArray(declaredEffects.invocations)) {
        for (const pair of declaredEffects.invocations as string[]) {
          invocations.add(pair);
        }
      }
    }

    // Match instruction — recurse into case sub-programs
    if (i.tag === 'match' || i.type === 'match') {
      const cases = i.cases as Record<string, unknown> | unknown[] | undefined;
      if (cases) {
        if (Array.isArray(cases)) {
          for (const c of cases) {
            if (c && typeof c === 'object') {
              const caseObj = c as Record<string, unknown>;
              const subProgram = caseObj.program || caseObj.body || caseObj.subProgram;
              if (subProgram) {
                walkSubProgram(subProgram, invocations);
              }
            }
          }
        } else if (typeof cases === 'object') {
          for (const caseProgram of Object.values(cases)) {
            if (caseProgram) {
              walkSubProgram(caseProgram, invocations);
            }
          }
        }
      }
    }

    // Traverse instruction — use declaredEffects if available, else walk body
    if (i.tag === 'traverse' || i.type === 'traverse') {
      const declaredEffects = i.declaredEffects as Record<string, unknown> | undefined;
      if (declaredEffects?.invocations && Array.isArray(declaredEffects.invocations)) {
        for (const pair of declaredEffects.invocations as string[]) {
          invocations.add(pair);
        }
      } else {
        // Analyze body sub-program
        const body = i.body || i.bodyProgram;
        if (body) {
          walkSubProgram(body, invocations);
        }
      }
    }

    // Recurse into branch arms
    if (i.tag === 'branch') {
      walkSubProgram(i.thenBranch, invocations);
      walkSubProgram(i.elseBranch, invocations);
    }

    // Recurse into bind (monadic compose)
    if (i.tag === 'bind') {
      walkSubProgram(i.first, invocations);
      walkSubProgram(i.second, invocations);
    }
  }
}

function walkSubProgram(
  subProgram: unknown,
  invocations: Set<string>,
): void {
  if (!subProgram) return;

  if (typeof subProgram === 'string') {
    try {
      const parsed = JSON.parse(subProgram);
      walkInstructions(parsed.instructions || [], invocations);
    } catch { /* skip */ }
  } else if (typeof subProgram === 'object') {
    const obj = subProgram as Record<string, unknown>;
    walkInstructions((obj.instructions || []) as unknown[], invocations);
  }
}

function countInvocations(instructions: unknown[]): number {
  let count = 0;
  if (!Array.isArray(instructions)) return 0;
  for (const instr of instructions) {
    if (!instr || typeof instr !== 'object') continue;
    const i = instr as Record<string, unknown>;
    if (i.tag === 'invoke' || i.type === 'invoke') count += 1;
    if (i.tag === 'traverseInvoke' || i.type === 'traverseInvoke') count += 1;
    if (i.tag === 'branch') {
      const thenB = i.thenBranch as Record<string, unknown> | undefined;
      const elseB = i.elseBranch as Record<string, unknown> | undefined;
      if (thenB && typeof thenB === 'object') count += countInvocations((thenB.instructions || []) as unknown[]);
      if (elseB && typeof elseB === 'object') count += countInvocations((elseB.instructions || []) as unknown[]);
    }
    if (i.tag === 'bind') {
      const first = i.first as Record<string, unknown> | undefined;
      const second = i.second as Record<string, unknown> | undefined;
      if (first && typeof first === 'object') count += countInvocations((first.instructions || []) as unknown[]);
      if (second && typeof second === 'object') count += countInvocations((second.instructions || []) as unknown[]);
    }
  }
  return count;
}

/**
 * InvokeEffectProvider — functional handler.
 *
 * Analyzes a serialized QueryProgram and returns a StorageProgram
 * that stores the extracted invocation set and invoke count.
 *
 * Prefers structural invocations from the program's built-in
 * effect tracking. Falls back to instruction-tree walk.
 */
const _handler: FunctionalConceptHandler = {
  analyze(input: Record<string, unknown>) {
    // Input validation — empty program is an error
    if (!input.program || (typeof input.program === 'string' && (input.program as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'program is required' }) as StorageProgram<Result>;
    }
    const program = input.program as string;

    // JSON.parse safety check
    try {
      JSON.parse(program);
    } catch {
      return complete(createProgram(), 'error', { message: 'program must be valid JSON' }) as StorageProgram<Result>;
    }

    try {
      const { invocations, invokeCount } = extractInvocations(program);
      const resultId = `iep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const invocationsJson = JSON.stringify(invocations);

      let p = createProgram();
      p = put(p, 'invokeEffectResult', resultId, {
        invocations: invocationsJson,
        invokeCount,
      });
      p = complete(p, 'ok', {
        result: resultId,
        invocations: invocationsJson,
        invokeCount,
      });
      return p as StorageProgram<Result>;
    } catch (e) {
      const p = complete(createProgram(), 'error', {
        message: `Failed to analyze program: ${(e as Error).message}`,
      });
      return p as StorageProgram<Result>;
    }
  },

  get(input: Record<string, unknown>) {
    const resultId = input.result as string;

    let p = createProgram();
    p = get(p, 'invokeEffectResult', resultId, 'record');

    p = branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return {
          invocations: record.invocations as string,
          invokeCount: record.invokeCount as number,
        };
      }) as StorageProgram<Result>,
      (b) => complete(b, 'notfound', {}) as StorageProgram<Result>,
    ) as StorageProgram<Result>;

    return p;
  },
};

export const invokeEffectProviderHandler = autoInterpret(_handler);
