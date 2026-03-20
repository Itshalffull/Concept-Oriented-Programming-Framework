// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, putLens, complete, relation, at,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import type { RenderInstruction } from '../render-program-builder.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

const resultsRel = relation('results');

/**
 * Check if an instruction matches a partial pattern.
 */
function matchesInstruction(instr: RenderInstruction, pattern: Partial<RenderInstruction>): boolean {
  for (const [key, value] of Object.entries(pattern)) {
    if (instr[key] !== value) return false;
  }
  return true;
}

/**
 * Apply a custom transform spec to an instruction list.
 * Pattern-matches on arbitrary instruction fields and merges replacement fields.
 */
export function applyCustomTransform(
  instructions: RenderInstruction[],
  match: Partial<RenderInstruction>,
  replace: Partial<RenderInstruction>,
): { instructions: RenderInstruction[]; matchCount: number } {
  let matchCount = 0;
  const result = instructions.map(instr => {
    if (matchesInstruction(instr, match)) {
      matchCount++;
      return { ...instr, ...replace };
    }
    return instr;
  });
  return { instructions: result, matchCount };
}

/**
 * CustomTransformProvider — transform provider handler.
 *
 * Generic pattern-match-and-replace on arbitrary RenderProgram
 * instructions. Registered with RenderTransform as kind "custom"
 * through sync wiring.
 */
const _customTransformProviderHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = complete(createProgram(), 'ok', {
      name: 'CustomTransformProvider',
      kind: 'custom',
      capabilities: JSON.stringify(['pattern-match', 'field-replace', 'generic-transform']),
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
      const match: Partial<RenderInstruction> = spec.match || {};
      const replace: Partial<RenderInstruction> = spec.replace || {};

      const { instructions: newInstructions, matchCount } = applyCustomTransform(instructions, match, replace);

      const previousTransforms: string[] = program.appliedTransforms || [];
      const appliedTransforms = [...previousTransforms, JSON.stringify({ kind: 'custom', spec: specStr })];

      const resultProgram = {
        ...program,
        instructions: newInstructions,
        appliedTransforms,
      };

      const resultId = `ctp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      let p = createProgram();
      p = putLens(p, at(resultsRel, resultId), {
        inputProgram: programStr,
        outputProgram: JSON.stringify(resultProgram),
        matchCount,
      });
      p = complete(p, 'ok', {
        result: resultId,
        transformed: JSON.stringify(resultProgram),
        appliedTransforms: JSON.stringify(appliedTransforms),
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    } catch (e) {
      const p = complete(createProgram(), 'error', {
        message: `CustomTransformProvider: ${(e as Error).message}`,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
  },
};

export const customTransformProviderHandler = autoInterpret(_customTransformProviderHandler);

