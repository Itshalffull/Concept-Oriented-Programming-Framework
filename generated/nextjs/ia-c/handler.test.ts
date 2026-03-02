// IaC — handler.test.ts
// Unit tests for iaC handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { iaCHandler } from './handler.js';
import type { IaCStorage } from './types.js';

const createTestStorage = (): IaCStorage => {
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

const createFailingStorage = (): IaCStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('IaC handler', () => {
  describe('emit', () => {
    it('should emit IaC output for a supported provider', async () => {
      const storage = createTestStorage();
      const input = {
        plan: JSON.stringify({ resources: [{ type: 'aws_s3_bucket' }] }),
        provider: 'terraform',
      };

      const result = await iaCHandler.emit(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.fileCount).toBeGreaterThan(0);
        }
      }
    });

    it('should return unsupportedResource for an unknown provider', async () => {
      const storage = createTestStorage();
      const input = {
        plan: JSON.stringify({ resources: [] }),
        provider: 'unsupported-provider',
      };

      const result = await iaCHandler.emit(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unsupportedResource');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const input = { plan: '{}', provider: 'terraform' };
      const result = await iaCHandler.emit(input, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('preview', () => {
    it('should preview resources to create with no existing state', async () => {
      const storage = createTestStorage();
      const input = {
        plan: JSON.stringify({ resources: [{ type: 'aws_lambda' }, { type: 'aws_sqs' }] }),
        provider: 'terraform',
      };

      const result = await iaCHandler.preview(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.toCreate.length).toBe(2);
          expect(result.right.toUpdate.length).toBe(0);
        }
      }
    });

    it('should detect corrupted state', async () => {
      const storage = createTestStorage();
      await storage.put('iac_state', 'terraform', {
        corrupted: true,
        corruptionReason: 'checksum mismatch',
      });
      const input = {
        plan: JSON.stringify({ resources: [] }),
        provider: 'terraform',
      };

      const result = await iaCHandler.preview(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('stateCorrupted');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await iaCHandler.preview({ plan: '{}', provider: 'terraform' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('apply', () => {
    it('should apply a plan and update state', async () => {
      const storage = createTestStorage();
      const input = {
        plan: JSON.stringify({ resources: [{ type: 'aws_s3' }] }),
        provider: 'terraform',
      };

      const result = await iaCHandler.apply(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.created).toContain('aws_s3');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await iaCHandler.apply({ plan: '{}', provider: 'terraform' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('detectDrift', () => {
    it('should return noDrift when no state exists', async () => {
      const storage = createTestStorage();
      const input = { provider: 'terraform' };

      const result = await iaCHandler.detectDrift(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noDrift');
      }
    });

    it('should detect drifted resources', async () => {
      const storage = createTestStorage();
      await storage.put('iac_state', 'terraform', {
        resources: ['aws_s3', 'aws_lambda'],
      });
      // Only aws_s3 is live
      await storage.put('iac_live', 'live-s3', {
        provider: 'terraform',
        type: 'aws_s3',
      });

      const result = await iaCHandler.detectDrift({ provider: 'terraform' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.drifted).toContain('aws_lambda');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await iaCHandler.detectDrift({ provider: 'x' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('teardown', () => {
    it('should teardown and return destroyed resources', async () => {
      const storage = createTestStorage();
      await storage.put('iac_state', 'terraform', {
        resources: ['aws_s3', 'aws_lambda'],
      });

      const result = await iaCHandler.teardown({
        plan: '{}', provider: 'terraform',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.destroyed).toContain('aws_s3');
          expect(result.right.destroyed).toContain('aws_lambda');
        }
      }
    });

    it('should return ok with empty destroyed when no state', async () => {
      const storage = createTestStorage();
      const result = await iaCHandler.teardown({
        plan: '{}', provider: 'terraform',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.destroyed).toHaveLength(0);
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await iaCHandler.teardown({ plan: '{}', provider: 'x' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
