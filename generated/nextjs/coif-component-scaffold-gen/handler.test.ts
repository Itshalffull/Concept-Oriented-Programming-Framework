// CoifComponentScaffoldGen — handler.test.ts
// Unit tests for coifComponentScaffoldGen handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { coifComponentScaffoldGenHandler } from './handler.js';
import type { CoifComponentScaffoldGenStorage } from './types.js';

const handler = coifComponentScaffoldGenHandler;

// In-memory test storage
const createTestStorage = (): CoifComponentScaffoldGenStorage => {
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
const createFailingStorage = (): CoifComponentScaffoldGenStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('CoifComponentScaffoldGen handler', () => {
  describe('generate', () => {
    it('should generate scaffold files for a valid component', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { name: 'test-widget', parts: ['header', 'body'], states: ['idle', 'active'], events: ['click'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.filesGenerated).toBeGreaterThan(0);
          expect(result.right.files.length).toBe(result.right.filesGenerated);
        }
      }
    });

    it('should return error variant for empty name', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { name: '  ', parts: [], states: [], events: [] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should include anatomy parts in generated files', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { name: 'my-component', parts: ['header', 'footer'], states: [], events: [] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const files = result.right.files as readonly Record<string, unknown>[];
        const partFiles = files.filter((f) => f['kind'] === 'anatomy-part');
        expect(partFiles.length).toBe(2);
      }
    });

    it('should include state machine file when states are provided', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { name: 'my-component', parts: [], states: ['idle', 'loading'], events: [] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const files = result.right.files as readonly Record<string, unknown>[];
        const machineFiles = files.filter((f) => f['kind'] === 'state-machine');
        expect(machineFiles.length).toBe(1);
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.generate(
        { name: 'test-widget', parts: [], states: [], events: [] },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('preview', () => {
    it('should preview files for a new component', async () => {
      const storage = createTestStorage();
      const result = await handler.preview(
        { name: 'new-widget', parts: ['slot'], states: [], events: [] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.wouldWrite).toBeGreaterThan(0);
          expect(result.right.wouldSkip).toBe(0);
        }
      }
    });

    it('should return cached when scaffold already generated with same files', async () => {
      const storage = createTestStorage();
      await handler.generate(
        { name: 'cached-widget', parts: ['slot'], states: [], events: [] },
        storage,
      )();
      const result = await handler.preview(
        { name: 'cached-widget', parts: ['slot'], states: [], events: [] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('cached');
      }
    });

    it('should return error variant for empty name', async () => {
      const storage = createTestStorage();
      const result = await handler.preview(
        { name: '', parts: [], states: [], events: [] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.preview(
        { name: 'test-widget', parts: [], states: [], events: [] },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('register', () => {
    it('should return ok with handler metadata', async () => {
      const storage = createTestStorage();
      const result = await handler.register({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.name).toBe('coif-component-scaffold-gen');
        expect(result.right.capabilities).toContain('generate');
        expect(result.right.capabilities).toContain('preview');
      }
    });
  });
});
