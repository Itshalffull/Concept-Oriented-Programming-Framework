// ============================================================
// SyncDependenceProvider Handler Tests
//
// Tests for the .sync file dependence analysis provider:
// registration, idempotent initialization, handled languages,
// and plugin-registry integration.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  syncDependenceProviderHandler,
  resetSyncDependenceProviderCounter,
} from '../implementations/typescript/sync-dependence-provider.impl.js';

describe('SyncDependenceProvider Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetSyncDependenceProviderCounter();
  });

  describe('initialize', () => {
    it('registers the provider and returns ok with an instance ID', async () => {
      const result = await syncDependenceProviderHandler.initialize({}, storage);

      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('sync-dependence-provider-1');
    });

    it('stores provider metadata with handledLanguages "sync"', async () => {
      const result = await syncDependenceProviderHandler.initialize({}, storage);
      const id = result.instance as string;

      const record = await storage.get('sync-dependence-provider', id);
      expect(record).not.toBeNull();
      expect(record!.providerRef).toBe('dependence-provider:sync');
      expect(record!.handledLanguages).toBe('sync');
    });

    it('registers in the plugin-registry with domain "sync"', async () => {
      const result = await syncDependenceProviderHandler.initialize({}, storage);
      const id = result.instance as string;

      const registryRecord = await storage.get('plugin-registry', `dependence-provider:${id}`);
      expect(registryRecord).not.toBeNull();
      expect(registryRecord!.pluginKind).toBe('dependence-provider');
      expect(registryRecord!.domain).toBe('sync');
      expect(registryRecord!.handledLanguages).toBe('sync');
      expect(registryRecord!.instanceId).toBe(id);
    });

    it('is idempotent: returns existing instance on second call', async () => {
      const first = await syncDependenceProviderHandler.initialize({}, storage);
      const second = await syncDependenceProviderHandler.initialize({}, storage);

      expect(second.variant).toBe('ok');
      expect(second.instance).toBe(first.instance);
    });

    it('does not create duplicate plugin-registry entries on repeated init', async () => {
      await syncDependenceProviderHandler.initialize({}, storage);
      await syncDependenceProviderHandler.initialize({}, storage);

      const registryEntries = await storage.find('plugin-registry', {
        pluginKind: 'dependence-provider',
        domain: 'sync',
      });
      expect(registryEntries.length).toBe(1);
    });
  });
});
