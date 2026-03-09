// StorageProvider Concept Implementation
// Abstract storage provisioning coordinator. Discovers provider-specific
// handlers (VercelKV, DynamoDB, etc.) via the plugin-registry pattern,
// then delegates provisioning to the matching provider.
// This handler manages the registry of provisioned stores and their credentials.

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

const RELATION = 'storage-provider';
const PLUGIN_KIND = 'storage-provider';

export const storageProviderHandler: ConceptHandler = {
  async provision(input: Record<string, unknown>, storage: ConceptStorage) {
    const storeName = input.storeName as string;
    const storageType = input.storageType as string;
    const conceptName = input.conceptName as string || '';
    const config = input.config as string || '{}';

    if (!storeName || !storageType) {
      return { variant: 'provisionFailed', store: storeName, reason: 'storeName and storageType are required' };
    }

    // Check if already provisioned
    const existing = await storage.get(RELATION, storeName);
    if (existing && existing.status === 'provisioned') {
      return {
        variant: 'alreadyProvisioned',
        store: storeName,
        credentials: existing.credentials as string || '{}',
      };
    }

    // Record the provision request. Routing syncs fire on this completion
    // and dispatch to the correct provider (e.g., RouteStorageToVercelKV
    // invokes VercelKVProvider/provision when storageType is "vercel-kv").
    await storage.put(RELATION, storeName, {
      storeName,
      storageType,
      conceptName,
      config,
      status: 'provisioning',
      credentials: '{}',
      provisionedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      store: storeName,
      storageType,
      credentials: '{}',
    };
  },

  async updateCredentials(input: Record<string, unknown>, storage: ConceptStorage) {
    const storeName = input.storeName as string || input.store as string;
    const credentials = input.credentials as string;

    const existing = await storage.get(RELATION, storeName);
    if (!existing) {
      return { variant: 'notfound', store: storeName };
    }

    await storage.put(RELATION, storeName, {
      ...existing,
      credentials,
      status: 'provisioned',
    });

    return { variant: 'ok', store: storeName, credentials };
  },

  async configure(input: Record<string, unknown>, storage: ConceptStorage) {
    const storeName = input.store as string;
    const settings = input.settings as string;

    const existing = await storage.get(RELATION, storeName);
    if (!existing) {
      return { variant: 'notfound', store: storeName };
    }

    const currentConfig = JSON.parse(existing.config as string || '{}');
    const newSettings = JSON.parse(settings);
    const merged = { ...currentConfig, ...newSettings };

    await storage.put(RELATION, storeName, {
      ...existing,
      config: JSON.stringify(merged),
    });

    return { variant: 'ok', store: storeName };
  },

  async getCredentials(input: Record<string, unknown>, storage: ConceptStorage) {
    const storeName = input.store as string;

    const existing = await storage.get(RELATION, storeName);
    if (!existing) {
      return { variant: 'notfound', store: storeName };
    }

    return {
      variant: 'ok',
      store: storeName,
      credentials: existing.credentials as string || '{}',
    };
  },

  async destroy(input: Record<string, unknown>, storage: ConceptStorage) {
    const storeName = input.store as string;

    const existing = await storage.get(RELATION, storeName);
    if (!existing) {
      return { variant: 'notfound', store: storeName };
    }

    await storage.del(RELATION, storeName);
    return { variant: 'ok', store: storeName };
  },
};
