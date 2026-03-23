// @clef-handler style=functional concept=GitHubApiEndpoint
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const name = input.name as string;
    const token = input.token as string;
    const repository = input.repository as string;

    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    const endpointId = `gh-${name}`;

    let p = createProgram();
    p = put(p, 'endpoints', endpointId, {
      name,
      token,
      repository,
      baseUrl: 'https://api.github.com',
    });
    return complete(p, 'ok', { endpoint: endpointId, name, token, repository }) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const name = input.name as string;

    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'endpoints', `gh-${name}`, 'endpointData');
    return branch(p, 'endpointData',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const data = bindings.endpointData as Record<string, unknown>;
        return {
          endpoint: `gh-${name}`,
          baseUrl: data.baseUrl as string || 'https://api.github.com',
          repository: data.repository as string || '',
          headers: JSON.stringify({
            Authorization: `token <resolved-at-runtime>`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          }),
        };
      }),
      (b) => complete(b, 'error', { message: `endpoint not found: ${name}` }),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'endpoints', {}, 'allEndpoints');
    return completeFrom(p, 'ok', (bindings) => {
      const endpoints = bindings.allEndpoints as Array<Record<string, unknown>>;
      return { endpoints: JSON.stringify(endpoints.map(e => ({ name: e.name, endpoint: `gh-${e.name}` }))) };
    }) as StorageProgram<Result>;
  },
};

export const githubApiEndpointHandler = autoInterpret(_handler);
