// DisplayMode — handler.test.ts
// Unit tests for displayMode handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { displayModeHandler } from './handler.js';
import type { DisplayModeStorage } from './types.js';

const createTestStorage = (): DisplayModeStorage => {
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

const createFailingStorage = (): DisplayModeStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('DisplayMode handler', () => {
  describe('defineMode', () => {
    it('should define a new mode and return ok', async () => {
      const storage = createTestStorage();
      const result = await displayModeHandler.defineMode(
        { mode: 'test-id-1', name: 'Full' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.mode).toBe('test-id-1');
        }
      }
    });

    it('should return exists when mode name is already registered', async () => {
      const storage = createTestStorage();
      await displayModeHandler.defineMode({ mode: 'test-id-1', name: 'Full' }, storage)();
      const result = await displayModeHandler.defineMode(
        { mode: 'test-id-2', name: 'Full' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await displayModeHandler.defineMode(
        { mode: 'test-id-1', name: 'Full' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('configureFieldDisplay', () => {
    it('should configure field display on an existing mode', async () => {
      const storage = createTestStorage();
      await displayModeHandler.defineMode({ mode: 'test-id-1', name: 'Full' }, storage)();
      const result = await displayModeHandler.configureFieldDisplay(
        { mode: 'test-id-1', field: 'title', config: 'bold' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.mode).toBe('test-id-1');
        }
      }
    });

    it('should return notfound for nonexistent mode', async () => {
      const storage = createTestStorage();
      const result = await displayModeHandler.configureFieldDisplay(
        { mode: 'missing', field: 'title', config: 'bold' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await displayModeHandler.configureFieldDisplay(
        { mode: 'test-id-1', field: 'title', config: 'bold' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('configureFieldForm', () => {
    it('should configure field form on an existing mode', async () => {
      const storage = createTestStorage();
      await displayModeHandler.defineMode({ mode: 'test-id-1', name: 'Edit' }, storage)();
      const result = await displayModeHandler.configureFieldForm(
        { mode: 'test-id-1', field: 'body', config: 'textarea' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.mode).toBe('test-id-1');
        }
      }
    });

    it('should return notfound for nonexistent mode', async () => {
      const storage = createTestStorage();
      const result = await displayModeHandler.configureFieldForm(
        { mode: 'missing', field: 'body', config: 'textarea' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await displayModeHandler.configureFieldForm(
        { mode: 'test-id-1', field: 'body', config: 'textarea' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('renderInMode', () => {
    it('should render an entity in a defined mode', async () => {
      const storage = createTestStorage();
      await displayModeHandler.defineMode({ mode: 'test-id-1', name: 'Teaser' }, storage)();
      await displayModeHandler.configureFieldDisplay(
        { mode: 'test-id-1', field: 'title', config: 'bold' },
        storage,
      )();
      // Seed the entity
      await storage.put('entities', 'entity-1', { title: 'Hello', body: 'World' });
      const result = await displayModeHandler.renderInMode(
        { mode: 'test-id-1', entity: 'entity-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const parsed = JSON.parse(result.right.output);
          expect(parsed.title).toBe('**Hello**');
          expect(parsed._mode).toBe('Teaser');
          expect(parsed._entity).toBe('entity-1');
        }
      }
    });

    it('should return notfound for nonexistent mode', async () => {
      const storage = createTestStorage();
      const result = await displayModeHandler.renderInMode(
        { mode: 'missing', entity: 'entity-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await displayModeHandler.renderInMode(
        { mode: 'test-id-1', entity: 'entity-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
