// InteractorEntity — handler.test.ts
// Unit tests for interactorEntity handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { interactorEntityHandler } from './handler.js';
import type { InteractorEntityStorage } from './types.js';

const createTestStorage = (): InteractorEntityStorage => {
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

const createFailingStorage = (): InteractorEntityStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('InteractorEntity handler', () => {
  describe('register', () => {
    it('should register a new interactor entity', async () => {
      const storage = createTestStorage();
      const input = {
        name: 'text-input',
        category: 'input',
        properties: JSON.stringify({ value: 'string', onChange: '() => void' }),
      };

      const result = await interactorEntityHandler.register(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.entity).toBe('interactor_text-input');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const input = { name: 'x', category: 'input', properties: '{}' };
      const result = await interactorEntityHandler.register(input, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('findByCategory', () => {
    it('should find interactors by category', async () => {
      const storage = createTestStorage();
      await interactorEntityHandler.register({
        name: 'slider', category: 'input', properties: '{}',
      }, storage)();

      const result = await interactorEntityHandler.findByCategory({
        category: 'input',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await interactorEntityHandler.findByCategory({
        category: 'input',
      }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('matchingWidgets', () => {
    it('should return empty list when interactor not found', async () => {
      const storage = createTestStorage();
      const result = await interactorEntityHandler.matchingWidgets({
        interactor: 'no-exist', context: 'web',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const widgets = JSON.parse(result.right.widgets);
        expect(widgets).toHaveLength(0);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await interactorEntityHandler.matchingWidgets({
        interactor: 'x', context: 'web',
      }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('classifiedFields', () => {
    it('should classify properties into action, flag, collection, data', async () => {
      const storage = createTestStorage();
      await interactorEntityHandler.register({
        name: 'complex',
        category: 'input',
        properties: JSON.stringify({
          onClick: '() => void',
          isEnabled: 'boolean',
          items: 'string[]',
          label: 'string',
        }),
      }, storage)();

      const result = await interactorEntityHandler.classifiedFields({
        interactor: 'interactor_complex',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const fields = JSON.parse(result.right.fields);
        expect(fields.length).toBe(4);
        const onClickField = fields.find((f: { name: string }) => f.name === 'onClick');
        expect(onClickField.classification).toBe('action');
        const isEnabledField = fields.find((f: { name: string }) => f.name === 'isEnabled');
        expect(isEnabledField.classification).toBe('flag');
      }
    });

    it('should return empty list when interactor not found', async () => {
      const storage = createTestStorage();
      const result = await interactorEntityHandler.classifiedFields({
        interactor: 'missing',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const fields = JSON.parse(result.right.fields);
        expect(fields).toHaveLength(0);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await interactorEntityHandler.classifiedFields({
        interactor: 'x',
      }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('coverageReport', () => {
    it('should produce a coverage report', async () => {
      const storage = createTestStorage();
      const result = await interactorEntityHandler.coverageReport({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const report = JSON.parse(result.right.report);
        expect(report).toHaveProperty('totalInteractors');
        expect(report).toHaveProperty('coveragePercent');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await interactorEntityHandler.coverageReport({}, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('get', () => {
    it('should get an existing interactor entity', async () => {
      const storage = createTestStorage();
      await interactorEntityHandler.register({
        name: 'btn', category: 'trigger', properties: '{}',
      }, storage)();

      const result = await interactorEntityHandler.get({
        interactor: 'interactor_btn',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.name).toBe('btn');
          expect(result.right.category).toBe('trigger');
        }
      }
    });

    it('should return notfound for missing entity', async () => {
      const storage = createTestStorage();
      const result = await interactorEntityHandler.get({
        interactor: 'missing',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await interactorEntityHandler.get({ interactor: 'x' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
