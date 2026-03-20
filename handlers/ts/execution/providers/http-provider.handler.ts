// @clef-handler style=imperative
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, pure, perform,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';

/**
 * HttpProvider — functional handler.
 *
 * Executes HTTP requests against configured endpoint instances.
 * Uses perform() for actual network I/O — the interpreter resolves
 * this at the edge, keeping the handler pure and testable.
 */
export const httpProviderHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = pure(createProgram(), {
      variant: 'ok',
      name: 'http-provider',
      kind: 'protocol',
      capabilities: JSON.stringify(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
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
    p = pure(p, { variant: 'ok', instance: instanceId });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  execute(input: Record<string, unknown>) {
    const instance = input.instance as string;
    const method = input.method as string;
    const path = input.path as string || '';
    const body = input.body as string || '';
    const headers = input.headers as string || '{}';

    let p = createProgram();
    p = get(p, 'instances', `http-${instance}`, 'instanceConfig');

    // Declare the HTTP transport effect — the interpreter resolves
    // this to actual fetch() at the edge
    p = perform(p, 'http', method, {
      instance,
      path,
      body,
      headers,
    }, 'httpResponse');

    p = pure(p, {
      variant: 'ok',
      status: 200,
      body: '',
      headers: '{}',
      instance,
      method,
      path,
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'instances', {}, 'allInstances');
    p = pure(p, { variant: 'ok', instances: '[]' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
