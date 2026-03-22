// @clef-handler style=functional
// VercelKVProvider Concept Implementation — Functional Style
// Provisions Vercel KV (Upstash Redis) stores via the Vercel API.
// Uses perform("http", ...) for all Vercel API calls, routing through
// the execution layer: ExternalCall → HttpProvider → vercel-api endpoint.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, pure, perform,
  type StorageProgram,
  complete,
} from '../../../runtime/storage-program.ts';

const RELATION = 'vercel-kv';

export const vercelKVProviderHandler: FunctionalConceptHandler = {
  provision(input: Record<string, unknown>) {
    const storeName = input.storeName as string;
    const conceptName = (input.conceptName as string) || '';
    const projectId = (input.projectId as string) || '';
    const kvName = (storeName || '').replace(/[^a-z0-9-]/g, '-').slice(0, 32);

    let p = createProgram();

    // Create KV store via Vercel Storage API
    p = perform(p, 'http', 'POST', {
      endpoint: 'vercel-api',
      path: '/v1/storage/stores',
      body: JSON.stringify({ name: kvName, type: 'kv' }),
    }, 'createResponse');

    // Link KV store to project if projectId provided
    if (projectId) {
      p = perform(p, 'http', 'POST', {
        endpoint: 'vercel-api',
        path: `/v1/storage/stores/${kvName}/connections`,
        body: JSON.stringify({ projectId, type: 'kv' }),
      }, 'linkResponse');
    }

    const storeId = `kv_${kvName}`;
    p = put(p, RELATION, storeName, {
      storeName,
      storeId,
      conceptName,
      credentials: '{}',
      status: 'provisioned',
      provisionedAt: new Date().toISOString(),
    });

    p = complete(p, 'ok', { storeName,
      storeId,
      credentials: '{}' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getCredentials(input: Record<string, unknown>) {
    const storeName = (input.storeName as string) || (input.store as string);

    let p = createProgram();
    p = get(p, RELATION, storeName, 'storeData');
    p = complete(p, 'ok', { storeName,
      credentials: '{}' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  destroy(input: Record<string, unknown>) {
    const storeName = (input.storeName as string) || (input.store as string);

    let p = createProgram();
    p = get(p, RELATION, storeName, 'storeData');

    // Delete via Vercel API
    p = perform(p, 'http', 'DELETE', {
      endpoint: 'vercel-api',
      path: `/v1/storage/stores/${storeName}`,
      body: '',
    }, 'deleteResponse');

    p = del(p, RELATION, storeName);
    p = complete(p, 'ok', { storeName });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
