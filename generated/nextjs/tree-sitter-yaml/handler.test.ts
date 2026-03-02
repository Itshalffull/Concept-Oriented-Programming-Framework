// TreeSitterYaml — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { treeSitterYamlHandler } from './handler.js';
import type { TreeSitterYamlStorage } from './types.js';

const createTestStorage = (): TreeSitterYamlStorage => {
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

const createFailingStorage = (): TreeSitterYamlStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = treeSitterYamlHandler;

describe('TreeSitterYaml handler', () => {
  describe('initialize', () => {
    it('should initialize and return an instance id', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toContain('yaml-grammar-');
        }
      }
    });

    it('should persist grammar metadata with multi-document and anchor support', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const instanceId = result.right.instance;
        const grammar = await storage.get('grammars', instanceId);
        expect(grammar).not.toBeNull();
        expect(grammar?.language).toBe('yaml');
        expect(grammar?.supportsMultiDocument).toBe(true);
        expect(grammar?.supportsAnchors).toBe(true);
        expect(grammar?.supportsMergeKeys).toBe(true);
      }
    });

    it('should categorize scalar node types correctly', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const instanceId = result.right.instance;
        const plainScalar = await storage.get('node_types', `${instanceId}:plain_scalar`);
        expect(plainScalar).not.toBeNull();
        expect(plainScalar?.category).toBe('scalar');
        expect(plainScalar?.isScalar).toBe(true);
        expect(plainScalar?.isCollection).toBe(false);
      }
    });

    it('should categorize collection node types correctly', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const instanceId = result.right.instance;
        const mapping = await storage.get('node_types', `${instanceId}:block_mapping`);
        expect(mapping).not.toBeNull();
        expect(mapping?.category).toBe('collection');
        expect(mapping?.isCollection).toBe(true);
        expect(mapping?.isScalar).toBe(false);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
      }
    });
  });
});
