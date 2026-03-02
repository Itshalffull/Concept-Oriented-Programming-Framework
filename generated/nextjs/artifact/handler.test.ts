// Artifact — handler.test.ts
// Unit tests for artifact handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { artifactHandler } from './handler.js';
import type { ArtifactStorage } from './types.js';

const createTestStorage = (): ArtifactStorage => {
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

const createFailingStorage = (): ArtifactStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Artifact handler', () => {
  describe('build', () => {
    it('builds successfully with valid input and no deps', async () => {
      const storage = createTestStorage();
      const result = await artifactHandler.build(
        { concept: 'user', spec: 'spec-content', implementation: 'impl-content', deps: [] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.artifact).toContain('user@');
          expect(result.right.hash).toBeTruthy();
          expect(result.right.sizeBytes).toBeGreaterThan(0);
        }
      }
    });

    it('returns compilationError for missing dependencies', async () => {
      const storage = createTestStorage();
      const result = await artifactHandler.build(
        { concept: 'user', spec: 'spec', implementation: 'impl', deps: ['missing-dep'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('compilationError');
        if (result.right.variant === 'compilationError') {
          expect(result.right.concept).toBe('user');
          expect(result.right.errors.length).toBeGreaterThan(0);
        }
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await artifactHandler.build(
        { concept: 'user', spec: 'spec', implementation: 'impl', deps: ['dep1'] },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('store', () => {
    it('stores successfully with valid input', async () => {
      const storage = createTestStorage();
      const result = await artifactHandler.store(
        {
          hash: 'abc12345',
          location: '/artifacts/abc12345',
          concept: 'user',
          language: 'typescript',
          platform: 'node',
          metadata: O.none,
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.artifact).toBe('abc12345');
        }
      }
    });

    it('returns alreadyExists when storing same hash twice', async () => {
      const storage = createTestStorage();
      await artifactHandler.store(
        {
          hash: 'abc12345',
          location: '/artifacts/abc12345',
          concept: 'user',
          language: 'typescript',
          platform: 'node',
          metadata: O.none,
        },
        storage,
      )();
      const result = await artifactHandler.store(
        {
          hash: 'abc12345',
          location: '/artifacts/abc12345-v2',
          concept: 'user',
          language: 'typescript',
          platform: 'node',
          metadata: O.none,
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('alreadyExists');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await artifactHandler.store(
        {
          hash: 'abc12345',
          location: '/artifacts/abc12345',
          concept: 'user',
          language: 'typescript',
          platform: 'node',
          metadata: O.none,
        },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('resolve', () => {
    it('returns notfound for missing artifact', async () => {
      const storage = createTestStorage();
      const result = await artifactHandler.resolve(
        { hash: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns artifact after store', async () => {
      const storage = createTestStorage();
      await artifactHandler.store(
        {
          hash: 'abc12345',
          location: '/artifacts/abc12345',
          concept: 'user',
          language: 'typescript',
          platform: 'node',
          metadata: O.none,
        },
        storage,
      )();
      const result = await artifactHandler.resolve(
        { hash: 'abc12345' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.location).toBe('/artifacts/abc12345');
        }
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await artifactHandler.resolve(
        { hash: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('gc', () => {
    it('produces ok with valid input when no artifacts exist', async () => {
      const storage = createTestStorage();
      const result = await artifactHandler.gc(
        { olderThan: new Date(), keepVersions: 1 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.removed).toBe(0);
        expect(result.right.freedBytes).toBe(0);
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await artifactHandler.gc(
        { olderThan: new Date(), keepVersions: 1 },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
