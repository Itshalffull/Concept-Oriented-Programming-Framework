// ============================================================
// ConceptDependenceProvider Handler Tests
//
// Tests for the .concept file dependence analysis provider:
// registration, idempotent initialization, handled languages,
// and plugin-registry integration.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  conceptDependenceProviderHandler,
  resetConceptDependenceProviderCounter,
} from '../implementations/typescript/concept-dependence-provider.impl.js';

describe('ConceptDependenceProvider Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetConceptDependenceProviderCounter();
  });

  describe('initialize', () => {
    it('registers the provider and returns ok with an instance ID', async () => {
      const result = await conceptDependenceProviderHandler.initialize({}, storage);

      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('concept-dependence-provider-1');
    });

    it('stores provider metadata with handledLanguages', async () => {
      const result = await conceptDependenceProviderHandler.initialize({}, storage);
      const id = result.instance as string;

      const record = await storage.get('concept-dependence-provider', id);
      expect(record).not.toBeNull();
      expect(record!.providerRef).toBe('dependence-provider:concept');
      expect(record!.handledLanguages).toBe('concept');
    });

    it('registers in the plugin-registry with domain "concept"', async () => {
      const result = await conceptDependenceProviderHandler.initialize({}, storage);
      const id = result.instance as string;

      const registryRecord = await storage.get('plugin-registry', `dependence-provider:${id}`);
      expect(registryRecord).not.toBeNull();
      expect(registryRecord!.pluginKind).toBe('dependence-provider');
      expect(registryRecord!.domain).toBe('concept');
      expect(registryRecord!.handledLanguages).toBe('concept');
      expect(registryRecord!.instanceId).toBe(id);
    });

    it('is idempotent: returns existing instance on second call', async () => {
      const first = await conceptDependenceProviderHandler.initialize({}, storage);
      const second = await conceptDependenceProviderHandler.initialize({}, storage);

      expect(second.variant).toBe('ok');
      expect(second.instance).toBe(first.instance);
    });

    it('does not create duplicate plugin-registry entries on repeated init', async () => {
      await conceptDependenceProviderHandler.initialize({}, storage);
      await conceptDependenceProviderHandler.initialize({}, storage);

      const registryEntries = await storage.find('plugin-registry', {
        pluginKind: 'dependence-provider',
        domain: 'concept',
      });
      expect(registryEntries.length).toBe(1);
    });
  });
});
