// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, put, pure,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

/**
 * DeadPartProvider — functional handler.
 *
 * Detects anatomy parts declared in a RenderProgram that are never
 * connected to data bindings, text content, or composition slots.
 * Also detects FSM states with no inbound transitions.
 */

type RenderInstruction = { tag: string; [key: string]: unknown };

function analyzeDeadParts(parts: string[], instructions: RenderInstruction[]): { deadParts: string[]; unreachableStates: string[] } {
  // Track which parts are referenced by bind, text, compose, aria, keyboard
  const referencedParts = new Set<string>();
  const stateNames = new Map<string, boolean>(); // name -> isInitial
  const transitionTargets = new Set<string>();

  for (const instr of instructions) {
    switch (instr.tag) {
      case 'text':
      case 'bind':
      case 'aria':
        referencedParts.add(instr.part as string);
        break;
      case 'compose':
        referencedParts.add(instr.slot as string);
        break;
      case 'element':
        // element declarations are not references — they define the part
        break;
      case 'stateDef':
        stateNames.set(instr.name as string, instr.initial as boolean);
        break;
      case 'transition':
        transitionTargets.add(instr.toState as string);
        break;
    }
  }

  // Dead parts: declared but never referenced
  const deadParts = parts.filter(p => !referencedParts.has(p));

  // Unreachable states: not initial and no inbound transitions
  const unreachableStates: string[] = [];
  for (const [name, isInitial] of stateNames) {
    if (!isInitial && !transitionTargets.has(name)) {
      unreachableStates.push(name);
    }
  }

  return { deadParts, unreachableStates };
}

const _deadPartProviderHandler: FunctionalConceptHandler = {
  analyze(input: Record<string, unknown>) {
    const analysis = input.analysis as string;
    const program = input.program as string;

    try {
      let parts: string[] = [];
      let instructions: RenderInstruction[] = [];

      if (input.parts) {
        parts = (Array.isArray(input.parts) ? input.parts : JSON.parse(input.parts as string)) as string[];
      }
      if (input.instructions) {
        instructions = (Array.isArray(input.instructions) ? input.instructions : JSON.parse(input.instructions as string)) as RenderInstruction[];
      }

      const { deadParts, unreachableStates } = analyzeDeadParts(parts, instructions);

      let p = createProgram();
      p = put(p, 'analyses', analysis, { program, deadParts, unreachableStates });
      p = pure(p, {
        variant: 'ok',
        analysis,
        deadParts: JSON.stringify(deadParts),
        unreachableStates: JSON.stringify(unreachableStates),
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    } catch (e) {
      const p = pure(createProgram(), {
        variant: 'error',
        message: `Dead part analysis failed: ${(e as Error).message}`,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
  },

  getResults(input: Record<string, unknown>) {
    const analysis = input.analysis as string;
    let p = createProgram();
    p = put(p, '__query', 'analyses', { key: analysis, bindAs: 'analysisResult' });
    p = pure(p, {
      variant: 'ok',
      analysis,
      deadParts: '__BOUND:analysisResult.deadParts',
      unreachableStates: '__BOUND:analysisResult.unreachableStates',
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const deadPartProviderHandler = autoInterpret(_deadPartProviderHandler);

