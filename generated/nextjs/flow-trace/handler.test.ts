// FlowTrace — handler.test.ts
// Unit tests for flowTrace handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { flowTraceHandler } from './handler.js';
import type { FlowTraceStorage } from './types.js';

const createTestStorage = (): FlowTraceStorage => {
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

const createFailingStorage = (): FlowTraceStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const seedFlowEvents = async (storage: FlowTraceStorage, flowId: string): Promise<void> => {
  await storage.put('flow_events', `${flowId}-e1`, {
    flowId,
    eventId: 'e1',
    concept: 'Auth',
    action: 'login',
    variant: 'ok',
    durationMs: 10,
    timestamp: 1,
    gated: false,
  });
  await storage.put('flow_events', `${flowId}-e2`, {
    flowId,
    eventId: 'e2',
    concept: 'Token',
    action: 'issue',
    variant: 'ok',
    durationMs: 5,
    timestamp: 2,
    gated: true,
  });
};

describe('FlowTrace handler', () => {
  describe('build', () => {
    it('should build a trace from flow events', async () => {
      const storage = createTestStorage();
      await seedFlowEvents(storage, 'flow-1');
      const result = await flowTraceHandler.build({ flowId: 'flow-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.trace).toContain('flow-1');
          expect(result.right.tree).toBeDefined();
        }
      }
    });

    it('should return error variant when no events exist', async () => {
      const storage = createTestStorage();
      const result = await flowTraceHandler.build({ flowId: 'no-events' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await flowTraceHandler.build({ flowId: 'flow-1' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('render', () => {
    it('should render a trace in text format', async () => {
      const storage = createTestStorage();
      await seedFlowEvents(storage, 'flow-1');
      const buildResult = await flowTraceHandler.build({ flowId: 'flow-1' }, storage)();
      expect(E.isRight(buildResult)).toBe(true);
      if (E.isRight(buildResult) && buildResult.right.variant === 'ok') {
        const renderResult = await flowTraceHandler.render(
          { trace: buildResult.right.trace, options: { format: 'text' } },
          storage,
        )();
        expect(E.isRight(renderResult)).toBe(true);
        if (E.isRight(renderResult)) {
          expect(renderResult.right.variant).toBe('ok');
          expect(renderResult.right.output).toContain('Auth.login');
        }
      }
    });

    it('should render a trace in mermaid format', async () => {
      const storage = createTestStorage();
      await seedFlowEvents(storage, 'flow-1');
      const buildResult = await flowTraceHandler.build({ flowId: 'flow-1' }, storage)();
      if (E.isRight(buildResult) && buildResult.right.variant === 'ok') {
        const renderResult = await flowTraceHandler.render(
          { trace: buildResult.right.trace, options: { format: 'mermaid' } },
          storage,
        )();
        expect(E.isRight(renderResult)).toBe(true);
        if (E.isRight(renderResult)) {
          expect(renderResult.right.output).toContain('graph TD');
        }
      }
    });

    it('should render a trace in json format', async () => {
      const storage = createTestStorage();
      await seedFlowEvents(storage, 'flow-1');
      const buildResult = await flowTraceHandler.build({ flowId: 'flow-1' }, storage)();
      if (E.isRight(buildResult) && buildResult.right.variant === 'ok') {
        const renderResult = await flowTraceHandler.render(
          { trace: buildResult.right.trace, options: { format: 'json' } },
          storage,
        )();
        expect(E.isRight(renderResult)).toBe(true);
        if (E.isRight(renderResult)) {
          const parsed = JSON.parse(renderResult.right.output);
          expect(parsed).toHaveProperty('concept');
        }
      }
    });

    it('should handle a missing trace gracefully', async () => {
      const storage = createTestStorage();
      const result = await flowTraceHandler.render(
        { trace: 'nonexistent', options: {} },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.output).toContain('No trace data found');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await flowTraceHandler.render(
        { trace: 'trace-1', options: {} },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
