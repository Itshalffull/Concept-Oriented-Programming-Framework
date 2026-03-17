import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, put, pure,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';

/**
 * DeadBranchProvider — functional handler.
 *
 * Analyzes a program for unreachable branches by evaluating literal
 * conditions statically. Returns a StorageProgram describing the result.
 */
export const deadBranchProviderHandler: FunctionalConceptHandler = {
  analyze(input: Record<string, unknown>) {
    const program = input.program as string;

    try {
      const deadBranches: string[] = [];
      let totalCount = 0;
      let reachableCount = 0;

      try {
        const parsed = JSON.parse(program);
        const instructions = parsed.instructions || [];
        for (const instr of instructions) {
          if (instr.tag === 'branch') {
            totalCount += 2;
            const condition = instr.condition;
            if (condition === 'true' || condition === true) {
              reachableCount += 1;
              deadBranches.push(`else-branch at condition "${condition}" is unreachable`);
            } else if (condition === 'false' || condition === false) {
              reachableCount += 1;
              deadBranches.push(`then-branch at condition "${condition}" is unreachable`);
            } else {
              reachableCount += 2;
            }
          }
        }
      } catch {
        const branchMatches = program.matchAll(/branch\((\w+)/g);
        for (const match of branchMatches) {
          totalCount += 2;
          const condition = match[1];
          if (condition === 'false') {
            reachableCount += 1;
            deadBranches.push(`then-branch at condition "${condition}" is unreachable`);
          } else if (condition === 'true') {
            reachableCount += 1;
            deadBranches.push(`else-branch at condition "${condition}" is unreachable`);
          } else {
            reachableCount += 2;
          }
        }
      }

      const resultId = `db-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      let p = createProgram();
      p = put(p, 'results', resultId, { deadBranches, reachableCount, totalCount });
      p = pure(p, {
        variant: 'ok',
        result: resultId,
        deadBranches: JSON.stringify(deadBranches),
        reachableCount,
        totalCount,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    } catch (e) {
      const p = pure(createProgram(), {
        variant: 'error',
        message: `Dead branch analysis failed: ${(e as Error).message}`,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
  },
};
