import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, pure,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';

/**
 * GitHubApiEndpoint — functional handler.
 *
 * Configures and resolves the GitHub API endpoint for status checks
 * and commit statuses. Pure state management — no I/O.
 */
export const githubApiEndpointHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const name = (input.name as string) || 'github-api';
    const token = input.token as string;
    const repository = input.repository as string;

    const endpointId = `gh-${name}`;

    let p = createProgram();
    p = put(p, 'endpoints', endpointId, {
      name,
      token,
      repository,
      baseUrl: 'https://api.github.com',
    });
    p = pure(p, {
      variant: 'ok',
      endpoint: endpointId,
      name,
      token,
      repository,
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolve(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = get(p, 'endpoints', `gh-${name}`, 'endpointData');
    p = pure(p, {
      variant: 'ok',
      endpoint: `gh-${name}`,
      baseUrl: 'https://api.github.com',
      repository: '',
      headers: JSON.stringify({
        'Authorization': 'token <resolved-at-runtime>',
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
      }),
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
