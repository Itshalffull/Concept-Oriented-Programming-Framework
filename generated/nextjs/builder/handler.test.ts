// Builder — handler.test.ts
// Unit tests for builder handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { builderHandler } from './handler.js';
import type { BuilderStorage } from './types.js';

// In-memory test storage
const createTestStorage = (): BuilderStorage => {
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

// Failing storage for error propagation tests
const createFailingStorage = (): BuilderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Builder handler', () => {
  describe('build', () => {
    it('should return ok when toolchain exists', async () => {
      const storage = createTestStorage();
      await storage.put('toolchains', 'typescript', { language: 'typescript' });

      const result = await builderHandler.build(
        {
          concept: 'test-concept',
          source: 'source-code',
          language: 'typescript',
          platform: 'node',
          config: { mode: 'release', features: O.none },
        },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.build).toBeTruthy();
          expect(result.right.artifactHash).toBeTruthy();
          expect(result.right.artifactLocation).toContain('test-concept');
        }
      }
    });

    it('should return toolchainError when toolchain is not registered', async () => {
      const storage = createTestStorage();

      const result = await builderHandler.build(
        {
          concept: 'test-concept',
          source: 'source-code',
          language: 'brainfuck',
          platform: 'node',
          config: { mode: 'release', features: O.none },
        },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('toolchainError');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await builderHandler.build(
        {
          concept: 'test-concept',
          source: 'source-code',
          language: 'typescript',
          platform: 'node',
          config: { mode: 'release', features: O.none },
        },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('buildAll', () => {
    it('should return ok when all toolchains exist', async () => {
      const storage = createTestStorage();
      await storage.put('toolchains', 'typescript', { language: 'typescript' });

      const result = await builderHandler.buildAll(
        {
          concepts: ['concept-a'],
          source: 'source-code',
          targets: [{ language: 'typescript', platform: 'node' }],
          config: { mode: 'release', features: O.none },
        },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return partial when some toolchains are missing', async () => {
      const storage = createTestStorage();
      await storage.put('toolchains', 'typescript', { language: 'typescript' });

      const result = await builderHandler.buildAll(
        {
          concepts: ['concept-a'],
          source: 'source-code',
          targets: [
            { language: 'typescript', platform: 'node' },
            { language: 'unknown', platform: 'node' },
          ],
          config: { mode: 'release', features: O.none },
        },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('partial');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await builderHandler.buildAll(
        {
          concepts: ['concept-a'],
          source: 'source-code',
          targets: [{ language: 'typescript', platform: 'node' }],
          config: { mode: 'release', features: O.none },
        },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('test', () => {
    it('should return notBuilt when no builds exist', async () => {
      const storage = createTestStorage();

      const result = await builderHandler.test(
        {
          concept: 'test-concept',
          language: 'typescript',
          platform: 'node',
          testFilter: O.none,
          testType: O.none,
          toolName: O.none,
        },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notBuilt');
      }
    });

    it('should return runnerNotFound when no test runner is registered', async () => {
      const storage = createTestStorage();
      await storage.put('builds', 'build-1', {
        concept: 'test-concept',
        language: 'typescript',
      });

      const result = await builderHandler.test(
        {
          concept: 'test-concept',
          language: 'typescript',
          platform: 'node',
          testFilter: O.none,
          testType: O.some('unit'),
          toolName: O.none,
        },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('runnerNotFound');
      }
    });

    it('should return ok when build and runner exist', async () => {
      const storage = createTestStorage();
      await storage.put('builds', 'build-1', {
        concept: 'test-concept',
        language: 'typescript',
      });
      await storage.put('test-runners', 'typescript:unit', { runner: 'vitest' });

      const result = await builderHandler.test(
        {
          concept: 'test-concept',
          language: 'typescript',
          platform: 'node',
          testFilter: O.none,
          testType: O.some('unit'),
          toolName: O.none,
        },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await builderHandler.test(
        {
          concept: 'test-concept',
          language: 'typescript',
          platform: 'node',
          testFilter: O.none,
          testType: O.none,
          toolName: O.none,
        },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('status', () => {
    it('should return ok with not_found status when build does not exist', async () => {
      const storage = createTestStorage();

      const result = await builderHandler.status(
        { build: 'nonexistent' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.status).toBe('not_found');
      }
    });

    it('should return ok with build status when build exists', async () => {
      const storage = createTestStorage();
      await storage.put('builds', 'build-1', {
        status: 'completed',
        duration: 42,
      });

      const result = await builderHandler.status(
        { build: 'build-1' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.status).toBe('completed');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await builderHandler.status(
        { build: 'build-1' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('history', () => {
    it('should return ok with empty builds when none exist', async () => {
      const storage = createTestStorage();

      const result = await builderHandler.history(
        { concept: 'test-concept', language: O.none },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.builds).toHaveLength(0);
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await builderHandler.history(
        { concept: 'test-concept', language: O.none },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });
});
