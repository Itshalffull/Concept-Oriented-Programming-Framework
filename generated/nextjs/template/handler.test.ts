// Template — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { templateHandler } from './handler.js';
import type { TemplateStorage } from './types.js';

const createTestStorage = (): TemplateStorage => {
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

const createFailingStorage = (): TemplateStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Template handler', () => {
  describe('define', () => {
    it('should define a new template', async () => {
      const storage = createTestStorage();

      const result = await templateHandler.define(
        { template: 'greeting', body: 'Hello, {{name}}!', variables: 'name' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return exists for a duplicate template', async () => {
      const storage = createTestStorage();
      await storage.put('template', 'greeting', { id: 'greeting' });

      const result = await templateHandler.define(
        { template: 'greeting', body: 'Hi!', variables: '' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await templateHandler.define(
        { template: 'greeting', body: 'Hello!', variables: '' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('instantiate', () => {
    it('should substitute variables and return content', async () => {
      const storage = createTestStorage();
      await storage.put('template', 'greeting', {
        id: 'greeting',
        body: 'Hello, {{name}}! Welcome to {{place}}.',
        variables: JSON.stringify(['name', 'place']),
      });

      const result = await templateHandler.instantiate(
        { template: 'greeting', values: 'name=World,place=Earth' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.content).toBe('Hello, World! Welcome to Earth.');
        }
      }
    });

    it('should return notfound for a missing template', async () => {
      const storage = createTestStorage();

      const result = await templateHandler.instantiate(
        { template: 'missing', values: 'name=X' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left when required variables are missing', async () => {
      const storage = createTestStorage();
      await storage.put('template', 'greeting', {
        id: 'greeting',
        body: 'Hello, {{name}}!',
        variables: JSON.stringify(['name', 'title']),
      });

      const result = await templateHandler.instantiate(
        { template: 'greeting', values: 'name=World' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('MISSING_VARIABLES');
      }
    });
  });

  describe('registerTrigger', () => {
    it('should append a trigger to an existing template', async () => {
      const storage = createTestStorage();
      await storage.put('template', 'greeting', {
        id: 'greeting',
        triggers: JSON.stringify([]),
      });

      const result = await templateHandler.registerTrigger(
        { template: 'greeting', trigger: 'on-create' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for a missing template', async () => {
      const storage = createTestStorage();

      const result = await templateHandler.registerTrigger(
        { template: 'missing', trigger: 'on-create' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('mergeProperties', () => {
    it('should merge properties into an existing template', async () => {
      const storage = createTestStorage();
      await storage.put('template', 'greeting', {
        id: 'greeting',
        properties: JSON.stringify({ lang: 'en' }),
      });

      const result = await templateHandler.mergeProperties(
        { template: 'greeting', properties: 'format=html,priority=high' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for a missing template', async () => {
      const storage = createTestStorage();

      const result = await templateHandler.mergeProperties(
        { template: 'missing', properties: 'a=b' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
