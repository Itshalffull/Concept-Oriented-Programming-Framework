// ConceptBrowser — handler.test.ts
// Unit tests for concept browser search, preview, install, update, remove, list, listInstalled.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { conceptBrowserHandler } from './handler.js';
import type { ConceptBrowserStorage } from './types.js';

const createTestStorage = (): ConceptBrowserStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation, filter?) => {
      const all = [...(store.get(relation)?.values() ?? [])];
      if (!filter) return all;
      return all.filter((record) =>
        Object.entries(filter).every(([k, v]) => record[k] === v),
      );
    },
  };
};

const createFailingStorage = (): ConceptBrowserStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ConceptBrowser handler', () => {
  describe('search', () => {
    it('returns ok with empty results for empty registry', async () => {
      const storage = createTestStorage();
      const result = await conceptBrowserHandler.search(
        { query: 'auth' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).results).toEqual([]);
      }
    });

    it('returns registry_unreachable for disabled registry', async () => {
      const storage = createTestStorage();
      await storage.put('registry', 'reg-1', {
        id: 'reg-1',
        name: 'private',
        url: 'https://private.registry',
        enabled: false,
      });

      const result = await conceptBrowserHandler.search(
        { query: 'auth', registry: 'private' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('registry_unreachable');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await conceptBrowserHandler.search(
        { query: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('preview', () => {
    it('returns not_found for unknown package', async () => {
      const storage = createTestStorage();
      const result = await conceptBrowserHandler.preview(
        { package_name: 'nonexistent', version: '1.0.0' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('not_found');
      }
    });

    it('returns ok for existing package', async () => {
      const storage = createTestStorage();
      await storage.put('package', 'pkg-1', {
        id: 'pkg-1',
        name: 'auth-suite',
        version: '1.0.0',
        status: 'available',
      });

      const result = await conceptBrowserHandler.preview(
        { package_name: 'auth-suite', version: '1.0.0' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('install', () => {
    it('installs a new package with ok variant', async () => {
      const storage = createTestStorage();
      const result = await conceptBrowserHandler.install(
        { package_name: 'auth-suite', version: '1.0.0' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).installed).toBeDefined();
      }
    });

    it('returns already_installed for duplicate install', async () => {
      const storage = createTestStorage();
      await conceptBrowserHandler.install(
        { package_name: 'auth-suite', version: '1.0.0' },
        storage,
      )();
      const result = await conceptBrowserHandler.install(
        { package_name: 'auth-suite', version: '1.0.0' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('already_installed');
      }
    });
  });

  describe('update', () => {
    it('updates an installed package with ok variant', async () => {
      const storage = createTestStorage();
      await conceptBrowserHandler.install(
        { package_name: 'auth-suite', version: '1.0.0' },
        storage,
      )();

      const result = await conceptBrowserHandler.update(
        { package_name: 'auth-suite', target_version: '2.0.0' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns not_installed for uninstalled package', async () => {
      const storage = createTestStorage();
      const result = await conceptBrowserHandler.update(
        { package_name: 'unknown', target_version: '2.0.0' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('not_installed');
      }
    });
  });

  describe('remove', () => {
    it('removes an installed package with ok variant', async () => {
      const storage = createTestStorage();
      await conceptBrowserHandler.install(
        { package_name: 'auth-suite', version: '1.0.0' },
        storage,
      )();

      const result = await conceptBrowserHandler.remove(
        { package_name: 'auth-suite' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns ok for non-installed package', async () => {
      const storage = createTestStorage();
      const result = await conceptBrowserHandler.remove(
        { package_name: 'unknown' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('list', () => {
    it('lists all packages with ok variant', async () => {
      const storage = createTestStorage();
      const result = await conceptBrowserHandler.list({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await conceptBrowserHandler.list({}, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('listInstalled', () => {
    it('lists only installed packages', async () => {
      const storage = createTestStorage();
      await conceptBrowserHandler.install(
        { package_name: 'auth-suite', version: '1.0.0' },
        storage,
      )();

      const result = await conceptBrowserHandler.listInstalled({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).packages.length).toBe(1);
      }
    });

    it('returns empty list when nothing installed', async () => {
      const storage = createTestStorage();
      const result = await conceptBrowserHandler.listInstalled({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect((result.right as any).packages.length).toBe(0);
      }
    });
  });

  describe('multi-step sequence: install -> update -> listInstalled -> remove', () => {
    it('completes full package lifecycle', async () => {
      const storage = createTestStorage();

      const installResult = await conceptBrowserHandler.install(
        { package_name: 'task-suite', version: '1.0.0' },
        storage,
      )();
      expect(E.isRight(installResult)).toBe(true);

      const updateResult = await conceptBrowserHandler.update(
        { package_name: 'task-suite', target_version: '1.1.0' },
        storage,
      )();
      expect(E.isRight(updateResult)).toBe(true);

      const listResult = await conceptBrowserHandler.listInstalled({}, storage)();
      expect(E.isRight(listResult)).toBe(true);
      if (E.isRight(listResult)) {
        expect((listResult.right as any).packages.length).toBe(1);
      }

      const removeResult = await conceptBrowserHandler.remove(
        { package_name: 'task-suite' },
        storage,
      )();
      expect(E.isRight(removeResult)).toBe(true);
    });
  });

  describe('storage failure', () => {
    it('propagates storage errors on install', async () => {
      const storage = createFailingStorage();
      const result = await conceptBrowserHandler.install(
        { package_name: 'test', version: '1.0.0' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
