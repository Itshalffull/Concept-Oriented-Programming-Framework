// ============================================================
// RuntimeFlow Handler Tests
//
// Tests for runtime-flow: correlation of action-log entries
// to static entities, action/sync/variant queries, failure
// detection, static path comparison, source location lookup,
// and retrieval.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  runtimeFlowHandler,
  resetRuntimeFlowCounter,
} from '../handlers/ts/runtime-flow.handler.js';

describe('RuntimeFlow Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetRuntimeFlowCounter();
  });

  // ----------------------------------------------------------
  // correlate
  // ----------------------------------------------------------

  describe('correlate', () => {
    it('correlates action-log entries into an enriched flow', async () => {
      // Seed concept and action entities
      await storage.put('concept-entity', 'ce-1', { id: 'ce-1', name: 'Todo' });
      await storage.put('action-entity', 'ae-1', {
        id: 'ae-1',
        concept: 'Todo',
        name: 'create',
      });

      // Seed action-log entries
      await storage.put('action-log', 'log-1', {
        id: 'log-1',
        flow: 'flow-1',
        concept: 'Todo',
        action: 'create',
        variant: 'ok',
        type: 'invocation',
        timestamp: '2024-01-01T00:00:01Z',
      });
      await storage.put('action-log', 'log-2', {
        id: 'log-2',
        flow: 'flow-1',
        concept: 'Todo',
        action: 'create',
        variant: 'ok',
        type: 'completion',
        timestamp: '2024-01-01T00:00:02Z',
      });

      const result = await runtimeFlowHandler.correlate({ flowId: 'flow-1' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.flow).toBe('runtime-flow-1');

      const record = await storage.get('runtime-flow', result.flow as string);
      expect(record!.flowId).toBe('flow-1');
      expect(record!.status).toBe('completed');
      expect(record!.stepCount).toBe(2);
    });

    it('returns partial when some entities cannot be resolved', async () => {
      // Seed action-log without matching concept-entity
      await storage.put('action-log', 'log-1', {
        id: 'log-1',
        flow: 'flow-2',
        concept: 'Unknown',
        action: 'doSomething',
        type: 'invocation',
      });

      const result = await runtimeFlowHandler.correlate({ flowId: 'flow-2' }, storage);
      expect(result.variant).toBe('partial');
      expect(result.flow).toBeTruthy();
      const unresolved = JSON.parse(result.unresolved as string);
      expect(unresolved.length).toBeGreaterThan(0);
    });

    it('returns notfound when no action-log entries exist for the flow', async () => {
      const result = await runtimeFlowHandler.correlate({ flowId: 'nonexistent' }, storage);
      expect(result.variant).toBe('notfound');
    });

    it('sets status to failed when a step has error variant', async () => {
      await storage.put('action-log', 'log-1', {
        id: 'log-1',
        flow: 'flow-err',
        concept: 'Todo',
        action: 'create',
        variant: 'error',
        type: 'completion',
      });

      const result = await runtimeFlowHandler.correlate({ flowId: 'flow-err' }, storage);
      const record = await storage.get('runtime-flow', result.flow as string);
      expect(record!.status).toBe('failed');
    });
  });

  // ----------------------------------------------------------
  // get
  // ----------------------------------------------------------

  describe('get', () => {
    it('returns flow details after correlation', async () => {
      await storage.put('action-log', 'log-1', {
        id: 'log-1',
        flow: 'flow-1',
        concept: 'Todo',
        action: 'create',
        type: 'invocation',
      });

      const corr = await runtimeFlowHandler.correlate({ flowId: 'flow-1' }, storage);
      const result = await runtimeFlowHandler.get({ flow: corr.flow }, storage);
      expect(result.variant).toBe('ok');
      expect(result.flowId).toBe('flow-1');
      expect(result.stepCount).toBe(1);
    });

    it('returns notfound for nonexistent flow', async () => {
      const result = await runtimeFlowHandler.get({ flow: 'nope' }, storage);
      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // findByAction
  // ----------------------------------------------------------

  describe('findByAction', () => {
    it('finds flows containing a specific action', async () => {
      await storage.put('action-log', 'log-1', {
        id: 'log-1',
        flow: 'flow-1',
        concept: 'Todo',
        action: 'create',
        type: 'invocation',
      });
      await runtimeFlowHandler.correlate({ flowId: 'flow-1' }, storage);

      await storage.put('action-log', 'log-2', {
        id: 'log-2',
        flow: 'flow-2',
        concept: 'User',
        action: 'signup',
        type: 'invocation',
      });
      await runtimeFlowHandler.correlate({ flowId: 'flow-2' }, storage);

      const result = await runtimeFlowHandler.findByAction({ action: 'create', since: '' }, storage);
      expect(result.variant).toBe('ok');
      const flows = JSON.parse(result.flows as string);
      expect(flows).toHaveLength(1);
      expect(flows[0].flowId).toBe('flow-1');
    });
  });

  // ----------------------------------------------------------
  // findBySync
  // ----------------------------------------------------------

  describe('findBySync', () => {
    it('finds flows containing a specific sync entity', async () => {
      // Seed a sync entity
      await storage.put('sync-entity', 'se-1', { id: 'se-1', name: 'onTodoCreate' });

      // Seed action-log with sync reference
      await storage.put('action-log', 'log-1', {
        id: 'log-1',
        flow: 'flow-1',
        concept: 'Todo',
        action: 'create',
        sync: 'onTodoCreate',
        type: 'invocation',
      });
      await runtimeFlowHandler.correlate({ flowId: 'flow-1' }, storage);

      const result = await runtimeFlowHandler.findBySync({ sync: 'se-1', since: '' }, storage);
      expect(result.variant).toBe('ok');
      const flows = JSON.parse(result.flows as string);
      expect(flows).toHaveLength(1);
    });
  });

  // ----------------------------------------------------------
  // findByVariant
  // ----------------------------------------------------------

  describe('findByVariant', () => {
    it('finds flows containing a specific variant', async () => {
      await storage.put('action-log', 'log-1', {
        id: 'log-1',
        flow: 'flow-1',
        concept: 'Todo',
        action: 'create',
        variant: 'ok',
        type: 'completion',
      });
      await runtimeFlowHandler.correlate({ flowId: 'flow-1' }, storage);

      const result = await runtimeFlowHandler.findByVariant({ variant: 'ok', since: '' }, storage);
      expect(result.variant).toBe('ok');
      const flows = JSON.parse(result.flows as string);
      expect(flows).toHaveLength(1);
    });

    it('returns empty when variant not found in any flow', async () => {
      const result = await runtimeFlowHandler.findByVariant({ variant: 'rare', since: '' }, storage);
      expect(result.variant).toBe('ok');
      expect(JSON.parse(result.flows as string)).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // findFailures
  // ----------------------------------------------------------

  describe('findFailures', () => {
    it('finds flows with failed status', async () => {
      await storage.put('action-log', 'log-ok', {
        id: 'log-ok',
        flow: 'flow-ok',
        concept: 'Todo',
        action: 'create',
        variant: 'ok',
        type: 'completion',
      });
      await runtimeFlowHandler.correlate({ flowId: 'flow-ok' }, storage);

      await storage.put('action-log', 'log-err', {
        id: 'log-err',
        flow: 'flow-err',
        concept: 'Todo',
        action: 'create',
        variant: 'error',
        type: 'completion',
      });
      await runtimeFlowHandler.correlate({ flowId: 'flow-err' }, storage);

      const result = await runtimeFlowHandler.findFailures({ since: '' }, storage);
      expect(result.variant).toBe('ok');
      const failures = JSON.parse(result.flows as string);
      expect(failures).toHaveLength(1);
      expect(failures[0].status).toBe('failed');
    });
  });

  // ----------------------------------------------------------
  // compareToStatic
  // ----------------------------------------------------------

  describe('compareToStatic', () => {
    it('returns noStaticPath when no flow-graph entry exists', async () => {
      await storage.put('action-log', 'log-1', {
        id: 'log-1',
        flow: 'flow-1',
        concept: 'Todo',
        action: 'create',
        type: 'invocation',
      });
      const corr = await runtimeFlowHandler.correlate({ flowId: 'flow-1' }, storage);

      const result = await runtimeFlowHandler.compareToStatic({ flow: corr.flow }, storage);
      expect(result.variant).toBe('noStaticPath');
    });

    it('returns noStaticPath for nonexistent flow', async () => {
      const result = await runtimeFlowHandler.compareToStatic({ flow: 'nope' }, storage);
      expect(result.variant).toBe('noStaticPath');
    });

    it('returns matches when actual steps match expected path', async () => {
      // Create action-log and correlate
      await storage.put('action-log', 'log-1', {
        id: 'log-1',
        flow: 'flow-1',
        concept: 'Todo',
        action: 'create',
        type: 'invocation',
        timestamp: '2024-01-01T00:00:00Z',
      });

      // Seed a flow-graph entry for the trigger
      await storage.put('flow-graph', 'fg-1', {
        id: 'fg-1',
        trigger: 'Todo/create',
        path: JSON.stringify([{ concept: 'Todo', action: 'create' }]),
      });

      // Seed concept entity so it resolves
      await storage.put('concept-entity', 'ce-1', { id: 'ce-1', name: 'Todo' });
      await storage.put('action-entity', 'ae-1', { id: 'ae-1', concept: 'Todo', name: 'create' });

      const corr = await runtimeFlowHandler.correlate({ flowId: 'flow-1' }, storage);
      const result = await runtimeFlowHandler.compareToStatic({ flow: corr.flow }, storage);
      expect(result.variant).toBe('matches');
      expect(result.pathLength).toBe(1);
    });
  });

  // ----------------------------------------------------------
  // sourceLocations
  // ----------------------------------------------------------

  describe('sourceLocations', () => {
    it('returns source locations for each step in the flow', async () => {
      await storage.put('concept-entity', 'ce-1', { id: 'ce-1', name: 'Todo' });
      await storage.put('action-entity', 'ae-1', {
        id: 'ae-1',
        concept: 'Todo',
        name: 'create',
        symbol: 'clef/action/Todo/create',
      });
      await storage.put('source-map', 'sm-1', {
        id: 'sm-1',
        symbol: 'clef/action/Todo/create',
        file: 'concepts/todo.clef',
        line: 10,
        col: 5,
      });

      await storage.put('action-log', 'log-1', {
        id: 'log-1',
        flow: 'flow-1',
        concept: 'Todo',
        action: 'create',
        type: 'invocation',
      });

      const corr = await runtimeFlowHandler.correlate({ flowId: 'flow-1' }, storage);
      const result = await runtimeFlowHandler.sourceLocations({ flow: corr.flow }, storage);
      expect(result.variant).toBe('ok');
      const locations = JSON.parse(result.locations as string);
      expect(locations).toHaveLength(1);
      expect(locations[0].file).toBe('concepts/todo.clef');
      expect(locations[0].line).toBe(10);
    });

    it('returns empty locations for nonexistent flow', async () => {
      const result = await runtimeFlowHandler.sourceLocations({ flow: 'nope' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.locations).toBe('[]');
    });
  });

  // ----------------------------------------------------------
  // Multi-step: correlate -> get -> findByAction round trip
  // ----------------------------------------------------------

  describe('correlate then query round trip', () => {
    it('persists data across correlate, get, and findByAction', async () => {
      await storage.put('action-log', 'log-1', {
        id: 'log-1',
        flow: 'flow-rt',
        concept: 'Todo',
        action: 'create',
        variant: 'ok',
        type: 'completion',
        timestamp: '2024-06-01T12:00:00Z',
      });

      const corr = await runtimeFlowHandler.correlate({ flowId: 'flow-rt' }, storage);
      expect(corr.variant === 'ok' || corr.variant === 'partial').toBe(true);

      const get = await runtimeFlowHandler.get({ flow: corr.flow }, storage);
      expect(get.variant).toBe('ok');
      expect(get.flowId).toBe('flow-rt');

      const find = await runtimeFlowHandler.findByAction({ action: 'create', since: '' }, storage);
      const flows = JSON.parse(find.flows as string);
      expect(flows.some((f: Record<string, unknown>) => f.flowId === 'flow-rt')).toBe(true);
    });
  });
});
