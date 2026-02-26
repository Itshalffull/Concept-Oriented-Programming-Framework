// ============================================================
// DatalogAnalysisProvider Handler Tests
//
// Tests for the Datalog analysis engine provider: registration,
// idempotent initialization, and plugin-registry integration.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  datalogAnalysisProviderHandler,
  resetDatalogAnalysisProviderCounter,
} from '../handlers/ts/datalog-analysis-provider.handler.js';

describe('DatalogAnalysisProvider Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetDatalogAnalysisProviderCounter();
  });

  describe('initialize', () => {
    it('registers the provider and returns ok with an instance ID', async () => {
      const result = await datalogAnalysisProviderHandler.initialize({}, storage);

      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('datalog-analysis-provider-1');
    });

    it('stores provider metadata in the datalog-analysis-provider relation', async () => {
      const result = await datalogAnalysisProviderHandler.initialize({}, storage);
      const id = result.instance as string;

      const record = await storage.get('datalog-analysis-provider', id);
      expect(record).not.toBeNull();
      expect(record!.providerRef).toBe('analysis-engine:datalog');
      expect(record!.engineType).toBe('datalog');
    });

    it('registers in the plugin-registry for discovery', async () => {
      const result = await datalogAnalysisProviderHandler.initialize({}, storage);
      const id = result.instance as string;

      const registryRecord = await storage.get('plugin-registry', `analysis-engine:${id}`);
      expect(registryRecord).not.toBeNull();
      expect(registryRecord!.pluginKind).toBe('analysis-engine');
      expect(registryRecord!.engineType).toBe('datalog');
      expect(registryRecord!.instanceId).toBe(id);
    });

    it('is idempotent: returns existing instance on second call', async () => {
      const first = await datalogAnalysisProviderHandler.initialize({}, storage);
      const second = await datalogAnalysisProviderHandler.initialize({}, storage);

      expect(second.variant).toBe('ok');
      expect(second.instance).toBe(first.instance);
    });

    it('does not create duplicate plugin-registry entries on repeated init', async () => {
      await datalogAnalysisProviderHandler.initialize({}, storage);
      await datalogAnalysisProviderHandler.initialize({}, storage);

      const registryEntries = await storage.find('plugin-registry', {
        pluginKind: 'analysis-engine',
        engineType: 'datalog',
      });
      expect(registryEntries.length).toBe(1);
    });
  });
});
