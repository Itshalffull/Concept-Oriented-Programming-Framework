// ============================================================
// BindingDependenceProvider Handler Tests
//
// Tests for the binding dependence analysis provider:
// registration, idempotent initialization, and plugin-registry
// integration for runtime data binding chains.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  bindingDependenceProviderHandler,
  resetBindingDependenceProviderCounter,
} from '../handlers/ts/binding-dependence-provider.handler.js';

describe('BindingDependenceProvider Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetBindingDependenceProviderCounter();
  });

  describe('initialize', () => {
    it('registers the provider and returns ok with an instance ID', async () => {
      const result = await bindingDependenceProviderHandler.initialize({}, storage);

      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('binding-dependence-provider-1');
    });

    it('stores provider metadata in the binding-dependence-provider relation', async () => {
      const result = await bindingDependenceProviderHandler.initialize({}, storage);
      const id = result.instance as string;

      const record = await storage.get('binding-dependence-provider', id);
      expect(record).not.toBeNull();
      expect(record!.providerRef).toBe('dependence-provider:binding');
    });

    it('registers in the plugin-registry with domain "binding"', async () => {
      const result = await bindingDependenceProviderHandler.initialize({}, storage);
      const id = result.instance as string;

      const registryRecord = await storage.get('plugin-registry', `dependence-provider:${id}`);
      expect(registryRecord).not.toBeNull();
      expect(registryRecord!.pluginKind).toBe('dependence-provider');
      expect(registryRecord!.domain).toBe('binding');
      expect(registryRecord!.instanceId).toBe(id);
    });

    it('is idempotent: returns existing instance on second call', async () => {
      const first = await bindingDependenceProviderHandler.initialize({}, storage);
      const second = await bindingDependenceProviderHandler.initialize({}, storage);

      expect(second.variant).toBe('ok');
      expect(second.instance).toBe(first.instance);
    });

    it('does not create duplicate plugin-registry entries on repeated init', async () => {
      await bindingDependenceProviderHandler.initialize({}, storage);
      await bindingDependenceProviderHandler.initialize({}, storage);

      const registryEntries = await storage.find('plugin-registry', {
        pluginKind: 'dependence-provider',
        domain: 'binding',
      });
      expect(registryEntries.length).toBe(1);
    });
  });
});
