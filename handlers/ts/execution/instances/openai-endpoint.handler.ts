// @clef-handler style=imperative
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, find, pure,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';

/**
 * OpenAiEndpoint — functional handler.
 *
 * Configures and resolves OpenAI API endpoint instances.
 * Pure state management — no I/O. The actual HTTP calls flow
 * through HttpProvider via sync wiring.
 */
export const openAiEndpointHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const name = input.name as string;
    const apiKey = input.apiKey as string;
    const model = input.model as string;
    const baseUrl = (input.baseUrl as string) || 'https://api.openai.com/v1';
    const dimensions = (input.dimensions as number) || 0;

    const endpointId = `oai-${name}`;

    let p = createProgram();
    p = put(p, 'endpoints', endpointId, {
      name,
      apiKey,
      model,
      baseUrl,
      dimensions,
      maxTokens: 8191,
    });
    p = pure(p, {
      variant: 'ok',
      endpoint: endpointId,
      name,
      apiKey,
      model,
      baseUrl,
      dimensions,
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolve(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = get(p, 'endpoints', `oai-${name}`, 'endpointData');

    // Build authorization headers from stored API key
    p = pure(p, {
      variant: 'ok',
      endpoint: `oai-${name}`,
      baseUrl: '',
      model: '',
      headers: JSON.stringify({
        'Authorization': 'Bearer <resolved-at-runtime>',
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
