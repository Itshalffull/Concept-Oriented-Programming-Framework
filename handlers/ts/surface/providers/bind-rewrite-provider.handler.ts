import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, putLens, complete, relation, at,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import type { RenderInstruction } from '../render-program-builder.ts';

const resultsRel = relation('results');

/**
 * Apply a bind-rewrite spec to an instruction list.
 * Rewrites `{tag: 'bind', expr: X}` instructions per the rewrites mapping.
 */
export function applyBindRewrite(
  instructions: RenderInstruction[],
  rewrites: Record<string, string>,
): { instructions: RenderInstruction[]; rewriteCount: number } {
  let rewriteCount = 0;
  const result = instructions.map(instr => {
    if (instr.tag === 'bind' && typeof instr.expr === 'string') {
      const newExpr = rewrites[instr.expr];
      if (newExpr) {
        rewriteCount++;
        return { ...instr, expr: newExpr };
      }
    }
    return instr;
  });
  return { instructions: result, rewriteCount };
}

/**
 * BindRewriteProvider — transform provider handler.
 *
 * Rewrites data binding expressions in RenderProgram instruction
 * sequences. Registered with RenderTransform as kind "bind-rewrite"
 * through sync wiring.
 */
export const bindRewriteProviderHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = complete(createProgram(), 'ok', {
      name: 'BindRewriteProvider',
      kind: 'bind-rewrite',
      capabilities: JSON.stringify(['expression-rewrite', 'data-source-swap']),
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  apply(input: Record<string, unknown>) {
    const programStr = input.program as string;
    const specStr = input.spec as string;

    try {
      const program = JSON.parse(programStr);
      const spec = JSON.parse(specStr);
      const instructions: RenderInstruction[] = program.instructions || [];
      const rewrites: Record<string, string> = spec.rewrites || {};

      const { instructions: newInstructions, rewriteCount } = applyBindRewrite(instructions, rewrites);

      const previousTransforms: string[] = program.appliedTransforms || [];
      const appliedTransforms = [...previousTransforms, JSON.stringify({ kind: 'bind-rewrite', spec: specStr })];

      const resultProgram = {
        ...program,
        instructions: newInstructions,
        appliedTransforms,
      };

      const resultId = `brp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      let p = createProgram();
      p = putLens(p, at(resultsRel, resultId), {
        inputProgram: programStr,
        outputProgram: JSON.stringify(resultProgram),
        rewriteCount,
      });
      p = complete(p, 'ok', {
        result: resultId,
        transformed: JSON.stringify(resultProgram),
        appliedTransforms: JSON.stringify(appliedTransforms),
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    } catch (e) {
      const p = complete(createProgram(), 'error', {
        message: `BindRewriteProvider: ${(e as Error).message}`,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
  },
};
