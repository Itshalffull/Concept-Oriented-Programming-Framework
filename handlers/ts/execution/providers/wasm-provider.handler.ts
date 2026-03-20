// @clef-handler style=imperative concept=wasm-provider
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, pure, perform,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';

/**
 * WasmProvider — functional handler.
 *
 * Loads and executes WebAssembly modules. Uses perform() for
 * the actual WASM instantiation and function calls.
 */
export const wasmProviderHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = pure(createProgram(), {
      variant: 'ok',
      name: 'wasm-provider',
      kind: 'runtime',
      capabilities: JSON.stringify(['wasi', 'memory-sandbox', 'instance-pool']),
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
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
    p = pure(p, { variant: 'ok', module: moduleId });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  execute(input: Record<string, unknown>) {
    const module = input.module as string;
    const fn = input.function as string;
    const args = input.args as string || '[]';

    let p = createProgram();
    p = get(p, 'modules', `wasm-${module}`, 'moduleConfig');
    p = perform(p, 'wasm', 'call', { module, function: fn, args }, 'callResult');
    p = pure(p, { variant: 'ok', result: '' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'modules', {}, 'allModules');
    p = pure(p, { variant: 'ok', modules: '[]' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
