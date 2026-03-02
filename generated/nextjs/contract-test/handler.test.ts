// ContractTest — handler.test.ts
// Unit tests for contractTest handler actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';

import { contractTestHandler } from './handler.js';
import type { ContractTestStorage } from './types.js';

const createTestStorage = (): ContractTestStorage => {
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

const createFailingStorage = (): ContractTestStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ContractTest handler', () => {
  describe('generate', () => {
    it('returns ok with contract id and definition when specPath is valid', async () => {
      const storage = createTestStorage();
      const result = await contractTestHandler.generate(
        { concept: 'my-concept', specPath: '/specs/my-concept.yaml' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.contract).toBe('my-concept-contract');
          expect(result.right.definition.actions.length).toBeGreaterThan(0);
        }
      }
    });

    it('returns specError when specPath is empty', async () => {
      const storage = createTestStorage();
      const result = await contractTestHandler.generate(
        { concept: 'my-concept', specPath: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('specError');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await contractTestHandler.generate(
        { concept: 'my-concept', specPath: '/specs/my-concept.yaml' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('verify', () => {
    it('returns ok when contract exists and artifacts are available', async () => {
      const storage = createTestStorage();
      await contractTestHandler.generate(
        { concept: 'my-concept', specPath: '/specs/my-concept.yaml' },
        storage,
      )();
      const result = await contractTestHandler.verify(
        {
          contract: 'my-concept-contract',
          producerArtifact: 'available',
          producerLanguage: 'typescript',
          consumerArtifact: 'available',
          consumerLanguage: 'rust',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.contract).toBe('my-concept-contract');
          expect(result.right.passed).toBe(result.right.total);
        }
      }
    });

    it('returns producerUnavailable when contract not found', async () => {
      const storage = createTestStorage();
      const result = await contractTestHandler.verify(
        {
          contract: 'missing-contract',
          producerArtifact: 'available',
          producerLanguage: 'typescript',
          consumerArtifact: 'available',
          consumerLanguage: 'rust',
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('producerUnavailable');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await contractTestHandler.verify(
        {
          contract: 'test',
          producerArtifact: 'available',
          producerLanguage: 'typescript',
          consumerArtifact: 'available',
          consumerLanguage: 'rust',
        },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('matrix', () => {
    it('returns ok with matrix data', async () => {
      const storage = createTestStorage();
      const result = await contractTestHandler.matrix(
        { concepts: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await contractTestHandler.matrix(
        { concepts: O.none },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('canDeploy', () => {
    it('returns unverified when no verifications exist', async () => {
      const storage = createTestStorage();
      const result = await contractTestHandler.canDeploy(
        { concept: 'my-concept', language: 'typescript' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unverified');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await contractTestHandler.canDeploy(
        { concept: 'my-concept', language: 'typescript' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
