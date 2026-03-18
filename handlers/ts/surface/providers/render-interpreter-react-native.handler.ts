// RenderInterpreterReactNative — self-registering provider for "react-native" target

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, find, put, branch, complete,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { interpretReactNative } from '../interpreter-targets/react-native.ts';
import type { RenderInstruction } from '../render-program-builder.ts';

const PROVIDER_REF = 'render-interpreter-provider:react-native';

let idCounter = 0;
function nextId(): string { return `ri-reactnative-${++idCounter}`; }

export const renderInterpreterReactNativeHandler: FunctionalConceptHandler = {
  initialize(input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'plugin-registry', { pluginKind: 'render-interpreter-provider', target: 'react-native' }, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { provider: PROVIDER_REF }),
      (b) => {
        const id = nextId();
        let b2 = put(b, 'render-interpreter-react-native', id, {
          id, providerRef: PROVIDER_REF, target: 'react-native',
        });
        b2 = put(b2, 'plugin-registry', PROVIDER_REF, {
          pluginKind: 'render-interpreter-provider',
          target: 'react-native', providerRef: PROVIDER_REF, instanceId: id,
        });
        return complete(b2, 'ok', { provider: PROVIDER_REF });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  interpret(input: Record<string, unknown>) {
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
        instructions = JSON.parse(input.program as string) as RenderInstruction[];
      } else {
        let p = createProgram();
        return complete(p, 'error', { message: 'No instructions or program provided' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
      }
    } catch {
      let p = createProgram();
      return complete(p, 'error', { message: 'Failed to parse instructions' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const { output, trace } = interpretReactNative(instructions, componentName);

    let p = createProgram();
    if (!dryRun) {
      const executionId = input.executionId as string | undefined;
      if (executionId) {
        p = put(p, 'executions', executionId, {
          target: 'react-native', componentName, output, trace, status: 'completed',
        });
      }
    }
    return complete(p, 'ok', {
      componentName, output, trace: JSON.stringify(trace), ...(dryRun ? { dryRun: true } : {}),
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};


export function resetRenderInterpreterReactNativeCounter(): void { idCounter = 0; }
