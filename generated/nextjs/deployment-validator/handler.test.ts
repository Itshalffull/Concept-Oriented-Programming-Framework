// DeploymentValidator — handler.test.ts
// Unit tests for deploymentValidator handler actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';

import { deploymentValidatorHandler } from './handler.js';
import type { DeploymentValidatorStorage } from './types.js';

const createTestStorage = (): DeploymentValidatorStorage => {
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

const createFailingStorage = (): DeploymentValidatorStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('DeploymentValidator handler', () => {
  describe('parse', () => {
    it('returns ok with manifest id for valid JSON', async () => {
      const storage = createTestStorage();
      const manifest = JSON.stringify({
        name: 'my-app',
        version: '1.0.0',
        target: 'production',
        concepts: ['concept-a'],
      });
      const result = await deploymentValidatorHandler.parse(
        { raw: manifest },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.manifest).toBeTruthy();
        }
      }
    });

    it('returns error for invalid JSON', async () => {
      const storage = createTestStorage();
      const result = await deploymentValidatorHandler.parse(
        { raw: 'not json' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('returns error for missing required fields', async () => {
      const storage = createTestStorage();
      const result = await deploymentValidatorHandler.parse(
        { raw: JSON.stringify({ name: 'test' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('returns left on storage failure for valid manifest', async () => {
      const storage = createFailingStorage();
      const manifest = JSON.stringify({
        name: 'my-app',
        version: '1.0.0',
        target: 'production',
        concepts: ['concept-a'],
      });
      const result = await deploymentValidatorHandler.parse(
        { raw: manifest },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('validate', () => {
    it('returns error when manifest not found', async () => {
      const storage = createTestStorage();
      const result = await deploymentValidatorHandler.validate(
        { manifest: 'missing', concepts: [], syncs: [] },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await deploymentValidatorHandler.validate(
        { manifest: 'test', concepts: [], syncs: [] },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
