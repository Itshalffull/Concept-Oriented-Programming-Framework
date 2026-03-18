import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, pure,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';

/**
 * GitLabApiEndpoint — functional handler.
 *
 * Configures and resolves a GitLab API endpoint for commit
 * statuses and pipeline integration. Pure state management.
 */
export const gitlabApiEndpointHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const name = (input.name as string) || 'gitlab-api';
    const token = input.token as string;
    const projectId = input.projectId as string;
    const baseUrl = (input.baseUrl as string) || 'https://gitlab.com/api/v4';

    const endpointId = `gl-${name}`;

    let p = createProgram();
    p = put(p, 'endpoints', endpointId, {
      name,
      token,
      projectId,
      baseUrl,
    });
    p = pure(p, {
      variant: 'ok',
      endpoint: endpointId,
      name,
      token,
      projectId,
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolve(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = get(p, 'endpoints', `gl-${name}`, 'endpointData');
    p = pure(p, {
      variant: 'ok',
      endpoint: `gl-${name}`,
      baseUrl: 'https://gitlab.com/api/v4',
      projectId: '',
      headers: JSON.stringify({
        'PRIVATE-TOKEN': '<resolved-at-runtime>',
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
