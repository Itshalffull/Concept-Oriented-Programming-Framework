// Component — handler.test.ts
// Unit tests for component handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { componentHandler } from './handler.js';
import type { ComponentStorage } from './types.js';

const handler = componentHandler;

const createTestStorage = (): ComponentStorage => {
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

const createFailingStorage = (): ComponentStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Component handler', () => {
  describe('register', () => {
    it('should register a new component', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        { component: 'btn-primary', config: '{"color":"blue"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return exists when component is already registered', async () => {
      const storage = createTestStorage();
      await handler.register(
        { component: 'btn-primary', config: '{}' },
        storage,
      )();
      const result = await handler.register(
        { component: 'btn-primary', config: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.register(
        { component: 'btn-primary', config: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('render', () => {
    it('should render a registered component', async () => {
      const storage = createTestStorage();
      await handler.register(
        { component: 'btn-primary', config: '{"color":"blue"}' },
        storage,
      )();
      const result = await handler.render(
        { component: 'btn-primary', context: '{"page":"home"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const output = JSON.parse(result.right.output);
          expect(output.rendered).toBe(true);
        }
      }
    });

    it('should return notfound when component does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.render(
        { component: 'nonexistent', context: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.render(
        { component: 'btn-primary', context: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('place', () => {
    it('should place a registered component in a region', async () => {
      const storage = createTestStorage();
      await handler.register(
        { component: 'btn-primary', config: '{}' },
        storage,
      )();
      const result = await handler.place(
        { component: 'btn-primary', region: 'sidebar' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when component does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.place(
        { component: 'nonexistent', region: 'sidebar' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.place(
        { component: 'btn-primary', region: 'sidebar' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('setVisibility', () => {
    it('should set visibility on a registered component', async () => {
      const storage = createTestStorage();
      await handler.register(
        { component: 'btn-primary', config: '{}' },
        storage,
      )();
      const result = await handler.setVisibility(
        { component: 'btn-primary', visible: false },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when component does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.setVisibility(
        { component: 'nonexistent', visible: true },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.setVisibility(
        { component: 'btn-primary', visible: true },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('evaluateVisibility', () => {
    it('should evaluate visibility for a registered component', async () => {
      const storage = createTestStorage();
      await handler.register(
        { component: 'btn-primary', config: '{}' },
        storage,
      )();
      const result = await handler.evaluateVisibility(
        { component: 'btn-primary', context: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(typeof result.right.visible).toBe('boolean');
        }
      }
    });

    it('should return false when visibility is set to false', async () => {
      const storage = createTestStorage();
      await handler.register(
        { component: 'btn-primary', config: '{}' },
        storage,
      )();
      await handler.setVisibility(
        { component: 'btn-primary', visible: false },
        storage,
      )();
      const result = await handler.evaluateVisibility(
        { component: 'btn-primary', context: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.visible).toBe(false);
      }
    });

    it('should return notfound when component does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.evaluateVisibility(
        { component: 'nonexistent', context: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.evaluateVisibility(
        { component: 'btn-primary', context: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
