// SchemaEvolution — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { schemaEvolutionHandler } from './handler.js';
import type { SchemaEvolutionStorage } from './types.js';

const createTestStorage = (): SchemaEvolutionStorage => {
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

const createFailingStorage = (): SchemaEvolutionStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = schemaEvolutionHandler;

const makeSchema = (fields: readonly string[]): Buffer =>
  Buffer.from(JSON.stringify({ fields }), 'utf-8');

describe('SchemaEvolution handler', () => {
  describe('register', () => {
    it('should register a new schema version', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        { subject: 'User', schema: makeSchema(['name', 'email']), compatibility: 'backward' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.version).toBe(1);
          expect(result.right.schemaId.length).toBeGreaterThan(0);
        }
      }
    });

    it('should return invalidCompatibility for unknown mode', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        { subject: 'User', schema: makeSchema(['name']), compatibility: 'invalid-mode' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidCompatibility');
      }
    });

    it('should detect incompatible change in backward mode', async () => {
      const storage = createTestStorage();
      await handler.register(
        { subject: 'User', schema: makeSchema(['name', 'email']), compatibility: 'backward' },
        storage,
      )();
      const result = await handler.register(
        { subject: 'User', schema: makeSchema(['name']), compatibility: 'backward' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('incompatible');
        if (result.right.variant === 'incompatible') {
          expect(result.right.reasons.length).toBeGreaterThan(0);
        }
      }
    });

    it('should allow compatible change with none mode', async () => {
      const storage = createTestStorage();
      await handler.register(
        { subject: 'User', schema: makeSchema(['name', 'email']), compatibility: 'none' },
        storage,
      )();
      const result = await handler.register(
        { subject: 'User', schema: makeSchema(['name']), compatibility: 'none' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.version).toBe(2);
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.register(
        { subject: 'X', schema: makeSchema([]), compatibility: 'none' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('check', () => {
    it('should return compatible when no breaking changes', async () => {
      const storage = createTestStorage();
      const result = await handler.check(
        { oldSchema: makeSchema(['name']), newSchema: makeSchema(['name', 'email']), mode: 'backward' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('compatible');
      }
    });

    it('should return incompatible when removing fields in backward mode', async () => {
      const storage = createTestStorage();
      const result = await handler.check(
        { oldSchema: makeSchema(['name', 'email']), newSchema: makeSchema(['name']), mode: 'backward' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('incompatible');
        if (result.right.variant === 'incompatible') {
          expect(result.right.reasons.length).toBeGreaterThan(0);
        }
      }
    });

    it('should return incompatible when adding fields in forward mode', async () => {
      const storage = createTestStorage();
      const result = await handler.check(
        { oldSchema: makeSchema(['name']), newSchema: makeSchema(['name', 'email']), mode: 'forward' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('incompatible');
      }
    });

    it('should return incompatible for both add and remove in full mode', async () => {
      const storage = createTestStorage();
      const result = await handler.check(
        { oldSchema: makeSchema(['name', 'email']), newSchema: makeSchema(['name', 'age']), mode: 'full' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('incompatible');
        if (result.right.variant === 'incompatible') {
          expect(result.right.reasons.length).toBe(2);
        }
      }
    });
  });

  describe('upcast', () => {
    it('should return notFound when subject has no versions', async () => {
      const storage = createTestStorage();
      const result = await handler.upcast(
        { data: Buffer.from('{}', 'utf-8'), fromVersion: 1, toVersion: 2, subject: 'Missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('should return noPath when downcasting', async () => {
      const storage = createTestStorage();
      await handler.register(
        { subject: 'User', schema: makeSchema(['name']), compatibility: 'none' },
        storage,
      )();
      await handler.register(
        { subject: 'User', schema: makeSchema(['name', 'email']), compatibility: 'none' },
        storage,
      )();
      const result = await handler.upcast(
        { data: Buffer.from('{"name":"Alice","email":"a@b"}', 'utf-8'), fromVersion: 2, toVersion: 1, subject: 'User' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noPath');
      }
    });

    it('should upcast data to target version fields', async () => {
      const storage = createTestStorage();
      await handler.register(
        { subject: 'User', schema: makeSchema(['name']), compatibility: 'none' },
        storage,
      )();
      await handler.register(
        { subject: 'User', schema: makeSchema(['name', 'email']), compatibility: 'none' },
        storage,
      )();
      const result = await handler.upcast(
        { data: Buffer.from('{"name":"Alice"}', 'utf-8'), fromVersion: 1, toVersion: 2, subject: 'User' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const transformed = JSON.parse(result.right.transformed.toString('utf-8'));
          expect(transformed.name).toBe('Alice');
          expect(transformed.email).toBeNull();
        }
      }
    });
  });

  describe('resolve', () => {
    it('should resolve compatible reader/writer schemas', async () => {
      const storage = createTestStorage();
      const result = await handler.resolve(
        { readerSchema: makeSchema(['name']), writerSchema: makeSchema(['name', 'email']) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const resolved = JSON.parse(result.right.resolved.toString('utf-8'));
          expect(resolved.fields).toContain('name');
        }
      }
    });

    it('should return incompatible when reader expects fields not in writer', async () => {
      const storage = createTestStorage();
      const result = await handler.resolve(
        { readerSchema: makeSchema(['name', 'age']), writerSchema: makeSchema(['name']) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('incompatible');
        if (result.right.variant === 'incompatible') {
          expect(result.right.reasons.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('getSchema', () => {
    it('should retrieve a registered schema version', async () => {
      const storage = createTestStorage();
      await handler.register(
        { subject: 'User', schema: makeSchema(['name']), compatibility: 'none' },
        storage,
      )();
      const result = await handler.getSchema({ subject: 'User', version: 1 }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.compatibility).toBe('none');
        }
      }
    });

    it('should return notFound for non-existent version', async () => {
      const storage = createTestStorage();
      const result = await handler.getSchema({ subject: 'User', version: 99 }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notFound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.getSchema({ subject: 'User', version: 1 }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
