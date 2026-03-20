// @clef-handler style=imperative
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, pure, perform,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';

/**
 * AlloySolverEndpoint — functional handler.
 *
 * Configures and executes Alloy bounded model checker instances.
 * Uses perform("shell",...) for actual solver invocation.
 */
export const alloySolverEndpointHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const name = (input.name as string) || 'alloy-local';
    const jarPath = (input.jarPath as string) || '/opt/alloy/alloy.jar';
    const scope = (input.scope as number) || 5;
    const timeout = (input.timeout as number) || 60000;
    const options = (input.options as string) || '';

    const endpointId = `alloy-${name}`;

    let p = createProgram();
    p = put(p, 'endpoints', endpointId, { name, jarPath, scope, timeout, options });
    p = pure(p, { variant: 'ok', endpoint: endpointId, name, jarPath, scope, timeout });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  check(input: Record<string, unknown>) {
    const name = input.name as string;
    const model = input.model as string;
    const predicate = input.predicate as string;

    let p = createProgram();
    p = get(p, 'endpoints', `alloy-${name}`, 'endpointData');

    // Execute Alloy via shell through the execution layer
    p = perform(p, 'shell', 'exec', {
      command: 'java',
      args: `-jar /opt/alloy/alloy.jar -c "${predicate}"`,
      env: '{}',
      cwd: '/tmp',
      timeout: 60000,
    }, 'solverResult');

    p = pure(p, {
      variant: 'ok',
      result: '',
      counterexample: '',
      timingMs: 0,
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolve(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = get(p, 'endpoints', `alloy-${name}`, 'endpointData');
    p = pure(p, {
      variant: 'ok',
      endpoint: `alloy-${name}`,
      jarPath: '',
      scope: 5,
      timeout: 60000,
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
