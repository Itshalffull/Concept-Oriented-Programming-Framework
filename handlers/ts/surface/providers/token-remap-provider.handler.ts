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
 * Apply a token-remap spec to an instruction list.
 * Rewrites `{tag: 'token', path: X}` instructions per the mappings.
 */
export function applyTokenRemap(
  instructions: RenderInstruction[],
  mappings: Record<string, string>,
): { instructions: RenderInstruction[]; remapCount: number } {
  let remapCount = 0;
  const result = instructions.map(instr => {
    if (instr.tag === 'token' && typeof instr.path === 'string') {
      const newPath = mappings[instr.path];
      if (newPath) {
        remapCount++;
        return { ...instr, path: newPath };
      }
    }
    return instr;
  });
  return { instructions: result, remapCount };
}

/**
 * TokenRemapProvider — transform provider handler.
 *
 * Rewrites theme token path references in RenderProgram instruction
 * sequences. Registered with RenderTransform as kind "token-remap"
 * through sync wiring.
 */
const _tokenRemapProviderHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = complete(createProgram(), 'ok', {
      name: 'TokenRemapProvider',
      kind: 'token-remap',
      capabilities: JSON.stringify(['token-path-rewrite', 'theme-switching']),
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
      const mappings: Record<string, string> = spec.mappings || {};

      const { instructions: newInstructions, remapCount } = applyTokenRemap(instructions, mappings);

      const previousTransforms: string[] = program.appliedTransforms || [];
      const appliedTransforms = [...previousTransforms, JSON.stringify({ kind: 'token-remap', spec: specStr })];

      const resultProgram = {
        ...program,
        instructions: newInstructions,
        appliedTransforms,
      };

      const resultId = `trp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      let p = createProgram();
      p = putLens(p, at(resultsRel, resultId), {
        inputProgram: programStr,
        outputProgram: JSON.stringify(resultProgram),
        remapCount,
      });
      p = complete(p, 'ok', {
        result: resultId,
        transformed: JSON.stringify(resultProgram),
        appliedTransforms: JSON.stringify(appliedTransforms),
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    } catch (e) {
      const p = complete(createProgram(), 'error', {
        message: `TokenRemapProvider: ${(e as Error).message}`,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
  },
};

export const tokenRemapProviderHandler = autoInterpret(_tokenRemapProviderHandler);

