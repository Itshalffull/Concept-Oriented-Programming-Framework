import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.ts';

export const deadBranchProviderHandler: ConceptHandler = {
  async analyze(input: Record<string, unknown>, storage: ConceptStorage) {
    const program = input.program as string;
    const constraints = input.constraints as string;

    try {
      const deadBranches: string[] = [];
      let totalCount = 0;
      let reachableCount = 0;

      // Parse the program to find branch instructions
      try {
        const parsed = JSON.parse(program);
        const instructions = parsed.instructions || [];
        for (const instr of instructions) {
          if (instr.tag === 'branch') {
            totalCount += 2; // then + else
            const condition = instr.condition;
            // Static evaluation of literal conditions
            if (condition === 'true' || condition === true) {
              reachableCount += 1;
              deadBranches.push(`else-branch at condition "${condition}" is unreachable`);
            } else if (condition === 'false' || condition === false) {
              reachableCount += 1;
              deadBranches.push(`then-branch at condition "${condition}" is unreachable`);
            } else {
              // Cannot determine statically — both are reachable
              reachableCount += 2;
            }
          }
        }
      } catch {
        // Try textual format: "branch(condition, thenP, elseP)"
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
      await storage.put('results', resultId, { deadBranches, reachableCount, totalCount });

      return {
        variant: 'ok',
        result: resultId,
        deadBranches: JSON.stringify(deadBranches),
        reachableCount,
        totalCount,
      };
    } catch (e) {
      return { variant: 'error', message: `Dead branch analysis failed: ${(e as Error).message}` };
    }
  },
};
