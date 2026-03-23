// @clef-handler style=functional
// VercelKVProvider Concept Implementation — Functional Style
// Provisions Vercel KV (Upstash Redis) stores via the Vercel API.
// Uses perform("http", ...) for all Vercel API calls, routing through
// the execution layer: ExternalCall → HttpProvider → vercel-api endpoint.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, pure, perform, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

const RELATION = 'vercel-kv';

export const vercelKVProviderHandler: FunctionalConceptHandler = {
  provision(input: Record<string, unknown>) {
    if (!input.storeName || (typeof input.storeName === 'string' && (input.storeName as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'storeName is required' }) as StorageProgram<Result>;
    }
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
    p = branch(p, 'storeData',
      (b) => complete(b, 'ok', { storeName, credentials: '{}' }),
      (b) => complete(b, 'notfound', { message: `Store "${storeName}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  destroy(input: Record<string, unknown>) {
    const storeName = (input.storeName as string) || (input.store as string);

    let p = createProgram();
    p = get(p, RELATION, storeName, 'storeData');
    p = branch(p, 'storeData',
      (b) => {
        // Delete via Vercel API
        let b2 = perform(b, 'http', 'DELETE', {
          endpoint: 'vercel-api',
          path: `/v1/storage/stores/${storeName}`,
          body: '',
        }, 'deleteResponse');
        b2 = del(b2, RELATION, storeName);
        return complete(b2, 'ok', { storeName });
      },
      (b) => complete(b, 'notfound', { message: `Store "${storeName}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
