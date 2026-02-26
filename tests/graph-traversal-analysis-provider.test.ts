// ============================================================
// GraphTraversalAnalysisProvider Handler Tests
//
// Tests for the graph-traversal analysis engine provider:
// registration, idempotent initialization, and plugin-registry
// integration.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  graphTraversalAnalysisProviderHandler,
  resetGraphTraversalAnalysisProviderCounter,
} from '../handlers/ts/graph-traversal-analysis-provider.handler.js';

describe('GraphTraversalAnalysisProvider Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetGraphTraversalAnalysisProviderCounter();
  });

  describe('initialize', () => {
    it('registers the provider and returns ok with an instance ID', async () => {
      const result = await graphTraversalAnalysisProviderHandler.initialize({}, storage);

      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('graph-traversal-analysis-provider-1');
    });

    it('stores provider metadata in the provider relation', async () => {
      const result = await graphTraversalAnalysisProviderHandler.initialize({}, storage);
      const id = result.instance as string;

      const record = await storage.get('graph-traversal-analysis-provider', id);
      expect(record).not.toBeNull();
      expect(record!.providerRef).toBe('analysis-engine:graph-traversal');
      expect(record!.engineType).toBe('graph-traversal');
    });

    it('registers in the plugin-registry for discovery', async () => {
      const result = await graphTraversalAnalysisProviderHandler.initialize({}, storage);
      const id = result.instance as string;

      const registryRecord = await storage.get('plugin-registry', `analysis-engine:${id}`);
      expect(registryRecord).not.toBeNull();
      expect(registryRecord!.pluginKind).toBe('analysis-engine');
      expect(registryRecord!.engineType).toBe('graph-traversal');
      expect(registryRecord!.instanceId).toBe(id);
    });

    it('is idempotent: returns existing instance on second call', async () => {
      const first = await graphTraversalAnalysisProviderHandler.initialize({}, storage);
      const second = await graphTraversalAnalysisProviderHandler.initialize({}, storage);

      expect(second.variant).toBe('ok');
      expect(second.instance).toBe(first.instance);
    });

    it('does not create duplicate plugin-registry entries on repeated init', async () => {
      await graphTraversalAnalysisProviderHandler.initialize({}, storage);
      await graphTraversalAnalysisProviderHandler.initialize({}, storage);

      const registryEntries = await storage.find('plugin-registry', {
        pluginKind: 'analysis-engine',
        engineType: 'graph-traversal',
      });
      expect(registryEntries.length).toBe(1);
    });
  });
});
