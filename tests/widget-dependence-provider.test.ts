// ============================================================
// WidgetDependenceProvider Handler Tests
//
// Tests for the .widget file dependence analysis provider:
// registration, idempotent initialization, handled languages,
// and plugin-registry integration.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  widgetDependenceProviderHandler,
  resetWidgetDependenceProviderCounter,
} from '../handlers/ts/widget-dependence-provider.handler.js';

describe('WidgetDependenceProvider Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetWidgetDependenceProviderCounter();
  });

  describe('initialize', () => {
    it('registers the provider and returns ok with an instance ID', async () => {
      const result = await widgetDependenceProviderHandler.initialize({}, storage);

      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('widget-dependence-provider-1');
    });

    it('stores provider metadata with handledLanguages "widget"', async () => {
      const result = await widgetDependenceProviderHandler.initialize({}, storage);
      const id = result.instance as string;

      const record = await storage.get('widget-dependence-provider', id);
      expect(record).not.toBeNull();
      expect(record!.providerRef).toBe('dependence-provider:widget');
      expect(record!.handledLanguages).toBe('widget');
    });

    it('registers in the plugin-registry with domain "widget"', async () => {
      const result = await widgetDependenceProviderHandler.initialize({}, storage);
      const id = result.instance as string;

      const registryRecord = await storage.get('plugin-registry', `dependence-provider:${id}`);
      expect(registryRecord).not.toBeNull();
      expect(registryRecord!.pluginKind).toBe('dependence-provider');
      expect(registryRecord!.domain).toBe('widget');
      expect(registryRecord!.handledLanguages).toBe('widget');
      expect(registryRecord!.instanceId).toBe(id);
    });

    it('is idempotent: returns existing instance on second call', async () => {
      const first = await widgetDependenceProviderHandler.initialize({}, storage);
      const second = await widgetDependenceProviderHandler.initialize({}, storage);

      expect(second.variant).toBe('ok');
      expect(second.instance).toBe(first.instance);
    });

    it('does not create duplicate plugin-registry entries on repeated init', async () => {
      await widgetDependenceProviderHandler.initialize({}, storage);
      await widgetDependenceProviderHandler.initialize({}, storage);

      const registryEntries = await storage.find('plugin-registry', {
        pluginKind: 'dependence-provider',
        domain: 'widget',
      });
      expect(registryEntries.length).toBe(1);
    });
  });
});
