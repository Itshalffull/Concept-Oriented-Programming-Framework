// SwiftSdkTarget — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { swiftSdkTargetHandler } from './handler.js';
import type { SwiftSdkTargetStorage } from './types.js';

const createTestStorage = (): SwiftSdkTargetStorage => {
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

const createFailingStorage = (): SwiftSdkTargetStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = swiftSdkTargetHandler;

describe('SwiftSdkTarget handler', () => {
  describe('generate', () => {
    it('should generate a Swift SDK package from a JSON projection', async () => {
      const storage = createTestStorage();
      const projection = JSON.stringify({
        concept: 'user-profile',
        actions: ['create', 'get', 'delete'],
        fields: [
          { name: 'name', type: 'string' },
          { name: 'age', type: 'integer' },
        ],
      });
      const result = await handler.generate(
        { projection, config: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.package).toBe('UserProfileClient');
        expect(result.right.files.length).toBe(3);
        expect(result.right.files).toContain('Package.swift');
      }
    });

    it('should generate default actions when none specified', async () => {
      const storage = createTestStorage();
      const projection = JSON.stringify({ concept: 'todo' });
      const result = await handler.generate(
        { projection, config: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.package).toBe('TodoClient');
      }
    });

    it('should handle plain string projection as concept name', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { projection: 'my-concept', config: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.package).toBe('MyConceptClient');
      }
    });

    it('should store method metadata in storage', async () => {
      const storage = createTestStorage();
      const projection = JSON.stringify({
        concept: 'item',
        actions: ['create'],
        fields: [],
      });
      await handler.generate({ projection, config: '{}' }, storage)();
      const method = await storage.get('methods', 'ItemClient.create');
      expect(method).not.toBeNull();
      expect(method?.isAsync).toBe(true);
    });

    it('should store package metadata in storage', async () => {
      const storage = createTestStorage();
      const projection = JSON.stringify({ concept: 'widget', actions: ['get'], fields: [] });
      await handler.generate({ projection, config: '{}' }, storage)();
      const pkg = await storage.get('packages', 'WidgetClient');
      expect(pkg).not.toBeNull();
      expect(pkg?.typeName).toBe('Widget');
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.generate(
        { projection: JSON.stringify({ concept: 'test' }), config: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
