// @clef-handler style=functional
// ============================================================
// QueryCompletionCoverage Handler
//
// Verifies that every invoke and traverseInvoke instruction's
// possible completion variants have matching downstream handling
// via match instructions. For each invoke, looks up the target
// concept's action variants in conceptSpecs and checks that the
// program handles each variant via a downstream match on the
// invoke's bindAs. Reports covered and uncovered variants as
// "Concept/action:variant" strings.
//
// Wildcard "*" in match cases means all remaining variants are
// covered.
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

// ---------------------------------------------------------------------------
// Instruction types
// ---------------------------------------------------------------------------

interface InvokeInstruction {
  tag: 'invoke' | 'traverseInvoke';
  concept: string;
  action: string;
  bindAs: string;
}

interface MatchCase {
  variant: string;
  program?: unknown;
}

interface MatchInstruction {
  tag: 'match';
  bindAs: string;
  cases: MatchCase[];
}

type Instruction = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Coverage analysis helpers
// ---------------------------------------------------------------------------

/**
 * Collect all invoke/traverseInvoke instructions from a parsed instruction list.
 * Recurse into match case sub-programs and branch arms.
 */
function collectInvokes(instructions: unknown[]): InvokeInstruction[] {
  const result: InvokeInstruction[] = [];
  if (!Array.isArray(instructions)) return result;

  for (const instr of instructions) {
    if (!instr || typeof instr !== 'object') continue;
    const i = instr as Instruction;

    if ((i.tag === 'invoke' || i.tag === 'traverseInvoke') &&
        typeof i.concept === 'string' && typeof i.action === 'string' &&
        typeof i.bindAs === 'string') {
      result.push({
        tag: i.tag as 'invoke' | 'traverseInvoke',
        concept: i.concept as string,
        action: i.action as string,
        bindAs: i.bindAs as string,
      });
    }

    // Recurse into match case sub-programs
    if (i.tag === 'match' && Array.isArray(i.cases)) {
      for (const c of i.cases as MatchCase[]) {
        if (c.program && typeof c.program === 'object') {
          const sub = c.program as Record<string, unknown>;
          result.push(...collectInvokes((sub.instructions ?? []) as unknown[]));
        }
      }
    }

    // Recurse into branch arms
    if (i.tag === 'branch') {
      const thenB = i.thenBranch as Record<string, unknown> | undefined;
      const elseB = i.elseBranch as Record<string, unknown> | undefined;
      if (thenB) result.push(...collectInvokes((thenB.instructions ?? []) as unknown[]));
      if (elseB) result.push(...collectInvokes((elseB.instructions ?? []) as unknown[]));
    }

    // Recurse into bind (monadic compose)
    if (i.tag === 'bind') {
      const first = i.first as Record<string, unknown> | undefined;
      const second = i.second as Record<string, unknown> | undefined;
      if (first) result.push(...collectInvokes((first.instructions ?? []) as unknown[]));
      if (second) result.push(...collectInvokes((second.instructions ?? []) as unknown[]));
    }

    // Recurse into traverse body
    if (i.tag === 'traverse') {
      const body = (i.body ?? i.bodyProgram) as Record<string, unknown> | undefined;
      if (body) result.push(...collectInvokes((body.instructions ?? []) as unknown[]));
    }
  }

  return result;
}

/**
 * Collect all match instructions from a flat instruction list.
 * Returns only top-level matches (not inside sub-programs).
 */
function collectMatches(instructions: unknown[]): MatchInstruction[] {
  const result: MatchInstruction[] = [];
  if (!Array.isArray(instructions)) return result;

  for (const instr of instructions) {
    if (!instr || typeof instr !== 'object') continue;
    const i = instr as Instruction;

    if (i.tag === 'match' && typeof i.bindAs === 'string' && Array.isArray(i.cases)) {
      result.push({
        tag: 'match',
        bindAs: i.bindAs as string,
        cases: i.cases as MatchCase[],
      });
    }
  }

  return result;
}

/**
 * Given an invoke instruction and a list of all match instructions, find
 * the downstream match that handles this invoke's bindAs.
 */
function findMatchForInvoke(invoke: InvokeInstruction, matches: MatchInstruction[]): MatchInstruction | undefined {
  return matches.find((m) => m.bindAs === invoke.bindAs);
}

/**
 * Extract variant strings covered by a match instruction's cases.
 * A "*" wildcard case means ALL variants are covered.
 */
function extractCoveredVariants(matchInstr: MatchInstruction): { variants: string[]; hasWildcard: boolean } {
  const variants: string[] = [];
  let hasWildcard = false;

  for (const c of matchInstr.cases) {
    if (c.variant === '*') {
      hasWildcard = true;
    } else {
      variants.push(c.variant);
    }
  }

  return { variants, hasWildcard };
}

interface CoverageAnalysis {
  covered: string[];
  uncovered: string[];
  totalVariants: number;
  coveredCount: number;
}

/**
 * Main coverage analysis: walks the instruction tree, finds all invokes,
 * then checks each against downstream match instructions.
 */
function analyzeCompletionCoverage(
  programStr: string,
  conceptSpecsStr: string,
): CoverageAnalysis {
  const parsed = JSON.parse(programStr) as Record<string, unknown>;
  const conceptSpecs = JSON.parse(conceptSpecsStr) as Record<string, string[]>;

  const instructions = (parsed.instructions ?? []) as unknown[];
  const invokes = collectInvokes(instructions);
  const matches = collectMatches(instructions);

  const coveredSet = new Set<string>();
  const uncoveredSet = new Set<string>();

  for (const invoke of invokes) {
    const key = `${invoke.concept}/${invoke.action}`;
    const possibleVariants: string[] = conceptSpecs[key] ?? [];

    if (possibleVariants.length === 0) {
      // No spec entry — skip this invoke (no variants to check)
      continue;
    }

    const matchInstr = findMatchForInvoke(invoke, matches);

    if (!matchInstr) {
      // No downstream match at all — all variants are uncovered
      for (const v of possibleVariants) {
        uncoveredSet.add(`${key}:${v}`);
      }
      continue;
    }

    const { variants: handledVariants, hasWildcard } = extractCoveredVariants(matchInstr);
    const handledSet = new Set(handledVariants);

    for (const v of possibleVariants) {
      const label = `${key}:${v}`;
      if (hasWildcard || handledSet.has(v)) {
        coveredSet.add(label);
      } else {
        uncoveredSet.add(label);
      }
    }
  }

  const covered = [...coveredSet];
  const uncovered = [...uncoveredSet];
  const totalVariants = covered.length + uncovered.length;
  const coveredCount = covered.length;

  return { covered, uncovered, totalVariants, coveredCount };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

const _handler: FunctionalConceptHandler = {
  check(input: Record<string, unknown>) {
    const programStr = input.program as string;
    const conceptSpecsStr = input.conceptSpecs as string;

    // Input validation — empty program is an error
    if (!programStr || programStr.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'program is required',
      }) as StorageProgram<Result>;
    }

    // JSON.parse safety — program
    let parsedProgram: unknown;
    try {
      parsedProgram = JSON.parse(programStr);
      void parsedProgram;
    } catch {
      return complete(createProgram(), 'error', {
        message: 'program must be valid JSON',
      }) as StorageProgram<Result>;
    }

    // JSON.parse safety — conceptSpecs
    try {
      JSON.parse(conceptSpecsStr);
    } catch {
      return complete(createProgram(), 'error', {
        message: 'conceptSpecs must be valid JSON',
      }) as StorageProgram<Result>;
    }

    try {
      const { covered, uncovered, totalVariants, coveredCount } =
        analyzeCompletionCoverage(programStr, conceptSpecsStr);

      const resultId = `qcc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const coveredJson = JSON.stringify(covered);
      const uncoveredJson = JSON.stringify(uncovered);

      let p = createProgram();
      p = put(p, 'completionCoverageResult', resultId, {
        covered: coveredJson,
        uncovered: uncoveredJson,
        totalVariants,
        coveredCount,
      });
      p = complete(p, 'ok', {
        result: resultId,
        covered: coveredJson,
        uncovered: uncoveredJson,
      });
      return p as StorageProgram<Result>;
    } catch (e) {
      return complete(createProgram(), 'error', {
        message: `Failed to analyze program: ${(e as Error).message}`,
      }) as StorageProgram<Result>;
    }
  },

  report(input: Record<string, unknown>) {
    const resultId = input.result as string;

    let p = createProgram();
    p = get(p, 'completionCoverageResult', resultId, 'record');

    p = branch(
      p,
      'record',
      (b) =>
        completeFrom(b, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            covered: record.covered as string,
            uncovered: record.uncovered as string,
            totalVariants: record.totalVariants as number,
            coveredCount: record.coveredCount as number,
          };
        }) as StorageProgram<Result>,
      (b) => complete(b, 'notfound', {}) as StorageProgram<Result>,
    ) as StorageProgram<Result>;

    return p;
  },

  listUncovered(input: Record<string, unknown>) {
    const resultId = input.result as string;

    let p = createProgram();
    p = get(p, 'completionCoverageResult', resultId, 'record');

    p = branch(
      p,
      'record',
      (b) =>
        completeFrom(b, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return {
            uncovered: record.uncovered as string,
          };
        }) as StorageProgram<Result>,
      (b) => complete(b, 'notfound', {}) as StorageProgram<Result>,
    ) as StorageProgram<Result>;

    return p;
  },
};

export const queryCompletionCoverageHandler = autoInterpret(_handler);
