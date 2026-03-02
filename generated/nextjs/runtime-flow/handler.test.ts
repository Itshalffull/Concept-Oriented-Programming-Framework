// RuntimeFlow — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { runtimeFlowHandler } from './handler.js';
import type { RuntimeFlowStorage } from './types.js';

const createTestStorage = (): RuntimeFlowStorage => {
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

const createFailingStorage = (): RuntimeFlowStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = runtimeFlowHandler;

describe('RuntimeFlow handler', () => {
  describe('correlate', () => {
    it('should return notfound when no flow steps exist', async () => {
      const storage = createTestStorage();
      const result = await handler.correlate({ flowId: 'flow-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should correlate flow steps into a complete flow', async () => {
      const storage = createTestStorage();
      await storage.put('flow_step', 'step-1', { flowId: 'flow-1', action: 'create', resolved: 'true', deviated: 'false' });
      await storage.put('flow_step', 'step-2', { flowId: 'flow-1', action: 'notify', resolved: 'true', deviated: 'false' });
      const result = await handler.correlate({ flowId: 'flow-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return partial when unresolved steps exist', async () => {
      const storage = createTestStorage();
      await storage.put('flow_step', 'step-1', { flowId: 'flow-2', action: 'create', resolved: 'true', deviated: 'false' });
      await storage.put('flow_step', 'step-2', { flowId: 'flow-2', action: 'unknown', resolved: 'false', deviated: 'false', symbol: 'unknown-sym' });
      const result = await handler.correlate({ flowId: 'flow-2' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('partial');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.correlate({ flowId: 'x' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('findByAction', () => {
    it('should return flows that contain the action', async () => {
      const storage = createTestStorage();
      await storage.put('flow_step', 's1', { flowId: 'f1', action: 'create' });
      await storage.put('flow', 'flow_f1', { id: 'flow_f1', flowId: 'f1', status: 'complete' });
      const result = await handler.findByAction({ action: 'create', since: '2026-01-01' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('findBySync', () => {
    it('should return flows that contain the sync', async () => {
      const storage = createTestStorage();
      await storage.put('flow_step', 's1', { flowId: 'f1', sync: 'order-notify' });
      const result = await handler.findBySync({ sync: 'order-notify', since: '2026-01-01' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('findByVariant', () => {
    it('should return flows that contain the variant', async () => {
      const storage = createTestStorage();
      await storage.put('flow_step', 's1', { flowId: 'f1', variant: 'ok' });
      const result = await handler.findByVariant({ variant: 'ok', since: '2026-01-01' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('findFailures', () => {
    it('should return failed flows', async () => {
      const storage = createTestStorage();
      await storage.put('flow', 'flow_f1', { id: 'flow_f1', flowId: 'f1', status: 'failed', stepCount: 3, deviationCount: 1 });
      const result = await handler.findFailures({ since: '2026-01-01' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const flows = JSON.parse(result.right.flows);
        expect(flows.length).toBe(1);
      }
    });

    it('should return empty when no failures', async () => {
      const storage = createTestStorage();
      const result = await handler.findFailures({ since: '2026-01-01' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const flows = JSON.parse(result.right.flows);
        expect(flows.length).toBe(0);
      }
    });
  });

  describe('compareToStatic', () => {
    it('should return noStaticPath when flow not found', async () => {
      const storage = createTestStorage();
      const result = await handler.compareToStatic({ flow: 'missing-flow' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('noStaticPath');
      }
    });
  });

  describe('sourceLocations', () => {
    it('should return empty locations for non-existent flow', async () => {
      const storage = createTestStorage();
      const result = await handler.sourceLocations({ flow: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const locations = JSON.parse(result.right.locations);
        expect(locations).toEqual([]);
      }
    });
  });

  describe('get', () => {
    it('should return flow data when it exists', async () => {
      const storage = createTestStorage();
      await storage.put('flow', 'flow_f1', { id: 'flow_f1', flowId: 'f1', status: 'complete', stepCount: 3, deviationCount: 0 });
      const result = await handler.get({ flow: 'flow_f1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.status).toBe('complete');
          expect(result.right.stepCount).toBe(3);
        }
      }
    });

    it('should return notfound for missing flow', async () => {
      const storage = createTestStorage();
      const result = await handler.get({ flow: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
