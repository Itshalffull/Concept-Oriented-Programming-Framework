// @clef-handler style=imperative
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, pure,
  type StorageProgram,
  complete,
} from '../../../../runtime/storage-program.ts';

/**
 * VoyageEndpoint — functional handler.
 *
 * Configures and resolves Voyage AI API endpoint instances.
 * Pure state management — no I/O.
 */
export const voyageEndpointHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    const name = input.name as string;
    const apiKey = input.apiKey as string;
    const model = input.model as string;
    const inputType = (input.inputType as string) || 'document';

    const endpointId = `voyage-${name}`;

    let p = createProgram();
    p = put(p, 'endpoints', endpointId, {
      name,
      apiKey,
      model,
      baseUrl: 'https://api.voyageai.com/v1',
      inputType,
    });
    p = complete(p, 'ok', { endpoint: endpointId,
      name,
      apiKey,
      model,
      inputType });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolve(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = get(p, 'endpoints', `voyage-${name}`, 'endpointData');

    p = complete(p, 'ok', { endpoint: `voyage-${name}`,
      baseUrl: 'https://api.voyageai.com/v1',
      model: '',
      headers: JSON.stringify({
        'Authorization': 'Bearer <resolved-at-runtime>',
        'Content-Type': 'application/json' }),
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'endpoints', {}, 'allEndpoints');
    p = complete(p, 'ok', { endpoints: '[]' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
