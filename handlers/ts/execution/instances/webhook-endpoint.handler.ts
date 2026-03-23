// @clef-handler style=imperative
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, branch, get, put, find, pure,
  type StorageProgram,
  complete, completeFrom,
} from '../../../../runtime/storage-program.ts';

/**
 * WebhookEndpoint — functional handler.
 *
 * Configures and resolves named webhook endpoints for outbound
 * notifications. Pure state management — no I/O.
 */
export const webhookEndpointHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const name = input.name as string;
    const url = input.url as string;
    const headers = (input.headers as string) || '{}';

    const endpointId = `wh-${name}`;

    let p = createProgram();
    p = put(p, 'endpoints', endpointId, {
      name,
      url,
      headers,
      method: 'POST',
    });
    p = complete(p, 'ok', { endpoint: endpointId,
      name,
      url });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolve(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = get(p, 'endpoints', `wh-${name}`, 'endpointData');
    return branch(p, 'endpointData',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const data = bindings.endpointData as Record<string, unknown>;
        return { endpoint: data.name || data.endpoint || '', name: data.name || '', baseUrl: data.baseUrl || data.url || '' };
      }),
      (b) => complete(b, 'notFound', { message: 'endpoint not found' }),
    ) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'endpoints', {}, 'allEndpoints');
    p = complete(p, 'ok', { endpoints: '[]' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
