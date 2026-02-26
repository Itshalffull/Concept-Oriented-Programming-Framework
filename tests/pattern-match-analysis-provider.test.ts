// ============================================================
// PatternMatchAnalysisProvider Handler Tests
//
// Tests for the pattern-match analysis engine provider:
// registration, idempotent initialization, and plugin-registry
// integration.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  patternMatchAnalysisProviderHandler,
  resetPatternMatchAnalysisProviderCounter,
} from '../implementations/typescript/pattern-match-analysis-provider.impl.js';

describe('PatternMatchAnalysisProvider Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetPatternMatchAnalysisProviderCounter();
  });

  describe('initialize', () => {
    it('registers the provider and returns ok with an instance ID', async () => {
      const result = await patternMatchAnalysisProviderHandler.initialize({}, storage);

      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('pattern-match-analysis-provider-1');
    });

    it('stores provider metadata in the provider relation', async () => {
      const result = await patternMatchAnalysisProviderHandler.initialize({}, storage);
      const id = result.instance as string;

      const record = await storage.get('pattern-match-analysis-provider', id);
      expect(record).not.toBeNull();
      expect(record!.providerRef).toBe('analysis-engine:pattern-match');
      expect(record!.engineType).toBe('pattern-match');
    });

    it('registers in the plugin-registry for discovery', async () => {
      const result = await patternMatchAnalysisProviderHandler.initialize({}, storage);
      const id = result.instance as string;

      const registryRecord = await storage.get('plugin-registry', `analysis-engine:${id}`);
      expect(registryRecord).not.toBeNull();
      expect(registryRecord!.pluginKind).toBe('analysis-engine');
      expect(registryRecord!.engineType).toBe('pattern-match');
      expect(registryRecord!.instanceId).toBe(id);
    });

    it('is idempotent: returns existing instance on second call', async () => {
      const first = await patternMatchAnalysisProviderHandler.initialize({}, storage);
      const second = await patternMatchAnalysisProviderHandler.initialize({}, storage);

      expect(second.variant).toBe('ok');
      expect(second.instance).toBe(first.instance);
    });

    it('does not create duplicate plugin-registry entries on repeated init', async () => {
      await patternMatchAnalysisProviderHandler.initialize({}, storage);
      await patternMatchAnalysisProviderHandler.initialize({}, storage);

      const registryEntries = await storage.find('plugin-registry', {
        pluginKind: 'analysis-engine',
        engineType: 'pattern-match',
      });
      expect(registryEntries.length).toBe(1);
    });
  });
});
