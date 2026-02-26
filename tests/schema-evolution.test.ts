// SchemaEvolution concept handler tests -- register, check compatibility, upcast, resolve, getSchema.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import { schemaEvolutionHandler, resetSchemaEvolutionCounter } from '../implementations/typescript/schema-evolution.impl.js';

describe('SchemaEvolution', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetSchemaEvolutionCounter();
  });

  const userSchemaV1 = JSON.stringify([
    { name: 'id', type: 'string', required: true },
    { name: 'name', type: 'string', required: true },
  ]);

  const userSchemaV2 = JSON.stringify([
    { name: 'id', type: 'string', required: true },
    { name: 'name', type: 'string', required: true },
    { name: 'email', type: 'string', required: false },
  ]);

  describe('register', () => {
    it('registers a first schema version', async () => {
      const result = await schemaEvolutionHandler.register(
        { subject: 'User', schema: userSchemaV1, compatibility: 'backward' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.version).toBe(1);
    });

    it('auto-increments version number', async () => {
      await schemaEvolutionHandler.register({ subject: 'User', schema: userSchemaV1, compatibility: 'backward' }, storage);
      const result = await schemaEvolutionHandler.register(
        { subject: 'User', schema: userSchemaV2, compatibility: 'backward' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.version).toBe(2);
    });

    it('rejects incompatible backward-breaking changes', async () => {
      await schemaEvolutionHandler.register({ subject: 'User', schema: userSchemaV1, compatibility: 'backward' }, storage);

      // Add a new required field without default -- breaks backward compatibility
      const breakingSchema = JSON.stringify([
        { name: 'id', type: 'string', required: true },
        { name: 'name', type: 'string', required: true },
        { name: 'age', type: 'number', required: true },
      ]);

      const result = await schemaEvolutionHandler.register(
        { subject: 'User', schema: breakingSchema, compatibility: 'backward' },
        storage,
      );
      expect(result.variant).toBe('incompatible');
      expect((result.reasons as string[]).length).toBeGreaterThan(0);
    });

    it('rejects invalid compatibility mode', async () => {
      const result = await schemaEvolutionHandler.register(
        { subject: 'User', schema: userSchemaV1, compatibility: 'bogus' },
        storage,
      );
      expect(result.variant).toBe('invalidCompatibility');
    });

    it('allows new required field with default under backward mode', async () => {
      await schemaEvolutionHandler.register({ subject: 'User', schema: userSchemaV1, compatibility: 'backward' }, storage);

      const compatibleSchema = JSON.stringify([
        { name: 'id', type: 'string', required: true },
        { name: 'name', type: 'string', required: true },
        { name: 'role', type: 'string', required: true, default: 'user' },
      ]);

      const result = await schemaEvolutionHandler.register(
        { subject: 'User', schema: compatibleSchema, compatibility: 'backward' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });
  });

  describe('check', () => {
    it('reports compatible schemas', async () => {
      const result = await schemaEvolutionHandler.check(
        { oldSchema: userSchemaV1, newSchema: userSchemaV2, mode: 'backward' },
        storage,
      );
      expect(result.variant).toBe('compatible');
    });

    it('reports incompatible type changes', async () => {
      const schema1 = JSON.stringify([{ name: 'age', type: 'number', required: true }]);
      const schema2 = JSON.stringify([{ name: 'age', type: 'string', required: true }]);

      const result = await schemaEvolutionHandler.check(
        { oldSchema: schema1, newSchema: schema2, mode: 'backward' },
        storage,
      );
      expect(result.variant).toBe('incompatible');
      expect((result.reasons as string[]).some(r => r.includes('Type change'))).toBe(true);
    });

    it('reports forward incompatibility for removed required fields', async () => {
      const schema1 = JSON.stringify([
        { name: 'id', type: 'string', required: true },
        { name: 'name', type: 'string', required: true },
      ]);
      const schema2 = JSON.stringify([
        { name: 'id', type: 'string', required: true },
      ]);

      const result = await schemaEvolutionHandler.check(
        { oldSchema: schema1, newSchema: schema2, mode: 'forward' },
        storage,
      );
      expect(result.variant).toBe('incompatible');
    });

    it('allows anything under none mode', async () => {
      const schema1 = JSON.stringify([{ name: 'x', type: 'string', required: true }]);
      const schema2 = JSON.stringify([{ name: 'y', type: 'number', required: true }]);

      const result = await schemaEvolutionHandler.check(
        { oldSchema: schema1, newSchema: schema2, mode: 'none' },
        storage,
      );
      expect(result.variant).toBe('compatible');
    });
  });

  describe('upcast', () => {
    it('adds default values for new fields during upcast', async () => {
      await schemaEvolutionHandler.register({ subject: 'Config', schema: userSchemaV1, compatibility: 'backward' }, storage);

      const schemaV2 = JSON.stringify([
        { name: 'id', type: 'string', required: true },
        { name: 'name', type: 'string', required: true },
        { name: 'theme', type: 'string', required: true, default: 'light' },
      ]);
      await schemaEvolutionHandler.register({ subject: 'Config', schema: schemaV2, compatibility: 'backward' }, storage);

      const data = JSON.stringify({ id: '1', name: 'test' });
      const result = await schemaEvolutionHandler.upcast(
        { data, fromVersion: 1, toVersion: 2, subject: 'Config' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const transformed = JSON.parse(result.transformed as string);
      expect(transformed.theme).toBe('light');
    });

    it('returns notFound for unknown version', async () => {
      const result = await schemaEvolutionHandler.upcast(
        { data: '{}', fromVersion: 1, toVersion: 2, subject: 'Missing' },
        storage,
      );
      expect(result.variant).toBe('notFound');
    });

    it('returns noPath for downcast attempt', async () => {
      await schemaEvolutionHandler.register({ subject: 'X', schema: userSchemaV1, compatibility: 'none' }, storage);
      await schemaEvolutionHandler.register({ subject: 'X', schema: userSchemaV2, compatibility: 'none' }, storage);

      const result = await schemaEvolutionHandler.upcast(
        { data: '{}', fromVersion: 2, toVersion: 1, subject: 'X' },
        storage,
      );
      expect(result.variant).toBe('noPath');
    });
  });

  describe('resolve', () => {
    it('merges reader and writer schemas', async () => {
      const reader = JSON.stringify([{ name: 'id', type: 'string', required: true }]);
      const writer = JSON.stringify([
        { name: 'id', type: 'string', required: true },
        { name: 'extra', type: 'string', required: true },
      ]);

      const result = await schemaEvolutionHandler.resolve(
        { readerSchema: reader, writerSchema: writer },
        storage,
      );
      expect(result.variant).toBe('ok');
      const resolved = JSON.parse(result.resolved as string);
      // Should contain both id and extra
      expect(resolved.some((f: { name: string }) => f.name === 'id')).toBe(true);
      expect(resolved.some((f: { name: string }) => f.name === 'extra')).toBe(true);
    });
  });

  describe('getSchema', () => {
    it('retrieves a specific schema version', async () => {
      await schemaEvolutionHandler.register({ subject: 'User', schema: userSchemaV1, compatibility: 'backward' }, storage);

      const result = await schemaEvolutionHandler.getSchema({ subject: 'User', version: 1 }, storage);
      expect(result.variant).toBe('ok');
      expect(result.schema).toBe(userSchemaV1);
      expect(result.compatibility).toBe('backward');
    });

    it('returns notFound for unknown subject/version', async () => {
      const result = await schemaEvolutionHandler.getSchema({ subject: 'Missing', version: 1 }, storage);
      expect(result.variant).toBe('notFound');
    });
  });
});
