// VercelKVProvider Concept Implementation
// Provisions Vercel KV (Upstash Redis) stores via the Vercel API.
// Routed from StorageProvider/provision via the RouteStorageToVercelKV sync
// when storageType is "vercel-kv".

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

const RELATION = 'vercel-kv';

function getVercelToken(): string {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error('VERCEL_TOKEN environment variable is required');
  return token;
}

function getTeamId(): string | undefined {
  return process.env.VERCEL_TEAM_ID;
}

async function vercelApi(method: string, apiPath: string, body?: unknown): Promise<any> {
  const token = getVercelToken();
  const teamId = getTeamId();
  const url = new URL(`https://api.vercel.com${apiPath}`);
  if (teamId) url.searchParams.set('teamId', teamId);

  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`Vercel API ${method} ${apiPath}: ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

const PLUGIN_REF = 'storage-provider:vercel-kv';

export const vercelKVProviderHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    // Self-register with the plugin-registry so StorageProvider can discover us
    const existing = await storage.find('plugin-registry', { pluginKind: 'storage-provider', domain: 'vercel-kv' });
    if (existing.length > 0) {
      return { variant: 'ok', provider: PLUGIN_REF };
    }

    await storage.put('plugin-registry', PLUGIN_REF, {
      pluginKind: 'storage-provider',
      domain: 'vercel-kv',
      providerRef: PLUGIN_REF,
      instanceId: PLUGIN_REF,
    });

    return { variant: 'ok', provider: PLUGIN_REF };
  },

  async provision(input: Record<string, unknown>, storage: ConceptStorage) {
    const storeName = input.storeName as string;
    const conceptName = input.conceptName as string || '';
    const config = JSON.parse(input.config as string || '{}');
    const projectId = input.projectId as string || config.projectId;

    if (!storeName) {
      return { variant: 'provisionFailed', storeName, reason: 'storeName is required' };
    }

    try {
      // Check if store already exists
      const existing = await storage.get(RELATION, storeName);
      if (existing && existing.storeId) {
        return {
          variant: 'alreadyProvisioned',
          storeName,
          credentials: existing.credentials as string || '{}',
          storeId: existing.storeId as string,
        };
      }

      // Create a Vercel KV store via the Vercel Storage API
      const kvName = storeName.replace(/[^a-z0-9-]/g, '-').slice(0, 32);
      let storeData: any;

      try {
        storeData = await vercelApi('POST', '/v1/storage/stores', {
          name: kvName,
          type: 'kv',
        });
      } catch (createErr) {
        const errMsg = String(createErr);
        // If store already exists, try to find it
        if (errMsg.includes('409') || errMsg.includes('already')) {
          const stores = await vercelApi('GET', '/v1/storage/stores');
          const found = (stores.stores || []).find(
            (s: any) => s.name === kvName && s.type === 'kv',
          );
          if (found) {
            storeData = found;
          } else {
            throw createErr;
          }
        } else {
          throw createErr;
        }
      }

      const storeId = storeData.id || storeData.storeId;

      // Link KV store to project if projectId is provided
      if (projectId && storeId) {
        try {
          await vercelApi('POST', `/v1/storage/stores/${storeId}/connections`, {
            projectId,
            type: 'kv',
          });
        } catch (linkErr) {
          // Non-fatal — may already be linked
          const errMsg = String(linkErr);
          if (!errMsg.includes('409') && !errMsg.includes('already')) {
            console.error(`  Warning: Could not link KV store to project: ${linkErr}`);
          }
        }
      }

      // Build credentials from the store response
      const credentials = JSON.stringify({
        KV_REST_API_URL: storeData.restApiUrl || storeData.url || '',
        KV_REST_API_TOKEN: storeData.restApiToken || storeData.token || '',
        KV_REST_API_READ_ONLY_TOKEN: storeData.restApiReadOnlyToken || '',
        KV_URL: storeData.kvUrl || storeData.url || '',
      });

      await storage.put(RELATION, storeName, {
        storeName,
        storeId,
        conceptName,
        credentials,
        status: 'provisioned',
        provisionedAt: new Date().toISOString(),
      });

      return {
        variant: 'ok',
        storeName,
        storeId,
        credentials,
      };
    } catch (err) {
      return {
        variant: 'provisionFailed',
        storeName,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  },

  async getCredentials(input: Record<string, unknown>, storage: ConceptStorage) {
    const storeName = input.storeName as string || input.store as string;

    const existing = await storage.get(RELATION, storeName);
    if (!existing) {
      return { variant: 'notfound', storeName };
    }

    return {
      variant: 'ok',
      storeName,
      credentials: existing.credentials as string || '{}',
    };
  },

  async destroy(input: Record<string, unknown>, storage: ConceptStorage) {
    const storeName = input.storeName as string || input.store as string;

    const existing = await storage.get(RELATION, storeName);
    if (!existing) {
      return { variant: 'notfound', storeName };
    }

    try {
      const storeId = existing.storeId as string;
      if (storeId) {
        await vercelApi('DELETE', `/v1/storage/stores/${storeId}`);
      }
    } catch {
      // Store may already be deleted
    }

    await storage.del(RELATION, storeName);
    return { variant: 'ok', storeName };
  },
};
