// ============================================================
// ErrorCorrelation Handler Tests
//
// Tests for error-correlation: recording errors, entity-based
// queries, kind-based queries, hotspot analysis, root cause
// analysis, and retrieval.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  errorCorrelationHandler,
  resetErrorCorrelationCounter,
} from '../implementations/typescript/error-correlation.impl.js';

describe('ErrorCorrelation Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetErrorCorrelationCounter();
  });

  // ----------------------------------------------------------
  // record
  // ----------------------------------------------------------

  describe('record', () => {
    it('records a new error correlation and returns ok', async () => {
      const result = await errorCorrelationHandler.record(
        {
          flowId: 'flow-1',
          errorKind: 'TypeError',
          message: 'Cannot read property x of undefined',
          rawEvent: JSON.stringify({
            concept: 'Todo',
            action: 'create',
            file: 'todo.ts',
            line: 42,
            step: 3,
            phase: 'execution',
          }),
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.error).toBe('error-correlation-1');
    });

    it('extracts context from rawEvent JSON', async () => {
      const result = await errorCorrelationHandler.record(
        {
          flowId: 'flow-1',
          errorKind: 'TypeError',
          message: 'oops',
          rawEvent: JSON.stringify({
            concept: 'Todo',
            action: 'create',
            variant: 'error',
            sync: 'onTodoCreate',
            widget: 'TodoForm',
            file: 'todo.ts',
            line: 42,
            col: 10,
            step: 3,
            phase: 'execution',
          }),
        },
        storage,
      );

      const record = await storage.get('error-correlation', result.error as string);
      expect(record!.conceptEntity).toBe('Todo');
      expect(record!.actionEntity).toBe('create');
      expect(record!.variantEntity).toBe('error');
      expect(record!.syncEntity).toBe('onTodoCreate');
      expect(record!.widgetEntity).toBe('TodoForm');

      const sourceLoc = JSON.parse(record!.sourceLocation as string);
      expect(sourceLoc.file).toBe('todo.ts');
      expect(sourceLoc.line).toBe(42);
    });

    it('handles non-JSON rawEvent gracefully', async () => {
      const result = await errorCorrelationHandler.record(
        { flowId: 'flow-1', errorKind: 'Error', message: 'bad', rawEvent: 'not-json' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const record = await storage.get('error-correlation', result.error as string);
      expect(record!.conceptEntity).toBe('');
    });
  });

  // ----------------------------------------------------------
  // get
  // ----------------------------------------------------------

  describe('get', () => {
    it('returns error details after recording', async () => {
      const rec = await errorCorrelationHandler.record(
        { flowId: 'flow-1', errorKind: 'TypeError', message: 'boom', rawEvent: '{}' },
        storage,
      );
      const result = await errorCorrelationHandler.get({ error: rec.error }, storage);
      expect(result.variant).toBe('ok');
      expect(result.flowId).toBe('flow-1');
      expect(result.errorKind).toBe('TypeError');
      expect(result.errorMessage).toBe('boom');
      expect(result.timestamp).toBeTruthy();
    });

    it('returns notfound for nonexistent error', async () => {
      const result = await errorCorrelationHandler.get({ error: 'nope' }, storage);
      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // findByEntity
  // ----------------------------------------------------------

  describe('findByEntity', () => {
    it('finds errors matching a concept entity symbol', async () => {
      await errorCorrelationHandler.record(
        {
          flowId: 'flow-1',
          errorKind: 'TypeError',
          message: 'bad',
          rawEvent: JSON.stringify({ concept: 'Todo' }),
        },
        storage,
      );
      await errorCorrelationHandler.record(
        {
          flowId: 'flow-2',
          errorKind: 'Error',
          message: 'other',
          rawEvent: JSON.stringify({ concept: 'User' }),
        },
        storage,
      );

      const result = await errorCorrelationHandler.findByEntity({ symbol: 'Todo', since: '' }, storage);
      expect(result.variant).toBe('ok');
      const errors = JSON.parse(result.errors as string);
      expect(errors).toHaveLength(1);
      expect(errors[0].errorMessage).toBe('bad');
    });

    it('matches against action, variant, sync, and widget fields', async () => {
      await errorCorrelationHandler.record(
        {
          flowId: 'flow-1',
          errorKind: 'Error',
          message: 'sync fail',
          rawEvent: JSON.stringify({ sync: 'onTodoCreate' }),
        },
        storage,
      );

      const result = await errorCorrelationHandler.findByEntity({ symbol: 'onTodoCreate', since: '' }, storage);
      const errors = JSON.parse(result.errors as string);
      expect(errors).toHaveLength(1);
    });
  });

  // ----------------------------------------------------------
  // findByKind
  // ----------------------------------------------------------

  describe('findByKind', () => {
    it('finds errors filtered by error kind', async () => {
      await errorCorrelationHandler.record(
        { flowId: 'f1', errorKind: 'TypeError', message: 'a', rawEvent: '{}' },
        storage,
      );
      await errorCorrelationHandler.record(
        { flowId: 'f2', errorKind: 'RangeError', message: 'b', rawEvent: '{}' },
        storage,
      );
      await errorCorrelationHandler.record(
        { flowId: 'f3', errorKind: 'TypeError', message: 'c', rawEvent: '{}' },
        storage,
      );

      const result = await errorCorrelationHandler.findByKind({ errorKind: 'TypeError', since: '' }, storage);
      expect(result.variant).toBe('ok');
      const errors = JSON.parse(result.errors as string);
      expect(errors).toHaveLength(2);
    });
  });

  // ----------------------------------------------------------
  // errorHotspots
  // ----------------------------------------------------------

  describe('errorHotspots', () => {
    it('groups errors by entity and returns top N hotspots', async () => {
      // Record 3 errors for 'create', 1 for 'delete'
      for (let i = 0; i < 3; i++) {
        await errorCorrelationHandler.record(
          {
            flowId: `f-${i}`,
            errorKind: 'Error',
            message: `err-${i}`,
            rawEvent: JSON.stringify({ action: 'create' }),
          },
          storage,
        );
      }
      await errorCorrelationHandler.record(
        {
          flowId: 'f-3',
          errorKind: 'Error',
          message: 'del-err',
          rawEvent: JSON.stringify({ action: 'delete' }),
        },
        storage,
      );

      const result = await errorCorrelationHandler.errorHotspots({ since: '', topN: 5 }, storage);
      expect(result.variant).toBe('ok');
      const hotspots = JSON.parse(result.hotspots as string);
      expect(hotspots[0].symbol).toBe('create');
      expect(hotspots[0].count).toBe(3);
      expect(hotspots[1].symbol).toBe('delete');
      expect(hotspots[1].count).toBe(1);
    });

    it('respects topN limit', async () => {
      for (let i = 0; i < 5; i++) {
        await errorCorrelationHandler.record(
          {
            flowId: `f-${i}`,
            errorKind: 'Error',
            message: `err-${i}`,
            rawEvent: JSON.stringify({ action: `action-${i}` }),
          },
          storage,
        );
      }

      const result = await errorCorrelationHandler.errorHotspots({ since: '', topN: 2 }, storage);
      const hotspots = JSON.parse(result.hotspots as string);
      expect(hotspots).toHaveLength(2);
    });
  });

  // ----------------------------------------------------------
  // rootCause
  // ----------------------------------------------------------

  describe('rootCause', () => {
    it('traces back through flow steps to find the root cause', async () => {
      const rec = await errorCorrelationHandler.record(
        {
          flowId: 'flow-1',
          errorKind: 'TypeError',
          message: 'boom',
          rawEvent: JSON.stringify({ file: 'todo.ts', line: 10 }),
        },
        storage,
      );

      // Seed a runtime-flow with steps, one of which has an error status
      await storage.put('runtime-flow', 'rf-1', {
        id: 'rf-1',
        flowId: 'flow-1',
        steps: JSON.stringify([
          { entity: 'Todo/create', status: 'ok' },
          { entity: 'Audit/log', status: 'error', error: 'Permission denied' },
          { entity: 'Notification/send', status: 'ok' },
        ]),
      });

      const result = await errorCorrelationHandler.rootCause({ error: rec.error }, storage);
      expect(result.variant).toBe('ok');
      const chain = JSON.parse(result.chain as string);
      expect(chain.length).toBeGreaterThanOrEqual(2);

      const likelyCause = JSON.parse(result.likelyCause as string);
      expect(likelyCause.entity).toBe('Audit/log');
      expect(likelyCause.reason).toBe('Permission denied');
    });

    it('returns inconclusive when no flow record exists', async () => {
      const rec = await errorCorrelationHandler.record(
        { flowId: 'missing-flow', errorKind: 'Error', message: 'x', rawEvent: '{}' },
        storage,
      );

      const result = await errorCorrelationHandler.rootCause({ error: rec.error }, storage);
      expect(result.variant).toBe('inconclusive');
    });

    it('returns inconclusive for nonexistent error', async () => {
      const result = await errorCorrelationHandler.rootCause({ error: 'nope' }, storage);
      expect(result.variant).toBe('inconclusive');
    });

    it('returns inconclusive when no deviation found in steps', async () => {
      const rec = await errorCorrelationHandler.record(
        { flowId: 'flow-2', errorKind: 'Error', message: 'x', rawEvent: '{}' },
        storage,
      );

      await storage.put('runtime-flow', 'rf-2', {
        id: 'rf-2',
        flowId: 'flow-2',
        steps: JSON.stringify([
          { entity: 'A', status: 'ok' },
          { entity: 'B', status: 'ok' },
        ]),
      });

      const result = await errorCorrelationHandler.rootCause({ error: rec.error }, storage);
      expect(result.variant).toBe('inconclusive');
    });
  });
});
