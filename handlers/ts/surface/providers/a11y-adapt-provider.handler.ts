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
export function matchesInstruction(instr: RenderInstruction, pattern: Partial<RenderInstruction>): boolean {
  for (const [key, value] of Object.entries(pattern)) {
    if (instr[key] !== value) return false;
  }
  return true;
}

export interface A11yAdaptSpec {
  additions?: RenderInstruction[];
  modifications?: Array<{ match: Partial<RenderInstruction>; set: Partial<RenderInstruction> }>;
}

/**
 * Apply an a11y-adapt spec to an instruction list.
 * Modifies matching instructions, then inserts additions before the terminal pure.
 */
export function applyA11yAdapt(
  instructions: RenderInstruction[],
  spec: A11yAdaptSpec,
): { instructions: RenderInstruction[]; additionCount: number; modificationCount: number } {
  let modificationCount = 0;
  let result = [...instructions];

  // Apply modifications to matching instructions
  if (spec.modifications) {
    result = result.map(instr => {
      for (const mod of spec.modifications!) {
        if (matchesInstruction(instr, mod.match)) {
          modificationCount++;
          return { ...instr, ...mod.set };
        }
      }
      return instr;
    });
  }

  // Append additions (before the terminal pure)
  const additionCount = spec.additions?.length || 0;
  if (spec.additions && spec.additions.length > 0) {
    const pureIdx = result.findIndex(i => i.tag === 'pure');
    if (pureIdx >= 0) {
      result.splice(pureIdx, 0, ...spec.additions);
    } else {
      result.push(...spec.additions);
    }
  }

  return { instructions: result, additionCount, modificationCount };
}

/**
 * A11yAdaptProvider — transform provider handler.
 *
 * Applies accessibility adaptations (ARIA attributes, keyboard
 * bindings, focus management) to RenderProgram instruction sequences.
 * Registered with RenderTransform as kind "a11y-adapt" through sync wiring.
 */
const _a11yAdaptProviderHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = complete(createProgram(), 'ok', {
      name: 'A11yAdaptProvider',
      kind: 'a11y-adapt',
      capabilities: JSON.stringify(['aria-modification', 'aria-injection', 'keyboard-adapt', 'focus-adapt']),
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  apply(input: Record<string, unknown>) {
    const programStr = input.program as string;
    const specStr = input.spec as string;

    try {
      const program = JSON.parse(programStr);
      const spec: A11yAdaptSpec = JSON.parse(specStr);
      const instructions: RenderInstruction[] = program.instructions || [];

      const { instructions: newInstructions, additionCount, modificationCount } =
        applyA11yAdapt(instructions, spec);

      const previousTransforms: string[] = program.appliedTransforms || [];
      const appliedTransforms = [...previousTransforms, JSON.stringify({ kind: 'a11y-adapt', spec: specStr })];

      const resultProgram = {
        ...program,
        instructions: newInstructions,
        appliedTransforms,
      };

      const resultId = `aap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      let p = createProgram();
      p = putLens(p, at(resultsRel, resultId), {
        inputProgram: programStr,
        outputProgram: JSON.stringify(resultProgram),
        additionCount,
        modificationCount,
      });
      p = complete(p, 'ok', {
        result: resultId,
        transformed: JSON.stringify(resultProgram),
        appliedTransforms: JSON.stringify(appliedTransforms),
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    } catch (e) {
      const p = complete(createProgram(), 'error', {
        message: `A11yAdaptProvider: ${(e as Error).message}`,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
  },
};

export const a11yAdaptProviderHandler = autoInterpret(_a11yAdaptProviderHandler);

