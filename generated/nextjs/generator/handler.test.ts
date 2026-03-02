// Generator — handler.test.ts
// Unit tests for generator handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { generatorHandler } from './handler.js';
import type { GeneratorStorage } from './types.js';

const createTestStorage = (): GeneratorStorage => {
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

const createFailingStorage = (): GeneratorStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Generator handler', () => {
  describe('plan', () => {
    it('should create a generation plan from a manifest', async () => {
      const storage = createTestStorage();
      const manifest = JSON.stringify({
        targets: ['nextjs', 'react-native'],
        concepts: ['auth', 'user', 'role'],
      });
      const result = await generatorHandler.plan(
        { kit: 'identity', interfaceManifest: manifest },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.targets).toEqual(['nextjs', 'react-native']);
          expect(result.right.concepts).toEqual(['auth', 'user', 'role']);
          expect(result.right.estimatedFiles).toBe(6);
        }
      }
    });

    it('should return noTargetsConfigured when no targets', async () => {
      const storage = createTestStorage();
      const manifest = JSON.stringify({ targets: [], concepts: ['auth'] });
      const result = await generatorHandler.plan(
        { kit: 'empty-kit', interfaceManifest: manifest },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noTargetsConfigured');
      }
    });

    it('should handle invalid JSON manifest gracefully', async () => {
      const storage = createTestStorage();
      const result = await generatorHandler.plan(
        { kit: 'bad-kit', interfaceManifest: 'not-json' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noTargetsConfigured');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await generatorHandler.plan(
        { kit: 'k', interfaceManifest: JSON.stringify({ targets: ['t'], concepts: ['c'] }) },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('generate', () => {
    it('should execute a plan and return file counts', async () => {
      const storage = createTestStorage();
      const manifest = JSON.stringify({
        targets: ['nextjs'],
        concepts: ['auth', 'user'],
      });
      const planResult = await generatorHandler.plan(
        { kit: 'identity', interfaceManifest: manifest },
        storage,
      )();
      if (E.isRight(planResult) && planResult.right.variant === 'ok') {
        const result = await generatorHandler.generate(
          { plan: planResult.right.plan },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
          if (result.right.variant === 'ok') {
            expect(result.right.filesGenerated).toBe(2);
          }
        }
      }
    });

    it('should handle missing plan gracefully', async () => {
      const storage = createTestStorage();
      const result = await generatorHandler.generate(
        { plan: 'plan::nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.filesGenerated).toBe(0);
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await generatorHandler.generate(
        { plan: 'plan::x' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('regenerate', () => {
    it('should regenerate specific targets', async () => {
      const storage = createTestStorage();
      const manifest = JSON.stringify({
        targets: ['nextjs', 'react-native'],
        concepts: ['auth', 'user'],
      });
      const planResult = await generatorHandler.plan(
        { kit: 'identity', interfaceManifest: manifest },
        storage,
      )();
      if (E.isRight(planResult) && planResult.right.variant === 'ok') {
        const result = await generatorHandler.regenerate(
          { plan: planResult.right.plan, targets: ['nextjs'] },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
          expect(result.right.filesRegenerated).toBe(2);
        }
      }
    });

    it('should handle missing plan gracefully', async () => {
      const storage = createTestStorage();
      const result = await generatorHandler.regenerate(
        { plan: 'missing', targets: ['nextjs'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.filesRegenerated).toBe(0);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await generatorHandler.regenerate(
        { plan: 'p', targets: ['t'] },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
