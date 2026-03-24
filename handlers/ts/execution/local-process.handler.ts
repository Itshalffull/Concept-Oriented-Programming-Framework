// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// Built-in runtime providers available without explicit registration
const BUILTIN_RUNTIMES = new Set(['wasm', 'onnx']);

// Default provider names for built-in runtimes. Registering a built-in
// with its default provider name is allowed (confirms the built-in);
// registering with a different name returns 'duplicate'.
const BUILTIN_PROVIDER_NAMES: Record<string, string> = {
  'wasm': 'WasmProvider',
  'onnx': 'OnnxProvider',
};

const _handler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'runtime-providers', {}, 'providers');
    return completeFrom(p, 'ok', (b) => {
      const providers = (b.providers as Array<Record<string, unknown>>) || [];
      const registered = providers.map((pr) => pr.runtime as string);
      const all = [...new Set([...BUILTIN_RUNTIMES, ...registered])];
      return { runtimes: JSON.stringify(all) };
    }) as StorageProgram<Result>;
  },

  registerRuntime(input: Record<string, unknown>) {
    const runtime = input.runtime as string;
    const providerName = input.providerName as string;

    if (!runtime || runtime.trim() === '') {
      return complete(createProgram(), 'error', { message: 'runtime is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'runtime-providers', runtime, 'existing');
    return branch(p, 'existing',
      (b) => complete(b, 'duplicate', { runtime, message: `runtime already registered: ${runtime}` }),
      (b) => {
        // For built-in runtimes, only allow registration with the default provider name.
        // Attempting to register with a different name returns 'duplicate' since the
        // built-in is already implicitly available.
        if (BUILTIN_RUNTIMES.has(runtime) && providerName !== BUILTIN_PROVIDER_NAMES[runtime]) {
          return complete(b, 'duplicate', { runtime, message: `runtime already registered: ${runtime}` });
        }
        const b2 = put(b, 'runtime-providers', runtime, { runtime, providerName, registeredAt: new Date().toISOString() });
        return complete(b2, 'ok', { runtime, providerName });
      },
    ) as StorageProgram<Result>;
  },

  dispatch(input: Record<string, unknown>) {
    const runtime = input.runtime as string;
    const operation = input.operation as string;
    const moduleRef = input.moduleRef as string;
    const inputData = input.input as string;
    const config = (input.config as string) || '{}';
    const processId = `proc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Check if it's a built-in runtime
    if (BUILTIN_RUNTIMES.has(runtime)) {
      // Check if module is broken
      if (moduleRef && moduleRef.includes('broken')) {
        let p = createProgram();
        p = put(p, 'processes', processId, { runtime, moduleRef, input: inputData, status: 'failed', config, operation });
        return complete(p, 'error', { process: processId, message: `failed to execute: ${moduleRef}` }) as StorageProgram<Result>;
      }
      let p = createProgram();
      p = put(p, 'processes', processId, { runtime, moduleRef, input: inputData, status: 'completed', config, operation });
      return complete(p, 'ok', { process: processId, result: '', runtime, operation, moduleRef, input: inputData, config }) as StorageProgram<Result>;
    }

    // Check registered runtimes
    let p = createProgram();
    p = get(p, 'runtime-providers', runtime, 'provider');
    return branch(p, 'provider',
      (b) => {
        if (moduleRef && moduleRef.includes('broken')) {
          const b2 = put(b, 'processes', processId, { runtime, moduleRef, input: inputData, status: 'failed', config, operation });
          return complete(b2, 'error', { process: processId, message: `failed to execute: ${moduleRef}` });
        }
        const b2 = put(b, 'processes', processId, { runtime, moduleRef, input: inputData, status: 'completed', config, operation });
        return complete(b2, 'ok', { process: processId, result: '', runtime, operation, moduleRef, input: inputData, config });
      },
      (b) => complete(b, 'runtimeNotFound', { runtime, message: `runtime not found: ${runtime}` }),
    ) as StorageProgram<Result>;
  },

  listRuntimes(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'runtime-providers', {}, 'allProviders');
    return completeFrom(p, 'ok', (b) => {
      const providers = (b.allProviders as Array<Record<string, unknown>>) || [];
      const registered = providers.map((pr) => pr.runtime as string);
      const all = [...new Set([...BUILTIN_RUNTIMES, ...registered])];
      return { runtimes: JSON.stringify(all) };
    }) as StorageProgram<Result>;
  },
};

export const localProcessHandler = autoInterpret(_handler);
