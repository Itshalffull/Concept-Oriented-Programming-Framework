// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, branch, put, pure, complete, completeFrom,
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

      function extractList(val: unknown): unknown[] {
        if (Array.isArray(val)) return val as unknown[];
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          const obj = val as Record<string, unknown>;
          if (obj.type === 'list' && Array.isArray(obj.items)) {
            return (obj.items as Array<Record<string, unknown>>).map((item) => {
              if (item && typeof item === 'object' && item.type === 'literal') return item.value;
              return item;
            });
          }
        }
        if (typeof val === 'string') return JSON.parse(val) as unknown[];
        return [];
      }

      if (input.parts) {
        parts = extractList(input.parts) as string[];
      }
      if (input.instructions) {
        const rawInstructions = extractList(input.instructions) as string[];
        // Each instruction is a string like "element:root:container" or a RenderInstruction object
        instructions = rawInstructions.map((item) => {
          if (typeof item === 'string') {
            const parts = item.split(':');
            return { tag: parts[0] || '', part: parts[1] || '', type: parts[2] || '' } as RenderInstruction;
          }
          return item as RenderInstruction;
        });
      }

      const { deadParts, unreachableStates } = analyzeDeadParts(parts, instructions);

      let p = createProgram();
      p = put(p, 'analyses', analysis, { program, deadParts, unreachableStates });
      return complete(p, 'ok', {
        analysis,
        deadParts: JSON.stringify(deadParts),
        unreachableStates: JSON.stringify(unreachableStates),
      }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    } catch (e) {
      return complete(createProgram(), 'error', {
        message: `Dead part analysis failed: ${(e as Error).message}`,
      }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
  },

  getResults(input: Record<string, unknown>) {
    const analysis = input.analysis as string;
    let p = createProgram();
    p = get(p, 'analyses', analysis, 'analysisResult');
    return branch(p, 'analysisResult',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const data = bindings.analysisResult as Record<string, unknown>;
        return { analysis, deadParts: data.deadParts || '[]', unreachableStates: data.unreachableStates || '[]' };
      }),
      (b) => complete(b, 'notfound', { analysis, message: `analysis not found: ${analysis}` }),
    ) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const deadPartProviderHandler = autoInterpret(_deadPartProviderHandler);

