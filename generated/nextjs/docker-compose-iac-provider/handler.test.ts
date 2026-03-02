// DockerComposeIacProvider — handler.test.ts
// Unit tests for dockerComposeIacProvider handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { dockerComposeIacProviderHandler } from './handler.js';
import type { DockerComposeIacProviderStorage } from './types.js';

const createTestStorage = (): DockerComposeIacProviderStorage => {
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

const createFailingStorage = (): DockerComposeIacProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('DockerComposeIacProvider handler', () => {
  describe('generate', () => {
    it('should generate a compose file from a plan', async () => {
      const storage = createTestStorage();
      const result = await dockerComposeIacProviderHandler.generate(
        { plan: 'my-app' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.composeFile).toContain('docker-compose-');
          expect(result.right.files.length).toBeGreaterThan(0);
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dockerComposeIacProviderHandler.generate(
        { plan: 'my-app' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('preview', () => {
    it('should preview create/update/delete counts', async () => {
      const storage = createTestStorage();
      await dockerComposeIacProviderHandler.generate({ plan: 'my-app' }, storage)();
      const genResult = await dockerComposeIacProviderHandler.generate({ plan: 'my-app' }, storage)();
      if (E.isRight(genResult) && genResult.right.variant === 'ok') {
        const result = await dockerComposeIacProviderHandler.preview(
          { composeFile: genResult.right.composeFile },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
          if (result.right.variant === 'ok') {
            expect(typeof result.right.toCreate).toBe('number');
            expect(typeof result.right.toUpdate).toBe('number');
            expect(typeof result.right.toDelete).toBe('number');
          }
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dockerComposeIacProviderHandler.preview(
        { composeFile: 'docker-compose-test.yml' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('apply', () => {
    it('should apply a compose file and create services', async () => {
      const storage = createTestStorage();
      const genResult = await dockerComposeIacProviderHandler.generate({ plan: 'my-app' }, storage)();
      if (E.isRight(genResult) && genResult.right.variant === 'ok') {
        const result = await dockerComposeIacProviderHandler.apply(
          { composeFile: genResult.right.composeFile },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
          if (result.right.variant === 'ok') {
            expect(result.right.composeFile).toBe(genResult.right.composeFile);
            expect(result.right.created.length).toBeGreaterThan(0);
          }
        }
      }
    });

    it('should return left when compose file is not generated', async () => {
      const storage = createTestStorage();
      const result = await dockerComposeIacProviderHandler.apply(
        { composeFile: 'nonexistent.yml' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dockerComposeIacProviderHandler.apply(
        { composeFile: 'docker-compose-test.yml' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('teardown', () => {
    it('should tear down applied services', async () => {
      const storage = createTestStorage();
      const genResult = await dockerComposeIacProviderHandler.generate({ plan: 'my-app' }, storage)();
      if (E.isRight(genResult) && genResult.right.variant === 'ok') {
        await dockerComposeIacProviderHandler.apply({ composeFile: genResult.right.composeFile }, storage)();
        const result = await dockerComposeIacProviderHandler.teardown(
          { composeFile: genResult.right.composeFile },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dockerComposeIacProviderHandler.teardown(
        { composeFile: 'docker-compose-test.yml' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
