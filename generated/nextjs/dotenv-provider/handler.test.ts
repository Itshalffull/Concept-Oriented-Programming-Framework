// DotenvProvider — handler.test.ts
// Unit tests for dotenvProvider handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { dotenvProviderHandler } from './handler.js';
import type { DotenvProviderStorage } from './types.js';

const createTestStorage = (): DotenvProviderStorage => {
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

const createFailingStorage = (): DotenvProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('DotenvProvider handler', () => {
  describe('fetch', () => {
    it('should return ok with value when variable exists in .env file', async () => {
      const storage = createTestStorage();
      await storage.put('dotenv_files', '.env', { content: 'DB_HOST=localhost\nDB_PORT=5432' });
      const result = await dotenvProviderHandler.fetch(
        { name: 'DB_HOST', filePath: '.env' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.value).toBe('localhost');
        }
      }
    });

    it('should return fileNotFound when .env file does not exist', async () => {
      const storage = createTestStorage();
      const result = await dotenvProviderHandler.fetch(
        { name: 'DB_HOST', filePath: '.env.missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('fileNotFound');
        if (result.right.variant === 'fileNotFound') {
          expect(result.right.filePath).toBe('.env.missing');
        }
      }
    });

    it('should return variableNotSet when variable is missing', async () => {
      const storage = createTestStorage();
      await storage.put('dotenv_files', '.env', { content: 'OTHER_VAR=value' });
      const result = await dotenvProviderHandler.fetch(
        { name: 'DB_HOST', filePath: '.env' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('variableNotSet');
        if (result.right.variant === 'variableNotSet') {
          expect(result.right.name).toBe('DB_HOST');
        }
      }
    });

    it('should return parseError for malformed .env content', async () => {
      const storage = createTestStorage();
      await storage.put('dotenv_files', '.env', { content: 'this is not valid' });
      const result = await dotenvProviderHandler.fetch(
        { name: 'DB_HOST', filePath: '.env' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('parseError');
      }
    });

    it('should handle quoted values correctly', async () => {
      const storage = createTestStorage();
      await storage.put('dotenv_files', '.env', { content: 'SECRET="my secret value"' });
      const result = await dotenvProviderHandler.fetch(
        { name: 'SECRET', filePath: '.env' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.value).toBe('my secret value');
        }
      }
    });

    it('should skip comment lines', async () => {
      const storage = createTestStorage();
      await storage.put('dotenv_files', '.env', { content: '# comment\nKEY=value' });
      const result = await dotenvProviderHandler.fetch(
        { name: 'KEY', filePath: '.env' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.value).toBe('value');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await dotenvProviderHandler.fetch(
        { name: 'DB_HOST', filePath: '.env' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
