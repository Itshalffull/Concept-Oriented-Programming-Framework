// LocalRuntime — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { localRuntimeHandler } from './handler.js';
import type { LocalRuntimeStorage } from './types.js';

const createTestStorage = (): LocalRuntimeStorage => {
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

const createFailingStorage = (): LocalRuntimeStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = localRuntimeHandler;

describe('LocalRuntime handler', () => {
  describe('provision', () => {
    it('should provision a new process', async () => {
      const storage = createTestStorage();
      const result = await handler.provision(
        { concept: 'my-app', command: 'npm start', port: 3000 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.process).toBe('local-my-app');
          expect(result.right.endpoint).toBe('http://localhost:3000');
          expect(result.right.pid).toBeGreaterThan(0);
        }
      }
    });

    it('should detect port conflicts', async () => {
      const storage = createTestStorage();
      await handler.provision(
        { concept: 'first', command: 'npm start', port: 4000 },
        storage,
      )();
      const result = await handler.provision(
        { concept: 'second', command: 'npm start', port: 4000 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('portInUse');
        if (result.right.variant === 'portInUse') {
          expect(result.right.port).toBe(4000);
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.provision(
        { concept: 'fail', command: 'cmd', port: 5000 },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('deploy', () => {
    it('should deploy a new command to an existing process', async () => {
      const storage = createTestStorage();
      await handler.provision(
        { concept: 'deploy-test', command: 'npm start', port: 6000 },
        storage,
      )();
      const result = await handler.deploy(
        { process: 'local-deploy-test', command: 'npm run dev' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.process).toBe('local-deploy-test');
        }
      }
    });

    it('should return left for non-existent process', async () => {
      const storage = createTestStorage();
      const result = await handler.deploy(
        { process: 'nonexistent', command: 'cmd' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('setTrafficWeight', () => {
    it('should set traffic weight on a process', async () => {
      const storage = createTestStorage();
      await handler.provision(
        { concept: 'weight-test', command: 'cmd', port: 7000 },
        storage,
      )();
      const result = await handler.setTrafficWeight(
        { process: 'local-weight-test', weight: 50 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left for non-existent process', async () => {
      const storage = createTestStorage();
      const result = await handler.setTrafficWeight(
        { process: 'missing', weight: 50 },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('rollback', () => {
    it('should rollback to a previous command', async () => {
      const storage = createTestStorage();
      await handler.provision(
        { concept: 'rollback-test', command: 'npm start', port: 8000 },
        storage,
      )();
      const result = await handler.rollback(
        { process: 'local-rollback-test', previousCommand: 'npm start' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left for non-existent process', async () => {
      const storage = createTestStorage();
      const result = await handler.rollback(
        { process: 'nope', previousCommand: 'cmd' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should destroy an existing process and free port', async () => {
      const storage = createTestStorage();
      await handler.provision(
        { concept: 'destroy-test', command: 'cmd', port: 9000 },
        storage,
      )();
      const result = await handler.destroy(
        { process: 'local-destroy-test' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return left for non-existent process', async () => {
      const storage = createTestStorage();
      const result = await handler.destroy({ process: 'missing' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
