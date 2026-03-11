// WidgetEntity — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { widgetEntityHandler } from './handler.js';
import type { WidgetEntityStorage } from './types.js';

const createTestStorage = (): WidgetEntityStorage => {
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

const createFailingStorage = (): WidgetEntityStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = widgetEntityHandler;

describe('WidgetEntity handler', () => {
  describe('register', () => {
    it('should register a new widget entity successfully', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        { name: 'MyButton', source: 'button.widget', ast: '{"role":"button"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.entity).toBe('MyButton');
        }
      }
    });

    it('should return alreadyRegistered when entity exists', async () => {
      const storage = createTestStorage();
      await handler.register(
        { name: 'MyButton', source: 'button.widget', ast: '{}' },
        storage,
      )();
      const result = await handler.register(
        { name: 'MyButton', source: 'button.widget', ast: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('alreadyRegistered');
        if (result.right.variant === 'alreadyRegistered') {
          expect(result.right.existing).toBe('MyButton');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.register(
        { name: 'MyButton', source: 'button.widget', ast: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('get', () => {
    it('should return notfound when entity does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.get({ name: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return ok with entity data when it exists', async () => {
      const storage = createTestStorage();
      await handler.register(
        { name: 'MyButton', source: 'button.widget', ast: '{"role":"button"}' },
        storage,
      )();
      const result = await handler.get({ name: 'MyButton' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.entity).toBe('MyButton');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.get({ name: 'MyButton' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('findByAffordance', () => {
    it('should return empty list when no affordances match', async () => {
      const storage = createTestStorage();
      const result = await handler.findByAffordance(
        { interactor: 'click' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const widgets = JSON.parse(result.right.widgets);
        expect(widgets).toEqual([]);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.findByAffordance(
        { interactor: 'click' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('findComposing', () => {
    it('should return empty parents when no composition data exists', async () => {
      const storage = createTestStorage();
      const result = await handler.findComposing(
        { widget: 'MyButton' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const parents = JSON.parse(result.right.parents);
        expect(parents).toEqual([]);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.findComposing({ widget: 'MyButton' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('findComposedBy', () => {
    it('should return empty children when no composition data exists', async () => {
      const storage = createTestStorage();
      const result = await handler.findComposedBy(
        { widget: 'MyButton' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const children = JSON.parse(result.right.children);
        expect(children).toEqual([]);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.findComposedBy({ widget: 'MyButton' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('generatedComponents', () => {
    it('should return empty components when none generated', async () => {
      const storage = createTestStorage();
      const result = await handler.generatedComponents(
        { widget: 'MyButton' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const components = JSON.parse(result.right.components);
        expect(components).toEqual([]);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.generatedComponents({ widget: 'MyButton' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('accessibilityAudit', () => {
    it('should return incomplete when widget not found', async () => {
      const storage = createTestStorage();
      const result = await handler.accessibilityAudit(
        { widget: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('incomplete');
      }
    });

    it('should return incomplete when a11y attributes missing', async () => {
      const storage = createTestStorage();
      await handler.register(
        { name: 'MyButton', source: 'button.widget', ast: '{"name":"MyButton"}' },
        storage,
      )();
      const result = await handler.accessibilityAudit(
        { widget: 'MyButton' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('incomplete');
        if (result.right.variant === 'incomplete') {
          const missing = JSON.parse(result.right.missing);
          expect(missing).toContain('role');
          expect(missing).toContain('aria-label');
          expect(missing).toContain('tabindex');
        }
      }
    });

    it('should return ok when all a11y attributes present', async () => {
      const storage = createTestStorage();
      const ast = JSON.stringify({ role: 'button', 'aria-label': 'Click me', tabindex: '0' });
      await handler.register(
        { name: 'GoodButton', source: 'button.widget', ast },
        storage,
      )();
      const result = await handler.accessibilityAudit(
        { widget: 'GoodButton' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.accessibilityAudit({ widget: 'x' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('traceToConcept', () => {
    it('should return noConceptBinding when no bindings exist', async () => {
      const storage = createTestStorage();
      const result = await handler.traceToConcept(
        { widget: 'MyButton' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noConceptBinding');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.traceToConcept({ widget: 'x' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
