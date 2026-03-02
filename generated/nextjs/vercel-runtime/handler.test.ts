// VercelRuntime — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { vercelRuntimeHandler } from './handler.js';
import type { VercelRuntimeStorage } from './types.js';

const createTestStorage = (): VercelRuntimeStorage => {
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

const createFailingStorage = (): VercelRuntimeStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = vercelRuntimeHandler;

describe('VercelRuntime handler', () => {
  describe('provision', () => {
    it('should provision a new project successfully', async () => {
      const storage = createTestStorage();
      const result = await handler.provision(
        { concept: 'my-app', teamId: 'team-1', framework: 'nextjs' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.project).toBe('prj-my-app');
          expect(result.right.projectId).toContain('my-app');
          expect(result.right.endpoint).toContain('my-app.vercel.app');
        }
      }
    });

    it('should return domainConflict when domain already exists', async () => {
      const storage = createTestStorage();
      await handler.provision(
        { concept: 'conflict-app', teamId: 'team-1', framework: 'nextjs' },
        storage,
      )();
      const result = await handler.provision(
        { concept: 'conflict-app', teamId: 'team-2', framework: 'nextjs' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('domainConflict');
        if (result.right.variant === 'domainConflict') {
          expect(result.right.domain).toContain('conflict-app');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.provision(
        { concept: 'fail', teamId: 'team-1', framework: 'nextjs' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('deploy', () => {
    it('should deploy to an existing project', async () => {
      const storage = createTestStorage();
      await handler.provision(
        { concept: 'deploy-app', teamId: 'team-1', framework: 'nextjs' },
        storage,
      )();
      const result = await handler.deploy(
        { project: 'prj-deploy-app', sourceDirectory: '/src' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.project).toBe('prj-deploy-app');
          expect(result.right.deploymentId).toBeDefined();
          expect(result.right.deploymentUrl).toContain('vercel.app');
        }
      }
    });

    it('should return left when project does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.deploy(
        { project: 'nonexistent', sourceDirectory: '/src' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('PROJECT_NOT_FOUND');
      }
    });

    it('should return buildFailed when source directory is empty', async () => {
      const storage = createTestStorage();
      await handler.provision(
        { concept: 'empty-src', teamId: 'team-1', framework: 'nextjs' },
        storage,
      )();
      const result = await handler.deploy(
        { project: 'prj-empty-src', sourceDirectory: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('buildFailed');
        if (result.right.variant === 'buildFailed') {
          expect(result.right.errors).toContain('Source directory is empty');
        }
      }
    });

    it('should increment deployment count', async () => {
      const storage = createTestStorage();
      await handler.provision(
        { concept: 'multi-deploy', teamId: 'team-1', framework: 'nextjs' },
        storage,
      )();
      await handler.deploy({ project: 'prj-multi-deploy', sourceDirectory: '/src' }, storage)();
      await handler.deploy({ project: 'prj-multi-deploy', sourceDirectory: '/src' }, storage)();
      const project = await storage.get('projects', 'prj-multi-deploy');
      expect(project).not.toBeNull();
      expect(project!.deploymentCount).toBe(2);
    });
  });

  describe('setTrafficWeight', () => {
    it('should set traffic weight on existing project', async () => {
      const storage = createTestStorage();
      await handler.provision(
        { concept: 'weight-app', teamId: 'team-1', framework: 'nextjs' },
        storage,
      )();
      const result = await handler.setTrafficWeight(
        { project: 'prj-weight-app', weight: 50 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should clamp weight to 0-100 range', async () => {
      const storage = createTestStorage();
      await handler.provision(
        { concept: 'clamp-app', teamId: 'team-1', framework: 'nextjs' },
        storage,
      )();
      await handler.setTrafficWeight(
        { project: 'prj-clamp-app', weight: 150 },
        storage,
      )();
      const project = await storage.get('projects', 'prj-clamp-app');
      expect(project!.weight).toBe(100);

      await handler.setTrafficWeight(
        { project: 'prj-clamp-app', weight: -10 },
        storage,
      )();
      const updated = await storage.get('projects', 'prj-clamp-app');
      expect(updated!.weight).toBe(0);
    });

    it('should return left when project does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.setTrafficWeight(
        { project: 'nonexistent', weight: 50 },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('rollback', () => {
    it('should rollback to a previous deployment', async () => {
      const storage = createTestStorage();
      await handler.provision(
        { concept: 'rollback-app', teamId: 'team-1', framework: 'nextjs' },
        storage,
      )();
      const deploy1 = await handler.deploy(
        { project: 'prj-rollback-app', sourceDirectory: '/v1' },
        storage,
      )();
      expect(E.isRight(deploy1)).toBe(true);
      let firstDeployId = '';
      if (E.isRight(deploy1) && deploy1.right.variant === 'ok') {
        firstDeployId = deploy1.right.deploymentId;
      }
      await handler.deploy(
        { project: 'prj-rollback-app', sourceDirectory: '/v2' },
        storage,
      )();

      const result = await handler.rollback(
        { project: 'prj-rollback-app', targetDeploymentId: firstDeployId },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.restoredDeploymentId).toBe(firstDeployId);
      }
    });

    it('should return left when deployment not found', async () => {
      const storage = createTestStorage();
      const result = await handler.rollback(
        { project: 'prj-rollback-app', targetDeploymentId: 'nonexistent' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should destroy an existing project', async () => {
      const storage = createTestStorage();
      await handler.provision(
        { concept: 'destroy-app', teamId: 'team-1', framework: 'nextjs' },
        storage,
      )();
      const result = await handler.destroy(
        { project: 'prj-destroy-app' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.project).toBe('prj-destroy-app');
      }
      const deleted = await storage.get('projects', 'prj-destroy-app');
      expect(deleted).toBeNull();
    });

    it('should return left when project does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.destroy(
        { project: 'nonexistent' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
