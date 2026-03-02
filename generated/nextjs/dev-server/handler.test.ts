// DevServer — handler.test.ts
// Unit tests for devServer handler actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { devServerHandler } from './handler.js';
import type { DevServerStorage } from './types.js';

const createTestStorage = (): DevServerStorage => {
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

const createFailingStorage = (): DevServerStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('DevServer handler', () => {
  describe('start', () => {
    it('returns ok with session and url for available port', async () => {
      const storage = createTestStorage();
      const result = await devServerHandler.start(
        { port: 3000, watchDirs: ['src'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.port).toBe(3000);
          expect(result.right.url).toBe('http://localhost:3000');
          expect(result.right.session).toBeTruthy();
        }
      }
    });

    it('returns portInUse when port is already taken', async () => {
      const storage = createTestStorage();
      await devServerHandler.start({ port: 3000, watchDirs: ['src'] }, storage)();
      const result = await devServerHandler.start(
        { port: 3000, watchDirs: ['src'] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('portInUse');
        if (result.right.variant === 'portInUse') {
          expect(result.right.port).toBe(3000);
        }
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await devServerHandler.start(
        { port: 3000, watchDirs: ['src'] },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('stop', () => {
    it('returns ok when session exists', async () => {
      const storage = createTestStorage();
      const startResult = await devServerHandler.start(
        { port: 4000, watchDirs: ['src'] },
        storage,
      )();
      expect(E.isRight(startResult)).toBe(true);
      if (E.isRight(startResult) && startResult.right.variant === 'ok') {
        const result = await devServerHandler.stop(
          { session: startResult.right.session },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
        }
      }
    });

    it('returns left when session does not exist', async () => {
      const storage = createTestStorage();
      const result = await devServerHandler.stop(
        { session: 'nonexistent' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await devServerHandler.stop(
        { session: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('status', () => {
    it('returns running when session is active', async () => {
      const storage = createTestStorage();
      const startResult = await devServerHandler.start(
        { port: 5000, watchDirs: ['src'] },
        storage,
      )();
      expect(E.isRight(startResult)).toBe(true);
      if (E.isRight(startResult) && startResult.right.variant === 'ok') {
        const result = await devServerHandler.status(
          { session: startResult.right.session },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('running');
          if (result.right.variant === 'running') {
            expect(result.right.port).toBe(5000);
          }
        }
      }
    });

    it('returns stopped when session does not exist', async () => {
      const storage = createTestStorage();
      const result = await devServerHandler.status(
        { session: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('stopped');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await devServerHandler.status(
        { session: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
