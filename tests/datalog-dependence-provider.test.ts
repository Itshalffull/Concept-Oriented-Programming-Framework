// ============================================================
// DatalogDependenceProvider Handler Tests
//
// Tests for the Datalog dependence analysis provider:
// registration, idempotent initialization, and plugin-registry
// integration for declarative dependency extraction.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  datalogDependenceProviderHandler,
  resetDatalogDependenceProviderCounter,
} from '../handlers/ts/datalog-dependence-provider.handler.js';

describe('DatalogDependenceProvider Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetDatalogDependenceProviderCounter();
  });

  describe('initialize', () => {
    it('registers the provider and returns ok with an instance ID', async () => {
      const result = await datalogDependenceProviderHandler.initialize({}, storage);

      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('datalog-dependence-provider-1');
    });

    it('stores provider metadata in the datalog-dependence-provider relation', async () => {
      const result = await datalogDependenceProviderHandler.initialize({}, storage);
      const id = result.instance as string;

      const record = await storage.get('datalog-dependence-provider', id);
      expect(record).not.toBeNull();
      expect(record!.providerRef).toBe('dependence-provider:datalog');
    });

    it('registers in the plugin-registry with domain "datalog"', async () => {
      const result = await datalogDependenceProviderHandler.initialize({}, storage);
      const id = result.instance as string;

      const registryRecord = await storage.get('plugin-registry', `dependence-provider:${id}`);
      expect(registryRecord).not.toBeNull();
      expect(registryRecord!.pluginKind).toBe('dependence-provider');
      expect(registryRecord!.domain).toBe('datalog');
      expect(registryRecord!.instanceId).toBe(id);
    });

    it('is idempotent: returns existing instance on second call', async () => {
      const first = await datalogDependenceProviderHandler.initialize({}, storage);
      const second = await datalogDependenceProviderHandler.initialize({}, storage);

      expect(second.variant).toBe('ok');
      expect(second.instance).toBe(first.instance);
    });

    it('does not create duplicate plugin-registry entries on repeated init', async () => {
      await datalogDependenceProviderHandler.initialize({}, storage);
      await datalogDependenceProviderHandler.initialize({}, storage);

      const registryEntries = await storage.find('plugin-registry', {
        pluginKind: 'dependence-provider',
        domain: 'datalog',
      });
      expect(registryEntries.length).toBe(1);
    });
  });
});
