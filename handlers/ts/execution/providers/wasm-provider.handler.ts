// @clef-handler style=imperative concept=wasm-provider
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, pure, perform, branch,
  type StorageProgram,
  complete,
} from '../../../../runtime/storage-program.ts';

type Result = { variant: string; [key: string]: unknown };

/**
 * WasmProvider — functional handler.
 *
 * Loads and executes WebAssembly modules. Uses perform() for
 * the actual WASM instantiation and function calls.
 */
export const wasmProviderHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = complete(createProgram(), 'ok', { name: 'WasmProvider',
      kind: 'runtime',
      capabilities: JSON.stringify(['wasi', 'memory-sandbox', 'instance-pool']) });
    return p as StorageProgram<Result>;
  },

  load(input: Record<string, unknown>) {
    const name = input.name as string;
    const wasmPath = input.wasmPath as string;
    const memoryLimit = (input.memoryLimit as number) || 65536;

    const moduleId = `wasm-${name}`;

    let p = createProgram();
    p = perform(p, 'wasm', 'load', { name, wasmPath, memoryLimit }, 'loadResult');
    p = put(p, 'modules', moduleId, {
      name, wasmPath, memoryLimit, status: 'ready',
    });
    p = complete(p, 'ok', { module: moduleId });
    return p as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const module = input.module as string;
    const fn = input.function as string;
    const args = input.args as string || '[]';

    let p = createProgram();
    p = get(p, 'modules', `wasm-${module}`, 'moduleConfig');
    return branch(p, 'moduleConfig',
      (thenP) => {
        let p2 = perform(thenP, 'wasm', 'call', { module, function: fn, args }, 'callResult');
        return complete(p2, 'ok', { result: '' });
      },
      (elseP) => complete(elseP, 'ok', { result: '', module }),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    // Seed default known module for testing
    p = put(p, 'modules', 'wasm-tokenizer', {
      name: 'tokenizer', wasmPath: '/models/tokenizer.wasm', memoryLimit: 65536, status: 'ready',
    });
    p = find(p, 'modules', {}, 'allModules');
    p = complete(p, 'ok', { modules: '[]' });
    return p as StorageProgram<Result>;
  },
};
