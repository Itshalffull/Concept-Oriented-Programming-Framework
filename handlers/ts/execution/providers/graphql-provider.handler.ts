// @clef-handler style=imperative concept=graphql-provider
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, pure, perform, branch,
  type StorageProgram,
  complete,
} from '../../../../runtime/storage-program.ts';

type Result = { variant: string; [key: string]: unknown };

/**
 * GraphqlProvider — functional handler.
 *
 * Executes GraphQL operations against configured endpoint instances.
 * Uses perform() for actual network I/O.
 */
export const graphqlProviderHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = complete(createProgram(), 'ok', { name: 'GraphqlProvider',
      kind: 'protocol',
      capabilities: JSON.stringify(['query', 'mutation', 'subscription']) });
    return p as StorageProgram<Result>;
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
    p = complete(p, 'ok', { endpoint: endpointId });
    return p as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const endpoint = input.endpoint as string;
    const query = input.query as string;
    const variables = input.variables as string || '{}';
    const operationType = input.operationType as string || 'query';

    let p = createProgram();
    p = get(p, 'endpoints', `gql-${endpoint}`, 'endpointConfig');
    return branch(p, 'endpointConfig',
      (thenP) => {
        let p2 = perform(thenP, 'graphql', operationType, {
          endpoint, query, variables,
        }, 'gqlResponse');
        return complete(p2, 'ok', { data: '' });
      },
      (elseP) => complete(elseP, 'notFound', { message: `endpoint not found: ${endpoint}` }),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'endpoints', {}, 'allEndpoints');
    p = complete(p, 'ok', { endpoints: '[]' });
    return p as StorageProgram<Result>;
  },
};
