// ============================================================
// ThemeDependenceProvider Handler Tests
//
// Tests for the .theme file dependence analysis provider:
// registration, idempotent initialization, handled languages,
// and plugin-registry integration.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  themeDependenceProviderHandler,
  resetThemeDependenceProviderCounter,
} from '../handlers/ts/theme-dependence-provider.handler.js';

describe('ThemeDependenceProvider Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetThemeDependenceProviderCounter();
  });

  describe('initialize', () => {
    it('registers the provider and returns ok with an instance ID', async () => {
      const result = await themeDependenceProviderHandler.initialize({}, storage);

      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('theme-dependence-provider-1');
    });

    it('stores provider metadata with handledLanguages "theme"', async () => {
      const result = await themeDependenceProviderHandler.initialize({}, storage);
      const id = result.instance as string;

      const record = await storage.get('theme-dependence-provider', id);
      expect(record).not.toBeNull();
      expect(record!.providerRef).toBe('dependence-provider:theme');
      expect(record!.handledLanguages).toBe('theme');
    });

    it('registers in the plugin-registry with domain "theme"', async () => {
      const result = await themeDependenceProviderHandler.initialize({}, storage);
      const id = result.instance as string;

      const registryRecord = await storage.get('plugin-registry', `dependence-provider:${id}`);
      expect(registryRecord).not.toBeNull();
      expect(registryRecord!.pluginKind).toBe('dependence-provider');
      expect(registryRecord!.domain).toBe('theme');
      expect(registryRecord!.handledLanguages).toBe('theme');
      expect(registryRecord!.instanceId).toBe(id);
    });

    it('is idempotent: returns existing instance on second call', async () => {
      const first = await themeDependenceProviderHandler.initialize({}, storage);
      const second = await themeDependenceProviderHandler.initialize({}, storage);

      expect(second.variant).toBe('ok');
      expect(second.instance).toBe(first.instance);
    });

    it('does not create duplicate plugin-registry entries on repeated init', async () => {
      await themeDependenceProviderHandler.initialize({}, storage);
      await themeDependenceProviderHandler.initialize({}, storage);

      const registryEntries = await storage.find('plugin-registry', {
        pluginKind: 'dependence-provider',
        domain: 'theme',
      });
      expect(registryEntries.length).toBe(1);
    });
  });
});
