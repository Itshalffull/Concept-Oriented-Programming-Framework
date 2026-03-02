// FormBuilder — handler.test.ts
// Unit tests for formBuilder handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { formBuilderHandler } from './handler.js';
import type { FormBuilderStorage } from './types.js';

const createTestStorage = (): FormBuilderStorage => {
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

const createFailingStorage = (): FormBuilderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const seedSchema = async (storage: FormBuilderStorage, schemaId: string, fields: Record<string, Record<string, unknown>>): Promise<void> => {
  await storage.put('schemas', schemaId, { fields });
};

describe('FormBuilder handler', () => {
  describe('buildForm', () => {
    it('should build a form definition from a schema', async () => {
      const storage = createTestStorage();
      await seedSchema(storage, 'user-schema', {
        name: { type: 'string', required: true },
        email: { type: 'email', required: true },
        age: { type: 'number', min: 0, max: 150 },
      });
      const result = await formBuilderHandler.buildForm(
        { form: 'user-form', schema: 'user-schema' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const definition = JSON.parse(result.right.definition);
          expect(definition.fieldCount).toBe(3);
          expect(definition.fields[0].name).toBe('name');
          expect(definition.fields[0].widget).toBe('textfield');
          expect(definition.fields[1].widget).toBe('email');
          expect(definition.fields[2].widget).toBe('number');
        }
      }
    });

    it('should return error when schema not found', async () => {
      const storage = createTestStorage();
      const result = await formBuilderHandler.buildForm(
        { form: 'my-form', schema: 'missing-schema' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error when schema has no fields', async () => {
      const storage = createTestStorage();
      await seedSchema(storage, 'empty-schema', {});
      const result = await formBuilderHandler.buildForm(
        { form: 'my-form', schema: 'empty-schema' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should infer widget types correctly', async () => {
      const storage = createTestStorage();
      await seedSchema(storage, 'widget-schema', {
        bio: { type: 'text' },
        active: { type: 'boolean' },
        dob: { type: 'date' },
        avatar: { type: 'image' },
        color: { type: 'color' },
      });
      const result = await formBuilderHandler.buildForm(
        { form: 'widget-form', schema: 'widget-schema' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const def = JSON.parse(result.right.definition);
        expect(def.fields[0].widget).toBe('textarea');
        expect(def.fields[1].widget).toBe('checkbox');
        expect(def.fields[2].widget).toBe('datepicker');
        expect(def.fields[3].widget).toBe('image_upload');
        expect(def.fields[4].widget).toBe('colorpicker');
      }
    });

    it('should apply validation rules from field metadata', async () => {
      const storage = createTestStorage();
      await seedSchema(storage, 'val-schema', {
        username: { type: 'string', required: true, minLength: 3, maxLength: 20, pattern: '^[a-z]+$' },
      });
      const result = await formBuilderHandler.buildForm(
        { form: 'val-form', schema: 'val-schema' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const def = JSON.parse(result.right.definition);
        const field = def.fields[0];
        expect(field.validation.required).toBe(true);
        expect(field.validation.minLength).toBe(3);
        expect(field.validation.maxLength).toBe(20);
        expect(field.validation.pattern).toBe('^[a-z]+$');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await formBuilderHandler.buildForm(
        { form: 'f', schema: 's' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
