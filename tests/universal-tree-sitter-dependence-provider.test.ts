// ============================================================
// UniversalTreeSitterDependenceProvider Handler Tests
//
// Tests for the fallback Tree-sitter dependence analysis
// provider: registration, idempotent initialization, fallback
// flag, and plugin-registry integration.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  universalTreeSitterDependenceProviderHandler,
  resetUniversalTreeSitterDependenceProviderCounter,
} from '../handlers/ts/universal-tree-sitter-dependence-provider.handler.js';

describe('UniversalTreeSitterDependenceProvider Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetUniversalTreeSitterDependenceProviderCounter();
  });

  describe('initialize', () => {
    it('registers the provider and returns ok with an instance ID', async () => {
      const result = await universalTreeSitterDependenceProviderHandler.initialize({}, storage);

      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('universal-tree-sitter-dependence-provider-1');
    });

    it('stores provider metadata in its relation', async () => {
      const result = await universalTreeSitterDependenceProviderHandler.initialize({}, storage);
      const id = result.instance as string;

      const record = await storage.get('universal-tree-sitter-dependence-provider', id);
      expect(record).not.toBeNull();
      expect(record!.providerRef).toBe('dependence-provider:universal-tree-sitter');
    });

    it('registers in the plugin-registry with domain "universal" and fallback flag', async () => {
      const result = await universalTreeSitterDependenceProviderHandler.initialize({}, storage);
      const id = result.instance as string;

      const registryRecord = await storage.get('plugin-registry', `dependence-provider:${id}`);
      expect(registryRecord).not.toBeNull();
      expect(registryRecord!.pluginKind).toBe('dependence-provider');
      expect(registryRecord!.domain).toBe('universal');
      expect(registryRecord!.fallback).toBe(true);
      expect(registryRecord!.instanceId).toBe(id);
    });

    it('is idempotent: returns existing instance on second call', async () => {
      const first = await universalTreeSitterDependenceProviderHandler.initialize({}, storage);
      const second = await universalTreeSitterDependenceProviderHandler.initialize({}, storage);

      expect(second.variant).toBe('ok');
      expect(second.instance).toBe(first.instance);
    });

    it('does not create duplicate plugin-registry entries on repeated init', async () => {
      await universalTreeSitterDependenceProviderHandler.initialize({}, storage);
      await universalTreeSitterDependenceProviderHandler.initialize({}, storage);

      const registryEntries = await storage.find('plugin-registry', {
        pluginKind: 'dependence-provider',
        domain: 'universal',
      });
      expect(registryEntries.length).toBe(1);
    });

    it('can coexist with other dependence providers in the plugin-registry', async () => {
      await universalTreeSitterDependenceProviderHandler.initialize({}, storage);

      // Simulate another provider being registered
      await storage.put('plugin-registry', 'dependence-provider:other-1', {
        id: 'dependence-provider:other-1',
        pluginKind: 'dependence-provider',
        domain: 'typescript',
        instanceId: 'other-1',
      });

      const allProviders = await storage.find('plugin-registry', {
        pluginKind: 'dependence-provider',
      });
      expect(allProviders.length).toBe(2);

      // The universal provider should be identifiable by fallback flag
      const fallbackProviders = allProviders.filter((p) => p.fallback === true);
      expect(fallbackProviders.length).toBe(1);
      expect(fallbackProviders[0].domain).toBe('universal');
    });
  });
});
