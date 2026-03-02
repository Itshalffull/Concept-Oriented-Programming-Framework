// Env — handler.test.ts
// Unit tests for env handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { envHandler } from './handler.js';
import type { EnvStorage } from './types.js';

const createTestStorage = (): EnvStorage => {
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

const createFailingStorage = (): EnvStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Env handler', () => {
  describe('resolve', () => {
    it('should resolve environment by merging base and overrides', async () => {
      const storage = createTestStorage();
      await storage.put('env_base', 'base', { vars: JSON.stringify({ DB_HOST: 'localhost', DB_PORT: '5432' }) });
      await storage.put('env_overrides', 'staging', { vars: JSON.stringify({ DB_HOST: 'staging-db.example.com' }) });
      const result = await envHandler.resolve(
        { environment: 'staging' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const resolved = JSON.parse(result.right.resolved);
          expect(resolved.DB_HOST).toBe('staging-db.example.com');
          expect(resolved.DB_PORT).toBe('5432');
        }
      }
    });

    it('should return missingBase when no base config exists', async () => {
      const storage = createTestStorage();
      const result = await envHandler.resolve(
        { environment: 'production' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('missingBase');
      }
    });

    it('should return conflictingOverrides when conflicts exist', async () => {
      const storage = createTestStorage();
      await storage.put('env_base', 'base', { vars: JSON.stringify({ KEY: 'val' }) });
      await storage.put('env_overrides', 'staging', {
        vars: JSON.stringify({ KEY: 'override' }),
        conflicts: ['KEY'],
      });
      const result = await envHandler.resolve(
        { environment: 'staging' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('conflictingOverrides');
        if (result.right.variant === 'conflictingOverrides') {
          expect(result.right.conflicts).toContain('KEY');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await envHandler.resolve(
        { environment: 'staging' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('promote', () => {
    it('should promote a resolved environment to a target', async () => {
      const storage = createTestStorage();
      await storage.put('env_resolved', 'staging', {
        environment: 'staging',
        resolved: JSON.stringify({ DB_HOST: 'staging-db' }),
        version: '1',
      });
      const result = await envHandler.promote(
        { fromEnv: 'staging', toEnv: 'production', kitName: 'my-kit' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.toEnv).toBe('production');
        }
      }
    });

    it('should return notValidated when source not resolved', async () => {
      const storage = createTestStorage();
      const result = await envHandler.promote(
        { fromEnv: 'staging', toEnv: 'production', kitName: 'my-kit' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notValidated');
      }
    });

    it('should return versionMismatch when target is already newer', async () => {
      const storage = createTestStorage();
      await storage.put('env_resolved', 'staging', {
        environment: 'staging',
        resolved: '{}',
        version: '1',
      });
      await storage.put('env_resolved', 'production', {
        environment: 'production',
        resolved: '{}',
        version: '5',
      });
      const result = await envHandler.promote(
        { fromEnv: 'staging', toEnv: 'production', kitName: 'my-kit' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('versionMismatch');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await envHandler.promote(
        { fromEnv: 'staging', toEnv: 'production', kitName: 'my-kit' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('diff', () => {
    it('should return differences between two environments', async () => {
      const storage = createTestStorage();
      await storage.put('env_resolved', 'staging', {
        resolved: JSON.stringify({ DB_HOST: 'staging', SHARED: 'same' }),
      });
      await storage.put('env_resolved', 'production', {
        resolved: JSON.stringify({ DB_HOST: 'production', SHARED: 'same' }),
      });
      const result = await envHandler.diff(
        { envA: 'staging', envB: 'production' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.differences.some(d => d.includes('DB_HOST'))).toBe(true);
      }
    });

    it('should return empty differences when environments are identical', async () => {
      const storage = createTestStorage();
      await storage.put('env_resolved', 'a', { resolved: JSON.stringify({ KEY: 'val' }) });
      await storage.put('env_resolved', 'b', { resolved: JSON.stringify({ KEY: 'val' }) });
      const result = await envHandler.diff(
        { envA: 'a', envB: 'b' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.differences.length).toBe(0);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await envHandler.diff(
        { envA: 'staging', envB: 'production' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
