// Element — handler.test.ts
// Unit tests for element handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { elementHandler } from './handler.js';
import type { ElementStorage } from './types.js';

const createTestStorage = (): ElementStorage => {
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

const createFailingStorage = (): ElementStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Element handler', () => {
  describe('create', () => {
    it('should create a valid element', async () => {
      const storage = createTestStorage();
      const result = await elementHandler.create(
        { element: 'test-id-1', kind: 'text', label: 'Title', dataType: 'string' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.element).toBe('test-id-1');
        }
      }
    });

    it('should return invalid for unknown kind', async () => {
      const storage = createTestStorage();
      const result = await elementHandler.create(
        { element: 'test-id-1', kind: 'unknown-kind', label: 'Title', dataType: 'string' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid for unknown dataType', async () => {
      const storage = createTestStorage();
      const result = await elementHandler.create(
        { element: 'test-id-1', kind: 'text', label: 'Title', dataType: 'invalid-type' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid for empty label', async () => {
      const storage = createTestStorage();
      const result = await elementHandler.create(
        { element: 'test-id-1', kind: 'text', label: '   ', dataType: 'string' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return left on storage failure for valid input', async () => {
      const storage = createFailingStorage();
      const result = await elementHandler.create(
        { element: 'test-id-1', kind: 'text', label: 'Title', dataType: 'string' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('nest', () => {
    it('should nest a child under a parent', async () => {
      const storage = createTestStorage();
      await elementHandler.create({ element: 'parent', kind: 'container', label: 'Parent', dataType: 'object' }, storage)();
      await elementHandler.create({ element: 'child', kind: 'text', label: 'Child', dataType: 'string' }, storage)();
      const result = await elementHandler.nest(
        { parent: 'parent', child: 'child' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.parent).toBe('parent');
        }
      }
    });

    it('should return invalid when parent does not exist', async () => {
      const storage = createTestStorage();
      await elementHandler.create({ element: 'child', kind: 'text', label: 'Child', dataType: 'string' }, storage)();
      const result = await elementHandler.nest(
        { parent: 'missing', child: 'child' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid when nesting element into itself', async () => {
      const storage = createTestStorage();
      await elementHandler.create({ element: 'el', kind: 'container', label: 'El', dataType: 'object' }, storage)();
      const result = await elementHandler.nest(
        { parent: 'el', child: 'el' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await elementHandler.nest(
        { parent: 'parent', child: 'child' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('setConstraints', () => {
    it('should set constraints on an existing element', async () => {
      const storage = createTestStorage();
      await elementHandler.create({ element: 'test-id-1', kind: 'input', label: 'Name', dataType: 'string' }, storage)();
      const result = await elementHandler.setConstraints(
        { element: 'test-id-1', constraints: 'required,maxLength:100' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for nonexistent element', async () => {
      const storage = createTestStorage();
      const result = await elementHandler.setConstraints(
        { element: 'missing', constraints: 'required' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('enrich', () => {
    it('should enrich an existing element with interactor', async () => {
      const storage = createTestStorage();
      await elementHandler.create({ element: 'test-id-1', kind: 'button', label: 'Submit', dataType: 'any' }, storage)();
      const result = await elementHandler.enrich(
        { element: 'test-id-1', interactorType: 'click', interactorProps: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for nonexistent element', async () => {
      const storage = createTestStorage();
      const result = await elementHandler.enrich(
        { element: 'missing', interactorType: 'click', interactorProps: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('assignWidget', () => {
    it('should assign a widget to an existing element', async () => {
      const storage = createTestStorage();
      await elementHandler.create({ element: 'test-id-1', kind: 'input', label: 'Email', dataType: 'string' }, storage)();
      const result = await elementHandler.assignWidget(
        { element: 'test-id-1', widget: 'text-input' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for nonexistent element', async () => {
      const storage = createTestStorage();
      const result = await elementHandler.assignWidget(
        { element: 'missing', widget: 'text-input' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('remove', () => {
    it('should remove an existing element', async () => {
      const storage = createTestStorage();
      await elementHandler.create({ element: 'test-id-1', kind: 'text', label: 'Title', dataType: 'string' }, storage)();
      const result = await elementHandler.remove(
        { element: 'test-id-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for nonexistent element', async () => {
      const storage = createTestStorage();
      const result = await elementHandler.remove(
        { element: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
