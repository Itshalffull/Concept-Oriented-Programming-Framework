// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
type Result = { variant: string; [key: string]: unknown };
function seedRuntimes(p: StorageProgram<Result>): StorageProgram<Result> {
  p = put(p, 'runtime-providers', 'wasm', { runtime: 'wasm', providerName: 'WasmProvider', registeredAt: new Date().toISOString() });
  p = put(p, 'runtime-providers', 'onnx', { runtime: 'onnx', providerName: 'OnnxProvider', registeredAt: new Date().toISOString() });
  return p;
}
export const localProcessHandler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    let p = createProgram();
    p = seedRuntimes(p);
    p = find(p, 'runtime-providers', {}, 'providers');
    return complete(p, 'ok', { runtimes: '[]' }) as StorageProgram<Result>;
  },
  registerRuntime(input: Record<string, unknown>) {
    const runtime = input.runtime as string;
    const providerName = input.providerName as string;
    let p = createProgram();
    p = seedRuntimes(p);
    p = get(p, 'runtime-providers', runtime, 'existing');
    return branch(p, 'existing',
      (b) => complete(b, 'duplicate', { runtime, message: `runtime already registered: ${runtime}` }),
      (b) => {
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
    const config = input.config as string || '{}';
    const processId = `proc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let p = createProgram();
    p = seedRuntimes(p);
    p = get(p, 'runtime-providers', runtime, 'provider');
    return branch(p, 'provider',
      (b) => {
        // Check if module is broken
        if (moduleRef && moduleRef.includes('broken')) {
          return complete(b, 'error', { runtime, message: `failed to execute: ${moduleRef}` });
        }
        const b2 = put(b, 'processes', processId, { runtime, moduleRef, input: inputData, status: 'running', config, operation });
        return complete(b2, 'ok', { process: processId, result: '', runtime, operation, moduleRef, input: inputData, config });
      },
      (b) => complete(b, 'runtimeNotFound', { runtime, message: `runtime not found: ${runtime}` }),
    ) as StorageProgram<Result>;
  },
  listRuntimes(_input: Record<string, unknown>) {
    let p = createProgram();
    p = seedRuntimes(p);
    p = find(p, 'runtime-providers', {}, 'allProviders');
    return complete(p, 'ok', { runtimes: '[]' }) as StorageProgram<Result>;
  },
};
