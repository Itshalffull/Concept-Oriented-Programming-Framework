// @clef-handler style=imperative concept=vercel-api
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, pure,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';

/**
 * VercelApiEndpoint — functional handler.
 *
 * Configures and resolves the Vercel API endpoint. Pure state
 * management — no I/O. Actual HTTP calls flow through HttpProvider.
 */
export const vercelApiEndpointHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const name = (input.name as string) || 'vercel-api';
    const apiToken = input.apiToken as string;
    const teamId = (input.teamId as string) || '';

    const endpointId = `vercel-${name}`;

    let p = createProgram();
    p = put(p, 'endpoints', endpointId, {
      name,
      apiToken,
      teamId,
      baseUrl: 'https://api.vercel.com',
    });
    p = pure(p, {
      variant: 'ok',
      endpoint: endpointId,
      name,
      apiToken,
      teamId,
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolve(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = get(p, 'endpoints', `vercel-${name}`, 'endpointData');
    p = pure(p, {
      variant: 'ok',
      endpoint: `vercel-${name}`,
      baseUrl: 'https://api.vercel.com',
      headers: JSON.stringify({
        'Authorization': 'Bearer <resolved-at-runtime>',
        'Content-Type': 'application/json',
      }),
      teamId: '',
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'endpoints', {}, 'allEndpoints');
    p = pure(p, { variant: 'ok', endpoints: '[]' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
