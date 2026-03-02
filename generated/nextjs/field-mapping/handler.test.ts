// FieldMapping — handler.test.ts
// Unit tests for fieldMapping handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { fieldMappingHandler } from './handler.js';
import type { FieldMappingStorage } from './types.js';

const createTestStorage = (): FieldMappingStorage => {
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

const createFailingStorage = (): FieldMappingStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

/** Seed a mapping in storage. */
const seedMapping = async (storage: FieldMappingStorage, mappingId: string, rules: readonly { sourceField: string; destField: string; transform: string }[]) => {
  await storage.put('mappings', mappingId, {
    mappingId,
    rules: JSON.stringify(rules),
    createdAt: new Date().toISOString(),
  });
};

describe('FieldMapping handler', () => {
  describe('map', () => {
    it('should add a rule to an existing mapping', async () => {
      const storage = createTestStorage();
      await seedMapping(storage, 'map-1', []);
      const result = await fieldMappingHandler.map(
        { mappingId: 'map-1', sourceField: 'name', destField: 'full_name', transform: 'identity' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for nonexistent mapping', async () => {
      const storage = createTestStorage();
      const result = await fieldMappingHandler.map(
        { mappingId: 'missing', sourceField: 'name', destField: 'full_name', transform: 'identity' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await fieldMappingHandler.map(
        { mappingId: 'map-1', sourceField: 'name', destField: 'full_name', transform: 'identity' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('apply', () => {
    it('should apply mapping rules to transform a record', async () => {
      const storage = createTestStorage();
      await seedMapping(storage, 'map-1', [
        { sourceField: 'name', destField: 'full_name', transform: 'uppercase' },
        { sourceField: 'age', destField: 'years', transform: 'identity' },
      ]);
      const result = await fieldMappingHandler.apply(
        { record: JSON.stringify({ name: 'alice', age: 42 }), mappingId: 'map-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const mapped = JSON.parse(result.right.mapped);
          expect(mapped.full_name).toBe('ALICE');
          expect(mapped.years).toBe(42);
        }
      }
    });

    it('should return notfound for nonexistent mapping', async () => {
      const storage = createTestStorage();
      const result = await fieldMappingHandler.apply(
        { record: '{}', mappingId: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return error for invalid JSON record', async () => {
      const storage = createTestStorage();
      await seedMapping(storage, 'map-1', [{ sourceField: 'a', destField: 'b', transform: 'identity' }]);
      const result = await fieldMappingHandler.apply(
        { record: 'not-json', mappingId: 'map-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error when source field is missing from record', async () => {
      const storage = createTestStorage();
      await seedMapping(storage, 'map-1', [{ sourceField: 'missing_field', destField: 'b', transform: 'identity' }]);
      const result = await fieldMappingHandler.apply(
        { record: JSON.stringify({ other: 'value' }), mappingId: 'map-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await fieldMappingHandler.apply(
        { record: '{}', mappingId: 'map-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('reverse', () => {
    it('should reverse a mapping from destination back to source', async () => {
      const storage = createTestStorage();
      await seedMapping(storage, 'map-1', [
        { sourceField: 'name', destField: 'full_name', transform: 'identity' },
      ]);
      const result = await fieldMappingHandler.reverse(
        { record: JSON.stringify({ full_name: 'Alice' }), mappingId: 'map-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const reversed = JSON.parse(result.right.reversed);
          expect(reversed.name).toBe('Alice');
        }
      }
    });

    it('should return notfound for nonexistent mapping', async () => {
      const storage = createTestStorage();
      const result = await fieldMappingHandler.reverse(
        { record: '{}', mappingId: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await fieldMappingHandler.reverse(
        { record: '{}', mappingId: 'map-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('autoDiscover', () => {
    it('should auto-discover mappings between similar schemas', async () => {
      const storage = createTestStorage();
      const result = await fieldMappingHandler.autoDiscover(
        {
          sourceSchema: JSON.stringify({ name: 'string', email: 'string', age: 'number' }),
          destSchema: JSON.stringify({ full_name: 'string', email_address: 'string', age: 'number' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.mappingId).toBeTruthy();
        const suggestions = JSON.parse(result.right.suggestions);
        expect(Array.isArray(suggestions)).toBe(true);
        // age should match exactly
        expect(suggestions.some((s: any) => s.src === 'age' && s.dest === 'age')).toBe(true);
      }
    });

    it('should return left for invalid JSON schemas', async () => {
      const storage = createTestStorage();
      const result = await fieldMappingHandler.autoDiscover(
        { sourceSchema: 'not-json', destSchema: '{}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('validate', () => {
    it('should validate a mapping and return warnings', async () => {
      const storage = createTestStorage();
      await seedMapping(storage, 'map-1', [
        { sourceField: 'name', destField: 'full_name', transform: 'identity' },
      ]);
      const result = await fieldMappingHandler.validate(
        { mappingId: 'map-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const warnings = JSON.parse(result.right.warnings);
          expect(Array.isArray(warnings)).toBe(true);
        }
      }
    });

    it('should warn about empty mapping rules', async () => {
      const storage = createTestStorage();
      await seedMapping(storage, 'map-empty', []);
      const result = await fieldMappingHandler.validate(
        { mappingId: 'map-empty' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const warnings = JSON.parse(result.right.warnings);
          expect(warnings.some((w: string) => w.includes('no rules'))).toBe(true);
        }
      }
    });

    it('should return notfound for nonexistent mapping', async () => {
      const storage = createTestStorage();
      const result = await fieldMappingHandler.validate(
        { mappingId: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await fieldMappingHandler.validate(
        { mappingId: 'map-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
