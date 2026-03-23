// @clef-handler style=imperative concept=alloy-local
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, pure, perform, branch, completeFrom,
  type StorageProgram,
  complete,
} from '../../../../runtime/storage-program.ts';
type Result = { variant: string; [key: string]: unknown };
export const alloySolverEndpointHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    const name = input.name as string;
    const jarPath = (input.jarPath as string) || '/opt/alloy/alloy.jar';
    const scope = (input.scope as number) || 5;
    const timeout = (input.timeout as number) || 60000;
    const options = (input.options as string) || '';
    const endpointId = `alloy-${name}`;
    let p = createProgram();
    p = put(p, 'endpoints', endpointId, { name, jarPath, scope, timeout, options });
    p = complete(p, 'ok', { endpoint: endpointId, name, jarPath, scope, timeout });
    return p as StorageProgram<Result>;
  },
  check(input: Record<string, unknown>) {
    const name = input.name as string;
    const model = input.model as string;
    const predicate = input.predicate as string;
    let p = createProgram();
    p = get(p, 'endpoints', `alloy-${name}`, 'endpointData');
    return branch(p, 'endpointData',
      (b) => {
        let b2 = perform(b, 'shell', 'exec', { command: 'java', args: `-jar /opt/alloy/alloy.jar -c "${predicate}"`, env: '{}', cwd: '/tmp', timeout: 60000 }, 'solverResult');
        return complete(b2, 'ok', { result: '', counterexample: '', timingMs: 0 });
      },
      (b) => complete(b, 'error', { message: `endpoint not found: ${name}` }),
    ) as StorageProgram<Result>;
  },
  resolve(input: Record<string, unknown>) {
    const name = input.name as string;
    let p = createProgram();
    p = get(p, 'endpoints', `alloy-${name}`, 'endpointData');
    return branch(p, 'endpointData',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const data = bindings.endpointData as Record<string, unknown>;
        return { endpoint: `alloy-${name}`, jarPath: data.jarPath as string, scope: data.scope as number, timeout: data.timeout as number };
      }),
      (b) => complete(b, 'error', { message: `endpoint not found: ${name}` }),
    ) as StorageProgram<Result>;
  },
};
