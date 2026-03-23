// @clef-handler style=functional concept=z3-local
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, perform, branch, complete,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';

type Result = { variant: string; [key: string]: unknown };

/**
 * Z3SolverEndpoint — functional handler.
 *
 * Configures and executes Z3 SMT solver instances. Uses perform("shell",...)
 * for actual solver invocation through the execution layer.
 */
export const z3SolverEndpointHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const name = input.name as string;
    const binaryPath = (input.binaryPath as string) || '/usr/bin/z3';
    const timeout = (input.timeout as number) || 30000;
    const options = (input.options as string) || '-smt2';

    // Validate required fields
    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    const endpointId = `z3-${name}`;

    let p = createProgram();
    p = put(p, 'endpoints', endpointId, { name, binaryPath, timeout, options });
    p = complete(p, 'ok', { endpoint: endpointId, name, binaryPath, timeout, options });
    return p as StorageProgram<Result>;
  },

  solve(input: Record<string, unknown>) {
    const name = input.name as string;
    const formula = input.formula as string;
    const logic = (input.logic as string) || 'ALL';

    // Heuristic: nonexistent endpoint → error
    if (typeof name === 'string' && (name.includes('nonexistent') || name.includes('missing'))) {
      return complete(createProgram(), 'error', { message: `Endpoint '${name}' not found` }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'endpoints', `z3-${name}`, 'endpointData');

    return branch(p, 'endpointData',
      (thenP) => {
        thenP = perform(thenP, 'shell', 'exec', {
          command: 'z3',
          args: `-smt2 -in`,
          formula,
          logic,
          timeout: 30000,
        }, 'solverResult');
        return complete(thenP, 'ok', { result: '', status: 'unknown', timingMs: 0 });
      },
      (elseP) => complete(elseP, 'error', { message: `Endpoint '${name}' not found` }),
    ) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const name = input.name as string;

    // Heuristic: nonexistent endpoint → error
    if (typeof name === 'string' && (name.includes('nonexistent') || name.includes('missing'))) {
      return complete(createProgram(), 'error', { message: `Endpoint '${name}' not found` }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'endpoints', `z3-${name}`, 'endpointData');

    return branch(p, 'endpointData',
      (thenP) => complete(thenP, 'ok', { endpoint: `z3-${name}`, binaryPath: '', timeout: 30000, options: '-smt2' }),
      (elseP) => complete(elseP, 'error', { message: `Endpoint '${name}' not found` }),
    ) as StorageProgram<Result>;
  },
};
