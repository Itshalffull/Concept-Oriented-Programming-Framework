// PluginRegistry — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { pluginRegistryHandler } from './handler.js';
import type { PluginRegistryStorage } from './types.js';

const createTestStorage = (): PluginRegistryStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation) => [...(store.get(relation)?.values() ?? [])],
  };
};

const createFailingStorage = (): PluginRegistryStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('PluginRegistry handler', () => {
  describe('register', () => {
    it('should register a new plugin', async () => {
      const storage = createTestStorage();

      const result = await pluginRegistryHandler.register(
        { type: 'formatter', name: 'prettier', metadata: '{"version":"3.0"}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.plugin).toContain('plugin_');
        }
      }
    });

    it('should return exists for duplicate plugin registration', async () => {
      const storage = createTestStorage();
      await pluginRegistryHandler.register(
        { type: 'linter', name: 'eslint', metadata: '{}' },
        storage,
      )();

      const result = await pluginRegistryHandler.register(
        { type: 'linter', name: 'eslint', metadata: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should also register the plugin type', async () => {
      const storage = createTestStorage();

      await pluginRegistryHandler.register(
        { type: 'bundler', name: 'webpack', metadata: '{}' },
        storage,
      )();

      const typeRecord = await storage.get('pluginTypes', 'bundler');
      expect(typeRecord).not.toBeNull();
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await pluginRegistryHandler.register(
        { type: 'x', name: 'y', metadata: '{}' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('discover', () => {
    it('should return enabled plugins of a given type', async () => {
      const storage = createTestStorage();
      await pluginRegistryHandler.register(
        { type: 'theme', name: 'dark', metadata: '{}' },
        storage,
      )();
      await pluginRegistryHandler.register(
        { type: 'theme', name: 'light', metadata: '{}' },
        storage,
      )();

      const result = await pluginRegistryHandler.discover(
        { type: 'theme' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const plugins = JSON.parse(result.right.plugins);
        expect(plugins.length).toBe(2);
      }
    });

    it('should return empty array for unknown type', async () => {
      const storage = createTestStorage();

      const result = await pluginRegistryHandler.discover(
        { type: 'nonexistent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const plugins = JSON.parse(result.right.plugins);
        expect(plugins.length).toBe(0);
      }
    });
  });

  describe('createInstance', () => {
    it('should create an instance of a registered plugin', async () => {
      const storage = createTestStorage();
      const reg = await pluginRegistryHandler.register(
        { type: 'cache', name: 'redis', metadata: '{"port":6379}' },
        storage,
      )();

      expect(E.isRight(reg)).toBe(true);
      if (E.isRight(reg) && reg.right.variant === 'ok') {
        const result = await pluginRegistryHandler.createInstance(
          { plugin: 'cache::redis', config: '{"host":"localhost"}' },
          storage,
        )();

        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
          if (result.right.variant === 'ok') {
            expect(result.right.instance).toContain('inst_');
          }
        }
      }
    });

    it('should return notfound for unregistered plugin', async () => {
      const storage = createTestStorage();

      const result = await pluginRegistryHandler.createInstance(
        { plugin: 'doesnt-exist', config: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('getDefinitions', () => {
    it('should return all definitions for a type', async () => {
      const storage = createTestStorage();
      await pluginRegistryHandler.register(
        { type: 'db', name: 'postgres', metadata: '{}' },
        storage,
      )();

      const result = await pluginRegistryHandler.getDefinitions(
        { type: 'db' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const defs = JSON.parse(result.right.definitions);
        expect(defs.length).toBeGreaterThan(0);
      }
    });
  });

  describe('alterDefinitions', () => {
    it('should apply alterations to definitions of a type', async () => {
      const storage = createTestStorage();
      await pluginRegistryHandler.register(
        { type: 'api', name: 'rest', metadata: '{"version":1}' },
        storage,
      )();

      const result = await pluginRegistryHandler.alterDefinitions(
        { type: 'api', alterations: '{"version":2}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('derivePlugins', () => {
    it('should derive a new plugin from an existing one', async () => {
      const storage = createTestStorage();
      await pluginRegistryHandler.register(
        { type: 'logger', name: 'console', metadata: '{"level":"info"}' },
        storage,
      )();

      const result = await pluginRegistryHandler.derivePlugins(
        { plugin: 'logger::console', config: '{"level":"debug"}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.derived).toContain('derived_');
        }
      }
    });

    it('should return notfound for nonexistent base plugin', async () => {
      const storage = createTestStorage();

      const result = await pluginRegistryHandler.derivePlugins(
        { plugin: 'missing::plugin', config: '{}' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
