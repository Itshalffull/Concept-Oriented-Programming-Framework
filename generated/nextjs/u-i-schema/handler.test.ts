// UISchema — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { uISchemaHandler } from './handler.js';
import type { UISchemaStorage } from './types.js';

const createTestStorage = (): UISchemaStorage => {
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

const createFailingStorage = (): UISchemaStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = uISchemaHandler;

describe('UISchema handler', () => {
  describe('inspect', () => {
    it('should derive UI schema from a valid concept spec', async () => {
      const storage = createTestStorage();
      const conceptSpec = JSON.stringify({
        fields: {
          name: { type: 'string' },
          age: { type: 'number' },
          active: { type: 'boolean' },
        },
      });
      const result = await handler.inspect(
        { schema: 'user-form', conceptSpec },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const parsed = JSON.parse(result.right.schema);
          expect(parsed.controls.name).toBe('text-input');
          expect(parsed.controls.age).toBe('number-input');
          expect(parsed.controls.active).toBe('checkbox');
          expect(parsed.layout).toBe('vertical');
        }
      }
    });

    it('should handle properties key in concept spec', async () => {
      const storage = createTestStorage();
      const conceptSpec = JSON.stringify({
        properties: {
          email: { type: 'string' },
          created: { type: 'date' },
        },
      });
      const result = await handler.inspect(
        { schema: 'contact-form', conceptSpec },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const parsed = JSON.parse(result.right.schema);
          expect(parsed.controls.email).toBe('text-input');
          expect(parsed.controls.created).toBe('date-picker');
        }
      }
    });

    it('should return parseError on invalid JSON', async () => {
      const storage = createTestStorage();
      const result = await handler.inspect(
        { schema: 'bad', conceptSpec: '{{not json' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('parseError');
      }
    });

    it('should persist the UI schema to storage on success', async () => {
      const storage = createTestStorage();
      const conceptSpec = JSON.stringify({ fields: { x: { type: 'string' } } });
      await handler.inspect({ schema: 'persist-test', conceptSpec }, storage)();
      const stored = await storage.get('uischema', 'persist-test');
      expect(stored).not.toBeNull();
      expect(stored!.schema).toBe('persist-test');
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const conceptSpec = JSON.stringify({ fields: { x: { type: 'string' } } });
      const result = await handler.inspect({ schema: 'fail', conceptSpec }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('override', () => {
    it('should merge overrides into existing UI schema', async () => {
      const storage = createTestStorage();
      const conceptSpec = JSON.stringify({
        fields: { name: { type: 'string' }, bio: { type: 'string' } },
      });
      await handler.inspect({ schema: 'overridable', conceptSpec }, storage)();

      const result = await handler.override(
        { schema: 'overridable', overrides: JSON.stringify({ controls: { bio: 'textarea' } }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const parsed = JSON.parse(result.right.schema);
          expect(parsed.controls.bio).toBe('textarea');
          expect(parsed.controls.name).toBe('text-input');
        }
      }
    });

    it('should return notfound when UI schema does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.override(
        { schema: 'nonexistent', overrides: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return invalid on malformed override JSON', async () => {
      const storage = createTestStorage();
      const conceptSpec = JSON.stringify({ fields: { x: { type: 'string' } } });
      await handler.inspect({ schema: 'to-override', conceptSpec }, storage)();

      const result = await handler.override(
        { schema: 'to-override', overrides: '{{bad' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });
  });

  describe('getSchema', () => {
    it('should retrieve a stored UI schema', async () => {
      const storage = createTestStorage();
      const conceptSpec = JSON.stringify({ fields: { email: { type: 'string' } } });
      await handler.inspect({ schema: 'retrieve-me', conceptSpec }, storage)();

      const result = await handler.getSchema({ schema: 'retrieve-me' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.schema).toBe('retrieve-me');
          expect(result.right.uiSchema).toBeDefined();
        }
      }
    });

    it('should return notfound for missing schema', async () => {
      const storage = createTestStorage();
      const result = await handler.getSchema({ schema: 'nope' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('getElements', () => {
    it('should return ordered UI elements for a stored schema', async () => {
      const storage = createTestStorage();
      const conceptSpec = JSON.stringify({
        fields: { name: { type: 'string' }, age: { type: 'number' } },
      });
      await handler.inspect({ schema: 'elem-test', conceptSpec }, storage)();

      const result = await handler.getElements({ schema: 'elem-test' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const elements = JSON.parse(result.right.elements);
          expect(Array.isArray(elements)).toBe(true);
          expect(elements.length).toBe(2);
          expect(elements[0]).toHaveProperty('field');
          expect(elements[0]).toHaveProperty('control');
          expect(elements[0]).toHaveProperty('order');
        }
      }
    });

    it('should return notfound for missing schema', async () => {
      const storage = createTestStorage();
      const result = await handler.getElements({ schema: 'nope' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
