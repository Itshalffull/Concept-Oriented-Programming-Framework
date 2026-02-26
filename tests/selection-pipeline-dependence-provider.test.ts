// ============================================================
// SelectionPipelineDependenceProvider Handler Tests
//
// Tests for the COIF selection pipeline dependence analysis
// provider: registration, idempotent initialization, and
// plugin-registry integration.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  selectionPipelineDependenceProviderHandler,
  resetSelectionPipelineDependenceProviderCounter,
} from '../handlers/ts/selection-pipeline-dependence-provider.handler.js';

describe('SelectionPipelineDependenceProvider Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetSelectionPipelineDependenceProviderCounter();
  });

  describe('initialize', () => {
    it('registers the provider and returns ok with an instance ID', async () => {
      const result = await selectionPipelineDependenceProviderHandler.initialize({}, storage);

      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('selection-pipeline-dependence-provider-1');
    });

    it('stores provider metadata in its relation', async () => {
      const result = await selectionPipelineDependenceProviderHandler.initialize({}, storage);
      const id = result.instance as string;

      const record = await storage.get('selection-pipeline-dependence-provider', id);
      expect(record).not.toBeNull();
      expect(record!.providerRef).toBe('dependence-provider:selection-pipeline');
    });

    it('registers in the plugin-registry with domain "selection-pipeline"', async () => {
      const result = await selectionPipelineDependenceProviderHandler.initialize({}, storage);
      const id = result.instance as string;

      const registryRecord = await storage.get('plugin-registry', `dependence-provider:${id}`);
      expect(registryRecord).not.toBeNull();
      expect(registryRecord!.pluginKind).toBe('dependence-provider');
      expect(registryRecord!.domain).toBe('selection-pipeline');
      expect(registryRecord!.instanceId).toBe(id);
    });

    it('is idempotent: returns existing instance on second call', async () => {
      const first = await selectionPipelineDependenceProviderHandler.initialize({}, storage);
      const second = await selectionPipelineDependenceProviderHandler.initialize({}, storage);

      expect(second.variant).toBe('ok');
      expect(second.instance).toBe(first.instance);
    });

    it('does not create duplicate plugin-registry entries on repeated init', async () => {
      await selectionPipelineDependenceProviderHandler.initialize({}, storage);
      await selectionPipelineDependenceProviderHandler.initialize({}, storage);

      const registryEntries = await storage.find('plugin-registry', {
        pluginKind: 'dependence-provider',
        domain: 'selection-pipeline',
      });
      expect(registryEntries.length).toBe(1);
    });
  });
});
