// @clef-handler style=functional concept=GitLabApiEndpoint
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
    const projectId = input.projectId as string;
    const baseUrl = (input.baseUrl as string) || 'https://gitlab.com/api/v4';

    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    const endpointId = `gl-${name}`;

    let p = createProgram();
    p = put(p, 'endpoints', endpointId, {
      name,
      token,
      projectId,
      baseUrl,
    });
    return complete(p, 'ok', { endpoint: endpointId, name, token, projectId }) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const name = input.name as string;

    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'endpoints', `gl-${name}`, 'endpointData');
    return branch(p, 'endpointData',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const data = bindings.endpointData as Record<string, unknown>;
        return {
          endpoint: `gl-${name}`,
          baseUrl: data.baseUrl as string || 'https://gitlab.com/api/v4',
          projectId: data.projectId as string || '',
          headers: JSON.stringify({
            'PRIVATE-TOKEN': '<resolved-at-runtime>',
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
      return { endpoints: JSON.stringify(endpoints.map(e => ({ name: e.name, endpoint: `gl-${e.name}` }))) };
    }) as StorageProgram<Result>;
  },
};

export const gitlabApiEndpointHandler = autoInterpret(_handler);
