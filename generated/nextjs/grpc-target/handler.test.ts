// GrpcTarget — handler.test.ts
// Unit tests for grpcTarget handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { grpcTargetHandler } from './handler.js';
import type { GrpcTargetStorage } from './types.js';

const createTestStorage = (): GrpcTargetStorage => {
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

const createFailingStorage = (): GrpcTargetStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('GrpcTarget handler', () => {
  describe('generate', () => {
    it('should generate a proto service from a JSON projection', async () => {
      const storage = createTestStorage();
      const input = {
        projection: JSON.stringify({
          concept: 'user',
          fields: [{ name: 'id', type: 'string', number: 1 }],
          actions: ['create', 'get', 'list'],
        }),
        config: '{}',
      };

      const result = await grpcTargetHandler.generate(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.services).toContain('UserService');
          expect(result.right.files).toContain('user.proto');
        }
      }
    });

    it('should generate default actions from a plain string projection', async () => {
      const storage = createTestStorage();
      const input = { projection: 'order', config: '{}' };

      const result = await grpcTargetHandler.generate(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.services).toContain('OrderService');
          expect(result.right.files).toContain('order.proto');
        }
      }
    });

    it('should return protoIncompatible for unsupported field types', async () => {
      const storage = createTestStorage();
      const input = {
        projection: JSON.stringify({
          concept: 'bad',
          fields: [{ name: 'fn', type: 'function', number: 1 }],
          actions: ['create'],
        }),
        config: '{}',
      };

      const result = await grpcTargetHandler.generate(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('protoIncompatible');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const input = { projection: 'test', config: '{}' };

      const result = await grpcTargetHandler.generate(input, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('validate', () => {
    it('should return ok for a service with no field conflicts', async () => {
      const storage = createTestStorage();
      const input = { service: 'UserService' };

      const result = await grpcTargetHandler.validate(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should detect reserved field number conflicts', async () => {
      const storage = createTestStorage();
      // Pre-populate a service with reserved-range field numbers
      await storage.put('services', 'BadService', {
        concept: 'bad',
        serviceName: 'BadService',
        rpcs: [],
        streamingModes: [],
        fields: [{ name: 'reserved', type: 'string', number: 19000 }],
      });
      const input = { service: 'BadService' };

      const result = await grpcTargetHandler.validate(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('fieldNumberConflict');
      }
    });

    it('should detect duplicate field numbers', async () => {
      const storage = createTestStorage();
      await storage.put('services', 'DupService', {
        concept: 'dup',
        serviceName: 'DupService',
        rpcs: [],
        streamingModes: [],
        fields: [
          { name: 'a', type: 'string', number: 1 },
          { name: 'b', type: 'int32', number: 1 },
        ],
      });
      const input = { service: 'DupService' };

      const result = await grpcTargetHandler.validate(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('fieldNumberConflict');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await grpcTargetHandler.validate({ service: 'X' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('listRpcs', () => {
    it('should return rpcs and streaming modes from stored services', async () => {
      const storage = createTestStorage();
      await storage.put('services', 'TestService', {
        concept: 'test',
        rpcs: ['Create', 'List'],
        streamingModes: ['unary', 'server-streaming'],
      });
      const input = { concept: 'test' };

      const result = await grpcTargetHandler.listRpcs(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.rpcs.length).toBeGreaterThan(0);
      }
    });

    it('should return empty lists for unknown concept', async () => {
      const storage = createTestStorage();
      const input = { concept: 'nonexistent' };

      const result = await grpcTargetHandler.listRpcs(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.rpcs).toHaveLength(0);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await grpcTargetHandler.listRpcs({ concept: 'x' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
