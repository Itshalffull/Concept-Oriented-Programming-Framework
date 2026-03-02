// Runtime — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { runtimeHandler } from './handler.js';
import type { RuntimeStorage } from './types.js';

const createTestStorage = (): RuntimeStorage => {
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

const createFailingStorage = (): RuntimeStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = runtimeHandler;

describe('Runtime handler', () => {
  describe('provision', () => {
    it('should provision a new runtime instance', async () => {
      const storage = createTestStorage();
      const result = await handler.provision(
        { concept: 'order', runtimeType: 'node', config: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toContain('node-order');
          expect(result.right.endpoint).toContain('order');
        }
      }
    });

    it('should return alreadyProvisioned for existing concept', async () => {
      const storage = createTestStorage();
      await handler.provision({ concept: 'order', runtimeType: 'node', config: '{}' }, storage)();
      const result = await handler.provision({ concept: 'order', runtimeType: 'node', config: '{}' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('alreadyProvisioned');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.provision({ concept: 'x', runtimeType: 'node', config: '{}' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('deploy', () => {
    it('should deploy to a provisioned instance', async () => {
      const storage = createTestStorage();
      const provResult = await handler.provision({ concept: 'order', runtimeType: 'node', config: '{}' }, storage)();
      const instanceId = E.isRight(provResult) && provResult.right.variant === 'ok' ? provResult.right.instance : '';
      // Store with instance as key
      await storage.put('runtime_instances', instanceId, {
        instanceId, concept: 'order', runtimeType: 'node', endpoint: 'https://node.runtime.local/order', status: 'provisioned',
      });
      const result = await handler.deploy({ instance: instanceId, artifact: 'order.js', version: '1.0.0' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return deployFailed for non-existent instance', async () => {
      const storage = createTestStorage();
      const result = await handler.deploy({ instance: 'nonexistent', artifact: 'x.js', version: '1.0' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('deployFailed');
      }
    });
  });

  describe('setTrafficWeight', () => {
    it('should clamp weight between 0 and 100', async () => {
      const storage = createTestStorage();
      await storage.put('runtime_instances', 'inst-1', { instanceId: 'inst-1', status: 'deployed', endpoint: 'http://x' });
      const result = await handler.setTrafficWeight({ instance: 'inst-1', weight: 150 }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.newWeight).toBe(100);
      }
    });

    it('should return left for non-existent instance', async () => {
      const storage = createTestStorage();
      const result = await handler.setTrafficWeight({ instance: 'missing', weight: 50 }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('rollback', () => {
    it('should return noHistory when no previous version exists', async () => {
      const storage = createTestStorage();
      await storage.put('runtime_instances', 'inst-1', { instanceId: 'inst-1', status: 'deployed', endpoint: 'http://x' });
      const result = await handler.rollback({ instance: 'inst-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noHistory');
      }
    });

    it('should rollback when previous version exists', async () => {
      const storage = createTestStorage();
      await storage.put('runtime_instances', 'inst-1', {
        instanceId: 'inst-1', status: 'deployed', endpoint: 'http://x', version: '2.0', previousVersion: '1.0',
      });
      const result = await handler.rollback({ instance: 'inst-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.previousVersion).toBe('1.0');
        }
      }
    });
  });

  describe('destroy', () => {
    it('should destroy an existing instance', async () => {
      const storage = createTestStorage();
      await storage.put('runtime_instances', 'inst-1', { instanceId: 'inst-1', status: 'deployed' });
      const result = await handler.destroy({ instance: 'inst-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return destroyFailed for non-existent instance', async () => {
      const storage = createTestStorage();
      const result = await handler.destroy({ instance: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('destroyFailed');
      }
    });
  });

  describe('healthCheck', () => {
    it('should return ok for a deployed instance', async () => {
      const storage = createTestStorage();
      await storage.put('runtime_instances', 'inst-1', { instanceId: 'inst-1', status: 'deployed' });
      const result = await handler.healthCheck({ instance: 'inst-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return unreachable for non-existent instance', async () => {
      const storage = createTestStorage();
      const result = await handler.healthCheck({ instance: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unreachable');
      }
    });

    it('should return degraded for non-standard status', async () => {
      const storage = createTestStorage();
      await storage.put('runtime_instances', 'inst-1', { instanceId: 'inst-1', status: 'draining' });
      const result = await handler.healthCheck({ instance: 'inst-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('degraded');
      }
    });
  });
});
