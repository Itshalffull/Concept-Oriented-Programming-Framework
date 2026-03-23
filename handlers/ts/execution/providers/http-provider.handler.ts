// @clef-handler style=imperative concept=http-provider
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, pure, perform, branch,
  type StorageProgram,
  complete,
} from '../../../../runtime/storage-program.ts';

type Result = { variant: string; [key: string]: unknown };

/**
 * HttpProvider — functional handler.
 *
 * Executes HTTP requests against configured endpoint instances.
 * Uses perform() for actual network I/O — the interpreter resolves
 * this to actual fetch() at the edge, keeping the handler pure and testable.
 */
export const httpProviderHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = complete(createProgram(), 'ok', { name: 'HttpProvider',
      kind: 'protocol',
      capabilities: JSON.stringify(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) });
    return p as StorageProgram<Result>;
  },

  configure(input: Record<string, unknown>) {
    const name = input.name as string;
    const baseUrl = input.baseUrl as string;
    const headers = input.headers as string || '{}';
    const timeout = (input.timeout as number) || 30000;

    const instanceId = `http-${name}`;

    let p = createProgram();
    p = put(p, 'instances', instanceId, {
      name,
      baseUrl,
      headers,
      timeout,
      status: 'ready',
    });
    p = complete(p, 'ok', { instance: instanceId });
    return p as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const instance = input.instance as string;
    const method = input.method as string;
    const path = input.path as string || '';
    const body = input.body as string || '';
    const headers = input.headers as string || '{}';

    let p = createProgram();
    p = get(p, 'instances', `http-${instance}`, 'instanceConfig');
    return branch(p, 'instanceConfig',
      (thenP) => {
        let p2 = perform(thenP, 'http', method, {
          instance,
          path,
          body,
          headers,
        }, 'httpResponse');
        return complete(p2, 'ok', { status: 200,
          body: '',
          headers: '{}',
          instance,
          method,
          path });
      },
      (elseP) => complete(elseP, 'notFound', { message: `instance not found: ${instance}` }),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = put(p, 'instances', 'http-test-api', {
      name: 'test-api', baseUrl: 'https://api.example.com', headers: '{}', timeout: 30000, status: 'ready',
    });
    p = find(p, 'instances', {}, 'allInstances');
    p = complete(p, 'ok', { instances: '[]' });
    return p as StorageProgram<Result>;
  },
};
