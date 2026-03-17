// ============================================================
// RenderInterpreterReact — self-registering provider
// ============================================================
//
// Registers itself in plugin-registry as a render-interpreter-provider
// for the "react" target.  The RenderInterpreter dispatcher discovers
// this provider at runtime without importing it.

import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.ts';
import { interpretReact } from '../interpreter-targets/react.ts';
import type { RenderInstruction } from '../render-program-builder.ts';

const PROVIDER_REF = 'render-interpreter-provider:react';

let idCounter = 0;
function nextId(): string { return `ri-react-${++idCounter}`; }

export const renderInterpreterReactHandler: ConceptHandler = {
  /**
   * Self-register in plugin-registry so the RenderInterpreter
   * dispatcher can discover this provider for target "react".
   */
  async initialize(_input: Record<string, unknown>, storage: ConceptStorage) {
    // Idempotent — skip if already registered
    const existing = await storage.find('plugin-registry', {
      pluginKind: 'render-interpreter-provider',
      target: 'react',
    });
    if (existing.length > 0) {
      return { variant: 'ok', provider: PROVIDER_REF };
    }

    const id = nextId();

    await storage.put('render-interpreter-react', id, {
      id,
      providerRef: PROVIDER_REF,
      target: 'react',
    });

    await storage.put('plugin-registry', PROVIDER_REF, {
      pluginKind: 'render-interpreter-provider',
      target: 'react',
      providerRef: PROVIDER_REF,
      instanceId: id,
    });

    return { variant: 'ok', provider: PROVIDER_REF };
  },

  /**
   * Interpret a RenderProgram instruction sequence into a
   * TypeScript/React functional component.
   */
  async interpret(input: Record<string, unknown>, storage: ConceptStorage) {
    const executionId = input.executionId as string | undefined;
    const componentName = (input.componentName as string) || 'Widget';
    const dryRun = input.dryRun === true;

    let instructions: RenderInstruction[];
    try {
      if (input.instructions) {
        instructions = (
          Array.isArray(input.instructions)
            ? input.instructions
            : JSON.parse(input.instructions as string)
        ) as RenderInstruction[];
      } else if (input.program) {
        // Program may be a JSON-serialised instruction array
        const raw = input.program as string;
        instructions = JSON.parse(raw) as RenderInstruction[];
      } else {
        return { variant: 'error', message: 'No instructions or program provided' };
      }
    } catch {
      return { variant: 'error', message: 'Failed to parse instructions' };
    }

    const { output, trace } = interpretReact(instructions, componentName);

    if (dryRun) {
      return {
        variant: 'ok',
        componentName,
        output,
        trace: JSON.stringify(trace),
        dryRun: true,
      };
    }

    // Persist execution result
    if (executionId) {
      await storage.put('executions', executionId, {
        target: 'react',
        componentName,
        output,
        trace,
        status: 'completed',
      });
    }

    return {
      variant: 'ok',
      componentName,
      output,
      trace: JSON.stringify(trace),
    };
  },
};

export function resetRenderInterpreterReactCounter(): void { idCounter = 0; }
