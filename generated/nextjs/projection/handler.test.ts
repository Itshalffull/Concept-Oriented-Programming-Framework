// Projection — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { projectionHandler } from './handler.js';
import type { ProjectionStorage } from './types.js';

const createTestStorage = (): ProjectionStorage => {
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

const createFailingStorage = (): ProjectionStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = projectionHandler;

describe('Projection handler', () => {
  describe('project', () => {
    it('should return annotationError for invalid manifest JSON', async () => {
      const storage = createTestStorage();
      const result = await handler.project(
        { manifest: 'not-json', annotations: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('annotationError');
      }
    });

    it('should return annotationError for invalid annotations JSON', async () => {
      const storage = createTestStorage();
      const result = await handler.project(
        { manifest: JSON.stringify({ name: 'test' }), annotations: 'bad' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('annotationError');
      }
    });

    it('should project a valid manifest with counts', async () => {
      const storage = createTestStorage();
      const manifest = {
        name: 'article',
        state: { title: 'string', body: 'string' },
        actions: { create: {}, update: {} },
        traits: [],
      };
      const result = await handler.project(
        { manifest: JSON.stringify(manifest), annotations: JSON.stringify({}) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.projection).toBe('proj_article');
          expect(result.right.shapes).toBe(2);
          expect(result.right.actions).toBe(2);
          expect(result.right.traits).toBe(0);
        }
      }
    });

    it('should detect unresolved references', async () => {
      const storage = createTestStorage();
      const manifest = {
        name: 'widget',
        references: ['missing-concept'],
        state: {},
        actions: {},
      };
      const result = await handler.project(
        { manifest: JSON.stringify(manifest), annotations: JSON.stringify({}) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unresolvedReference');
        if (result.right.variant === 'unresolvedReference') {
          expect(result.right.missing).toContain('missing-concept');
        }
      }
    });

    it('should detect trait conflicts', async () => {
      const storage = createTestStorage();
      const manifest = {
        name: 'dup',
        state: {},
        actions: {},
        traits: [{ name: 'cacheable' }, { name: 'cacheable' }],
      };
      const result = await handler.project(
        { manifest: JSON.stringify(manifest), annotations: JSON.stringify({}) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('traitConflict');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const manifest = { name: 'test', state: {}, actions: {} };
      const result = await handler.project(
        { manifest: JSON.stringify(manifest), annotations: JSON.stringify({}) },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('validate', () => {
    it('should return incompleteAnnotation when projection not found', async () => {
      const storage = createTestStorage();
      const result = await handler.validate(
        { projection: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('incompleteAnnotation');
      }
    });

    it('should validate a stored projection with warnings for no shapes', async () => {
      const storage = createTestStorage();
      await storage.put('projection', 'proj_empty', {
        id: 'proj_empty',
        manifest: JSON.stringify({ name: 'empty', actions: {} }),
        annotations: JSON.stringify({}),
        shapes: 0,
        actions: 0,
        traits: 0,
      });

      const result = await handler.validate({ projection: 'proj_empty' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.warnings).toContain('Projection has no shapes');
        }
      }
    });
  });

  describe('diff', () => {
    it('should return incompatible when projections not found', async () => {
      const storage = createTestStorage();
      const result = await handler.diff(
        { projection: 'a', previous: 'b' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('incompatible');
      }
    });

    it('should diff two stored projections', async () => {
      const storage = createTestStorage();
      await storage.put('projection', 'v1', {
        manifest: JSON.stringify({ name: 'test', foo: 1 }),
      });
      await storage.put('projection', 'v2', {
        manifest: JSON.stringify({ name: 'test', foo: 2, bar: 3 }),
      });

      const result = await handler.diff(
        { projection: 'v2', previous: 'v1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.added).toContain('bar');
          expect(result.right.changed).toContain('foo');
        }
      }
    });
  });

  describe('inferResources', () => {
    it('should return empty resources when projection not found', async () => {
      const storage = createTestStorage();
      const result = await handler.inferResources(
        { projection: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.resources).toEqual([]);
      }
    });

    it('should infer database_table and api_endpoint from manifest with state and actions', async () => {
      const storage = createTestStorage();
      await storage.put('projection', 'proj_x', {
        manifest: JSON.stringify({
          state: { title: 'string' },
          actions: { create: {} },
        }),
      });

      const result = await handler.inferResources({ projection: 'proj_x' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.resources).toContain('database_table');
        expect(result.right.resources).toContain('api_endpoint');
      }
    });
  });
});
