// PulumiProvider — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { pulumiProviderHandler } from './handler.js';
import type { PulumiProviderStorage } from './types.js';

const createTestStorage = (): PulumiProviderStorage => {
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

const createFailingStorage = (): PulumiProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = pulumiProviderHandler;

describe('PulumiProvider handler', () => {
  describe('generate', () => {
    it('should generate a stack from a deploy plan', async () => {
      const storage = createTestStorage();
      const plan = {
        stack: 'my-stack',
        resources: [{ type: 'aws:s3:Bucket' }],
        plugins: [{ name: 'aws', version: '5.0.0' }],
      };
      const result = await handler.generate(
        { plan: JSON.stringify(plan) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.stack).toBe('my-stack');
        expect(result.right.files.length).toBeGreaterThan(0);
      }
    });

    it('should assign a default stack name when not provided', async () => {
      const storage = createTestStorage();
      const plan = { resources: [] };
      const result = await handler.generate(
        { plan: JSON.stringify(plan) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.stack).toContain('pulumi-stack-');
      }
    });

    it('should return left for invalid JSON plan', async () => {
      const storage = createTestStorage();
      const result = await handler.generate({ plan: 'not-json' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('preview', () => {
    it('should return backendUnreachable when stack not found', async () => {
      const storage = createTestStorage();
      const result = await handler.preview({ stack: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('backendUnreachable');
      }
    });

    it('should preview changes for a generated stack', async () => {
      const storage = createTestStorage();
      const plan = {
        stack: 'preview-stack',
        resources: [{ type: 'aws:s3:Bucket' }, { type: 'aws:lambda:Function' }],
      };
      await handler.generate({ plan: JSON.stringify(plan) }, storage)();

      const result = await handler.preview({ stack: 'preview-stack' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.toCreate).toBe(2);
          expect(result.right.estimatedCost).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('apply', () => {
    it('should return pluginMissing when stack not found', async () => {
      const storage = createTestStorage();
      const result = await handler.apply({ stack: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('pluginMissing');
      }
    });

    it('should apply a stack and return created resources', async () => {
      const storage = createTestStorage();
      const plan = {
        stack: 'apply-stack',
        resources: [{ type: 'aws:s3:Bucket' }],
        plugins: [{ name: 'aws', version: '5.0.0' }],
      };
      await handler.generate({ plan: JSON.stringify(plan) }, storage)();

      const result = await handler.apply({ stack: 'apply-stack' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.created).toContain('aws:s3:Bucket');
        }
      }
    });

    it('should detect missing plugins', async () => {
      const storage = createTestStorage();
      const plan = {
        stack: 'plugin-stack',
        resources: [{ type: 'aws:s3:Bucket' }],
        plugins: [{ name: 'aws', version: 'missing' }],
      };
      await handler.generate({ plan: JSON.stringify(plan) }, storage)();

      const result = await handler.apply({ stack: 'plugin-stack' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('pluginMissing');
      }
    });

    it('should detect conflicting updates with pending ops', async () => {
      const storage = createTestStorage();
      const plan = {
        stack: 'conflict-stack',
        resources: [{ type: 'aws:s3:Bucket' }],
        plugins: [],
      };
      await handler.generate({ plan: JSON.stringify(plan) }, storage)();

      // Inject pending ops into the stored stack
      const stackRec = await storage.get('pulumi_stacks', 'conflict-stack');
      if (stackRec) {
        await storage.put('pulumi_stacks', 'conflict-stack', {
          ...stackRec,
          pendingOps: ['op1'],
        });
      }

      const result = await handler.apply({ stack: 'conflict-stack' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('conflictingUpdate');
      }
    });
  });

  describe('teardown', () => {
    it('should return ok with empty destroyed for unknown stack', async () => {
      const storage = createTestStorage();
      const result = await handler.teardown({ stack: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.destroyed).toEqual([]);
        }
      }
    });

    it('should detect protected resources and prevent teardown', async () => {
      const storage = createTestStorage();
      const plan = {
        stack: 'protected-stack',
        resources: [{ type: 'aws:rds:Instance', protect: true }],
        plugins: [],
      };
      await handler.generate({ plan: JSON.stringify(plan) }, storage)();

      const result = await handler.teardown({ stack: 'protected-stack' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('protectedResource');
      }
    });

    it('should teardown an unprotected stack', async () => {
      const storage = createTestStorage();
      const plan = {
        stack: 'teardown-stack',
        resources: [{ type: 'aws:s3:Bucket' }],
        plugins: [],
      };
      await handler.generate({ plan: JSON.stringify(plan) }, storage)();
      await handler.apply({ stack: 'teardown-stack' }, storage)();

      const result = await handler.teardown({ stack: 'teardown-stack' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });
});
