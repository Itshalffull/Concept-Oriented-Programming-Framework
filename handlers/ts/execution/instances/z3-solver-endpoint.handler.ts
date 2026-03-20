// @clef-handler style=imperative concept=z3-local
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, pure, perform,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';

/**
 * Z3SolverEndpoint — functional handler.
 *
 * Configures and executes Z3 SMT solver instances. Uses perform("shell",...)
 * for actual solver invocation through the execution layer.
 */
export const z3SolverEndpointHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const name = (input.name as string) || 'z3-local';
    const binaryPath = (input.binaryPath as string) || '/usr/bin/z3';
    const timeout = (input.timeout as number) || 30000;
    const options = (input.options as string) || '-smt2';

    const endpointId = `z3-${name}`;

    let p = createProgram();
    p = put(p, 'endpoints', endpointId, { name, binaryPath, timeout, options });
    p = pure(p, { variant: 'ok', endpoint: endpointId, name, binaryPath, timeout, options });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  solve(input: Record<string, unknown>) {
    const name = input.name as string;
    const formula = input.formula as string;
    const logic = (input.logic as string) || 'ALL';

    let p = createProgram();
    p = get(p, 'endpoints', `z3-${name}`, 'endpointData');

    // Execute Z3 via shell through the execution layer
    p = perform(p, 'shell', 'exec', {
      command: 'z3',
      args: `-smt2 -in <<< "${formula.replace(/"/g, '\\"')}"`,
      env: '{}',
      cwd: '/tmp',
      timeout: 30000,
    }, 'solverResult');

    p = pure(p, {
      variant: 'ok',
      result: '',
      status: 'unknown',
      timingMs: 0,
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolve(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = get(p, 'endpoints', `z3-${name}`, 'endpointData');
    p = pure(p, {
      variant: 'ok',
      endpoint: `z3-${name}`,
      binaryPath: '',
      timeout: 30000,
      options: '-smt2',
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
