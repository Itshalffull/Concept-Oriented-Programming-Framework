// @clef-handler style=imperative
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, pure,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

/**
 * LocalProcess — functional handler.
 *
 * Dispatch registry for in-process computation. Routes runtime-tagged
 * calls to registered runtime providers (WasmProvider, OnnxProvider, etc.)
 * via sync wiring. This handler manages the process lifecycle and provider
 * registry; actual execution is delegated to runtime providers through syncs.
 */
export const localProcessHandler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'runtime-providers', {}, 'providers');

    p = pure(p, {
      variant: 'ok',
      runtimes: '[]',
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  registerRuntime(input: Record<string, unknown>) {
    const runtime = input.runtime as string;
    const providerName = input.providerName as string;

    let p = createProgram();

    p = put(p, 'runtime-providers', runtime, {
      runtime,
      providerName,
      registeredAt: new Date().toISOString(),
    });

    p = pure(p, {
      variant: 'ok',
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  dispatch(input: Record<string, unknown>) {
    const runtime = input.runtime as string;
    const operation = input.operation as string;
    const moduleRef = input.moduleRef as string;
    const inputData = input.input as string;
    const config = input.config as string || '{}';

    const processId = `proc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    let p = createProgram();
    p = get(p, 'runtime-providers', runtime, 'provider');

    p = put(p, 'processes', processId, {
      runtime,
      moduleRef,
      input: inputData,
      status: 'running',
      config,
      operation,
    });

    // Actual dispatch happens via sync wiring to the runtime provider
    p = pure(p, {
      variant: 'ok',
      process: processId,
      result: '',
      runtime,
      operation,
      moduleRef,
      input: inputData,
      config,
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listRuntimes(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'runtime-providers', {}, 'allProviders');
    p = pure(p, {
      variant: 'ok',
      runtimes: '[]',
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
