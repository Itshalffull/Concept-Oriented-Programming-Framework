// @clef-handler style=imperative
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, pure, perform,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';

/**
 * GraphqlProvider — functional handler.
 *
 * Executes GraphQL operations against configured endpoint instances.
 * Uses perform() for actual network I/O.
 */
export const graphqlProviderHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = pure(createProgram(), {
      variant: 'ok',
      name: 'graphql-provider',
      kind: 'protocol',
      capabilities: JSON.stringify(['query', 'mutation', 'subscription']),
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  configure(input: Record<string, unknown>) {
    const name = input.name as string;
    const url = input.url as string;
    const headers = input.headers as string || '{}';
    const schemaRef = input.schemaRef as string || '';

    const endpointId = `gql-${name}`;

    let p = createProgram();
    p = put(p, 'endpoints', endpointId, {
      name, url, headers, schemaRef, status: 'ready',
    });
    p = pure(p, { variant: 'ok', endpoint: endpointId });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  execute(input: Record<string, unknown>) {
    const endpoint = input.endpoint as string;
    const query = input.query as string;
    const variables = input.variables as string || '{}';
    const operationType = input.operationType as string || 'query';

    let p = createProgram();
    p = get(p, 'endpoints', `gql-${endpoint}`, 'endpointConfig');
    p = perform(p, 'graphql', operationType, {
      endpoint, query, variables,
    }, 'gqlResponse');
    p = pure(p, { variant: 'ok', data: '' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'endpoints', {}, 'allEndpoints');
    p = pure(p, { variant: 'ok', endpoints: '[]' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
