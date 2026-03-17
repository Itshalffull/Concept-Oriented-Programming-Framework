// RenderInterpreterGtk — self-registering provider for "gtk" target

import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.ts';
import { interpretGtk } from '../interpreter-targets/gtk.ts';
import type { RenderInstruction } from '../render-program-builder.ts';

const PROVIDER_REF = 'render-interpreter-provider:gtk';

let idCounter = 0;
function nextId(): string { return `ri-gtk-${++idCounter}`; }

export const renderInterpreterGtkHandler: ConceptHandler = {
  async initialize(_input: Record<string, unknown>, storage: ConceptStorage) {
    const existing = await storage.find('plugin-registry', {
      pluginKind: 'render-interpreter-provider',
      target: 'gtk',
    });
    if (existing.length > 0) return { variant: 'ok', provider: PROVIDER_REF };

    const id = nextId();
    await storage.put('render-interpreter-gtk', id, { id, providerRef: PROVIDER_REF, target: 'gtk' });
    await storage.put('plugin-registry', PROVIDER_REF, {
      pluginKind: 'render-interpreter-provider',
      target: 'gtk',
      providerRef: PROVIDER_REF,
      instanceId: id,
    });

    return { variant: 'ok', provider: PROVIDER_REF };
  },

  async interpret(input: Record<string, unknown>, storage: ConceptStorage) {
    const executionId = input.executionId as string | undefined;
    const componentName = (input.componentName as string) || 'Widget';
    const dryRun = input.dryRun === true;

    let instructions: RenderInstruction[];
    try {
      if (input.instructions) {
        instructions = (Array.isArray(input.instructions) ? input.instructions : JSON.parse(input.instructions as string)) as RenderInstruction[];
      } else if (input.program) {
        instructions = JSON.parse(input.program as string) as RenderInstruction[];
      } else {
        return { variant: 'error', message: 'No instructions or program provided' };
      }
    } catch {
      return { variant: 'error', message: 'Failed to parse instructions' };
    }

    const { output, trace } = interpretGtk(instructions, componentName);

    if (dryRun) {
      return { variant: 'ok', componentName, output, trace: JSON.stringify(trace), dryRun: true };
    }

    if (executionId) {
      await storage.put('executions', executionId, {
        target: 'gtk', componentName, output, trace, status: 'completed',
      });
    }

    return { variant: 'ok', componentName, output, trace: JSON.stringify(trace) };
  },
};

export function resetRenderInterpreterGtkCounter(): void { idCounter = 0; }
