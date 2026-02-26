// ============================================================
// TypeScriptDependenceProvider Handler Tests
//
// Tests for the TypeScript/TSX dependence analysis provider:
// registration, idempotent initialization, handled languages,
// and plugin-registry integration.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  typeScriptDependenceProviderHandler,
  resetTypeScriptDependenceProviderCounter,
} from '../implementations/typescript/type-script-dependence-provider.impl.js';

describe('TypeScriptDependenceProvider Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetTypeScriptDependenceProviderCounter();
  });

  describe('initialize', () => {
    it('registers the provider and returns ok with an instance ID', async () => {
      const result = await typeScriptDependenceProviderHandler.initialize({}, storage);

      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('type-script-dependence-provider-1');
    });

    it('stores provider metadata with handledLanguages "typescript,tsx"', async () => {
      const result = await typeScriptDependenceProviderHandler.initialize({}, storage);
      const id = result.instance as string;

      const record = await storage.get('type-script-dependence-provider', id);
      expect(record).not.toBeNull();
      expect(record!.providerRef).toBe('dependence-provider:typescript');
      expect(record!.handledLanguages).toBe('typescript,tsx');
    });

    it('registers in the plugin-registry with domain "typescript"', async () => {
      const result = await typeScriptDependenceProviderHandler.initialize({}, storage);
      const id = result.instance as string;

      const registryRecord = await storage.get('plugin-registry', `dependence-provider:${id}`);
      expect(registryRecord).not.toBeNull();
      expect(registryRecord!.pluginKind).toBe('dependence-provider');
      expect(registryRecord!.domain).toBe('typescript');
      expect(registryRecord!.handledLanguages).toBe('typescript,tsx');
      expect(registryRecord!.instanceId).toBe(id);
    });

    it('is idempotent: returns existing instance on second call', async () => {
      const first = await typeScriptDependenceProviderHandler.initialize({}, storage);
      const second = await typeScriptDependenceProviderHandler.initialize({}, storage);

      expect(second.variant).toBe('ok');
      expect(second.instance).toBe(first.instance);
    });

    it('does not create duplicate plugin-registry entries on repeated init', async () => {
      await typeScriptDependenceProviderHandler.initialize({}, storage);
      await typeScriptDependenceProviderHandler.initialize({}, storage);

      const registryEntries = await storage.find('plugin-registry', {
        pluginKind: 'dependence-provider',
        domain: 'typescript',
      });
      expect(registryEntries.length).toBe(1);
    });
  });
});
