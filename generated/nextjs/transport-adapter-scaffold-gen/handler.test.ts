// TransportAdapterScaffoldGen — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { transportAdapterScaffoldGenHandler } from './handler.js';
import type { TransportAdapterScaffoldGenStorage } from './types.js';

const createTestStorage = (): TransportAdapterScaffoldGenStorage => {
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

const createFailingStorage = (): TransportAdapterScaffoldGenStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = transportAdapterScaffoldGenHandler;

describe('TransportAdapterScaffoldGen handler', () => {
  describe('generate', () => {
    it('should generate scaffold files for an http transport', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { name: 'my-http', protocol: 'http' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.filesGenerated).toBe(3);
          expect(result.right.files.length).toBe(3);
        }
      }
    });

    it('should generate scaffold files for grpc protocol', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { name: 'my-grpc', protocol: 'grpc' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.filesGenerated).toBe(3);
        }
      }
    });

    it('should return error for empty transport name', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { name: '  ', protocol: 'http' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for empty protocol', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { name: 'my-transport', protocol: '  ' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.generate(
        { name: 'my-http', protocol: 'http' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
      }
    });
  });

  describe('preview', () => {
    it('should preview scaffold files without generating', async () => {
      const storage = createTestStorage();
      const result = await handler.preview(
        { name: 'my-ws', protocol: 'ws' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.wouldWrite).toBe(3);
          expect(result.right.wouldSkip).toBe(0);
        }
      }
    });

    it('should return cached when same scaffold already exists', async () => {
      const storage = createTestStorage();
      // First generate the scaffold
      await handler.generate({ name: 'my-ws', protocol: 'ws' }, storage)();
      // Then preview the same scaffold
      const result = await handler.preview(
        { name: 'my-ws', protocol: 'ws' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('cached');
      }
    });

    it('should return error for empty name', async () => {
      const storage = createTestStorage();
      const result = await handler.preview(
        { name: '  ', protocol: 'http' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.preview(
        { name: 'my-ws', protocol: 'ws' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('register', () => {
    it('should return registration metadata', async () => {
      const storage = createTestStorage();
      const result = await handler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('transport-adapter-scaffold-gen');
        expect(result.right.capabilities.length).toBeGreaterThan(0);
      }
    });
  });
});
