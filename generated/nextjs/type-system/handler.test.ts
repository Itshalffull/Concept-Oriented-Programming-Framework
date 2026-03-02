// TypeSystem — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { typeSystemHandler } from './handler.js';
import type { TypeSystemStorage } from './types.js';

const createTestStorage = (): TypeSystemStorage => {
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

const createFailingStorage = (): TypeSystemStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = typeSystemHandler;

describe('TypeSystem handler', () => {
  describe('registerType', () => {
    it('should register a new type successfully', async () => {
      const storage = createTestStorage();
      const result = await handler.registerType(
        {
          type: 'User',
          schema: JSON.stringify({ type: 'object', properties: { name: { type: 'string' } } }),
          constraints: JSON.stringify({ required: ['name'] }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.type).toBe('User');
        }
      }
    });

    it('should return exists for duplicate type registration', async () => {
      const storage = createTestStorage();
      await handler.registerType(
        {
          type: 'User',
          schema: JSON.stringify({ type: 'object' }),
          constraints: '{}',
        },
        storage,
      )();

      const result = await handler.registerType(
        {
          type: 'User',
          schema: JSON.stringify({ type: 'object' }),
          constraints: '{}',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should detect and store parent type from $extends', async () => {
      const storage = createTestStorage();
      // Register parent first
      await handler.registerType(
        {
          type: 'Animal',
          schema: JSON.stringify({ type: 'object', properties: { species: { type: 'string' } } }),
          constraints: '{}',
        },
        storage,
      )();

      const result = await handler.registerType(
        {
          type: 'Dog',
          schema: JSON.stringify({ $extends: 'Animal', properties: { breed: { type: 'string' } } }),
          constraints: '{}',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return exists when parent type not found', async () => {
      const storage = createTestStorage();
      const result = await handler.registerType(
        {
          type: 'Dog',
          schema: JSON.stringify({ $extends: 'NonexistentParent' }),
          constraints: '{}',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.registerType(
        { type: 'User', schema: '{}', constraints: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('resolve', () => {
    it('should resolve a registered type', async () => {
      const storage = createTestStorage();
      await handler.registerType(
        {
          type: 'User',
          schema: JSON.stringify({ type: 'object', properties: { name: { type: 'string' } } }),
          constraints: '{}',
        },
        storage,
      )();

      const result = await handler.resolve({ type: 'User' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.type).toBe('User');
          const schema = JSON.parse(result.right.schema);
          expect(schema.properties.name.type).toBe('string');
        }
      }
    });

    it('should return notfound for unregistered type', async () => {
      const storage = createTestStorage();
      const result = await handler.resolve({ type: 'Nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should resolve type with parent inheritance', async () => {
      const storage = createTestStorage();
      await handler.registerType(
        {
          type: 'Base',
          schema: JSON.stringify({ type: 'object', properties: { id: { type: 'string' } } }),
          constraints: '{}',
        },
        storage,
      )();
      await handler.registerType(
        {
          type: 'Child',
          schema: JSON.stringify({ $extends: 'Base', properties: { name: { type: 'string' } } }),
          constraints: '{}',
        },
        storage,
      )();

      const result = await handler.resolve({ type: 'Child' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const schema = JSON.parse(result.right.schema);
        expect(schema.properties.id.type).toBe('string');
        expect(schema.properties.name.type).toBe('string');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.resolve({ type: 'User' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('navigate', () => {
    it('should navigate into a nested property', async () => {
      const storage = createTestStorage();
      await handler.registerType(
        {
          type: 'Config',
          schema: JSON.stringify({
            type: 'object',
            properties: {
              database: {
                type: 'object',
                properties: {
                  host: { type: 'string' },
                  port: { type: 'number' },
                },
              },
            },
          }),
          constraints: '{}',
        },
        storage,
      )();

      const result = await handler.navigate(
        { type: 'Config', path: 'properties.database.properties.host' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const schema = JSON.parse(result.right.schema);
          expect(schema.type).toBe('string');
        }
      }
    });

    it('should return notfound for invalid path', async () => {
      const storage = createTestStorage();
      await handler.registerType(
        {
          type: 'Simple',
          schema: JSON.stringify({ type: 'object' }),
          constraints: '{}',
        },
        storage,
      )();

      const result = await handler.navigate(
        { type: 'Simple', path: 'nonexistent.deep.path' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return notfound for unregistered type', async () => {
      const storage = createTestStorage();
      const result = await handler.navigate(
        { type: 'Missing', path: 'field' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.navigate(
        { type: 'Config', path: 'field' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('serialize', () => {
    it('should serialize a string value', async () => {
      const storage = createTestStorage();
      await handler.registerType(
        {
          type: 'Name',
          schema: JSON.stringify({ type: 'string' }),
          constraints: '{}',
        },
        storage,
      )();

      const result = await handler.serialize(
        { type: 'Name', value: 'hello' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.serialized).toBe('"hello"');
        }
      }
    });

    it('should serialize a number value', async () => {
      const storage = createTestStorage();
      await handler.registerType(
        {
          type: 'Count',
          schema: JSON.stringify({ type: 'number' }),
          constraints: '{}',
        },
        storage,
      )();

      const result = await handler.serialize(
        { type: 'Count', value: '42' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.serialized).toBe('42');
      }
    });

    it('should serialize a boolean value', async () => {
      const storage = createTestStorage();
      await handler.registerType(
        {
          type: 'Flag',
          schema: JSON.stringify({ type: 'boolean' }),
          constraints: '{}',
        },
        storage,
      )();

      const result = await handler.serialize(
        { type: 'Flag', value: 'true' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.serialized).toBe('true');
      }
    });

    it('should return notfound for invalid number serialization', async () => {
      const storage = createTestStorage();
      await handler.registerType(
        {
          type: 'Count',
          schema: JSON.stringify({ type: 'number' }),
          constraints: '{}',
        },
        storage,
      )();

      const result = await handler.serialize(
        { type: 'Count', value: 'not-a-number' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return notfound for unregistered type', async () => {
      const storage = createTestStorage();
      const result = await handler.serialize(
        { type: 'Nonexistent', value: 'test' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should validate required fields for object types', async () => {
      const storage = createTestStorage();
      await handler.registerType(
        {
          type: 'Strict',
          schema: JSON.stringify({
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
          }),
          constraints: '{}',
        },
        storage,
      )();

      const result = await handler.serialize(
        { type: 'Strict', value: JSON.stringify({}) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
        if (result.right.variant === 'notfound') {
          expect(result.right.message).toContain('name');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.serialize(
        { type: 'Name', value: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
