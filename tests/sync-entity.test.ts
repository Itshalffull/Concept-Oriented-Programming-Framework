// ============================================================
// SyncEntity Handler Tests
//
// Tests for sync-entity: registration, duplicate detection,
// concept queries, triggerable-by, chain traversal, dead-end
// detection, orphan variant analysis, and retrieval.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  syncEntityHandler,
  resetSyncEntityCounter,
} from '../handlers/ts/sync-entity.handler.js';

describe('SyncEntity Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetSyncEntityCounter();
  });

  // ----------------------------------------------------------
  // register
  // ----------------------------------------------------------

  describe('register', () => {
    it('registers a new sync entity and returns ok', async () => {
      const result = await syncEntityHandler.register(
        {
          name: 'onTodoCreate',
          source: 'syncs/todo.sync',
          compiled: JSON.stringify({
            when: [{ concept: 'Todo', action: 'create' }],
            then: [{ concept: 'Audit', action: 'log' }],
            tier: 'critical',
          }),
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.sync).toBe('sync-entity-1');
    });

    it('extracts metadata from compiled payload', async () => {
      await syncEntityHandler.register(
        {
          name: 'mySync',
          source: 's.sync',
          compiled: JSON.stringify({
            when: [{ concept: 'A', action: 'x' }, { concept: 'B', action: 'y' }],
            where: [{ field: 'status', op: 'eq', value: 'active' }],
            then: [{ concept: 'C', action: 'z' }],
            annotations: ['idempotent'],
            tier: 'deferred',
          }),
        },
        storage,
      );
      const record = await storage.get('sync-entity', 'sync-entity-1');
      expect(record!.whenPatternCount).toBe(2);
      expect(record!.thenActionCount).toBe(1);
      expect(record!.tier).toBe('deferred');
      expect(JSON.parse(record!.annotations as string)).toEqual(['idempotent']);
    });

    it('returns alreadyRegistered for a duplicate name', async () => {
      const first = await syncEntityHandler.register(
        { name: 'mySync', source: 'a.sync', compiled: '{}' },
        storage,
      );
      const second = await syncEntityHandler.register(
        { name: 'mySync', source: 'b.sync', compiled: '{}' },
        storage,
      );
      expect(second.variant).toBe('alreadyRegistered');
      expect(second.existing).toBe(first.sync);
    });

    it('handles invalid compiled JSON gracefully', async () => {
      const result = await syncEntityHandler.register(
        { name: 'broken', source: 'b.sync', compiled: 'not-json' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const record = await storage.get('sync-entity', result.sync as string);
      expect(record!.whenPatternCount).toBe(0);
      expect(record!.thenActionCount).toBe(0);
      expect(record!.tier).toBe('standard');
    });
  });

  // ----------------------------------------------------------
  // get
  // ----------------------------------------------------------

  describe('get', () => {
    it('returns sync details after registration', async () => {
      const reg = await syncEntityHandler.register(
        {
          name: 'onTodoCreate',
          source: 's.sync',
          compiled: JSON.stringify({
            when: [{ concept: 'Todo', action: 'create' }],
            then: [{ concept: 'Audit', action: 'log' }],
            tier: 'critical',
            annotations: ['idempotent'],
          }),
        },
        storage,
      );
      const result = await syncEntityHandler.get({ sync: reg.sync }, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('onTodoCreate');
      expect(result.tier).toBe('critical');
      expect(result.whenPatternCount).toBe(1);
      expect(result.thenActionCount).toBe(1);
    });

    it('returns notfound for nonexistent sync', async () => {
      const result = await syncEntityHandler.get({ sync: 'nope' }, storage);
      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // findByConcept
  // ----------------------------------------------------------

  describe('findByConcept', () => {
    it('finds syncs referencing a concept in when or then', async () => {
      await syncEntityHandler.register(
        {
          name: 'sync1',
          source: 's.sync',
          compiled: JSON.stringify({
            when: [{ concept: 'Todo', action: 'create' }],
            then: [{ concept: 'Audit', action: 'log' }],
          }),
        },
        storage,
      );
      await syncEntityHandler.register(
        {
          name: 'sync2',
          source: 's.sync',
          compiled: JSON.stringify({
            when: [{ concept: 'User', action: 'signup' }],
            then: [{ concept: 'User', action: 'welcome' }],
          }),
        },
        storage,
      );

      const result = await syncEntityHandler.findByConcept({ concept: 'Todo' }, storage);
      expect(result.variant).toBe('ok');
      const syncs = JSON.parse(result.syncs as string);
      expect(syncs).toHaveLength(1);
      expect(syncs[0].name).toBe('sync1');
    });
  });

  // ----------------------------------------------------------
  // findTriggerableBy
  // ----------------------------------------------------------

  describe('findTriggerableBy', () => {
    it('finds syncs triggerable by a specific action', async () => {
      await syncEntityHandler.register(
        {
          name: 'sync1',
          source: 's.sync',
          compiled: JSON.stringify({
            when: [{ concept: 'Todo', action: 'create' }],
            then: [],
          }),
        },
        storage,
      );
      await syncEntityHandler.register(
        {
          name: 'sync2',
          source: 's.sync',
          compiled: JSON.stringify({
            when: [{ concept: 'User', action: 'signup' }],
            then: [],
          }),
        },
        storage,
      );

      const result = await syncEntityHandler.findTriggerableBy({ action: 'create', variant: '' }, storage);
      expect(result.variant).toBe('ok');
      const syncs = JSON.parse(result.syncs as string);
      expect(syncs).toHaveLength(1);
      expect(syncs[0].name).toBe('sync1');
    });

    it('filters by variant when provided', async () => {
      await syncEntityHandler.register(
        {
          name: 'sync1',
          source: 's.sync',
          compiled: JSON.stringify({
            when: [{
              concept: 'Todo',
              action: 'create',
              outputFields: [{ name: 'variant', match: { type: 'literal', value: 'ok' } }],
            }],
            then: [],
          }),
        },
        storage,
      );

      const okResult = await syncEntityHandler.findTriggerableBy({ action: 'create', variant: 'ok' }, storage);
      const syncs = JSON.parse(okResult.syncs as string);
      expect(syncs).toHaveLength(1);

      const errorResult = await syncEntityHandler.findTriggerableBy({ action: 'create', variant: 'error' }, storage);
      const errorSyncs = JSON.parse(errorResult.syncs as string);
      expect(errorSyncs).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // chainFrom
  // ----------------------------------------------------------

  describe('chainFrom', () => {
    it('traces a chain of sync triggers', async () => {
      await syncEntityHandler.register(
        {
          name: 'sync1',
          source: 's.sync',
          compiled: JSON.stringify({
            when: [{ concept: 'Todo', action: 'create' }],
            then: [{ concept: 'Audit', action: 'log' }],
          }),
        },
        storage,
      );
      await syncEntityHandler.register(
        {
          name: 'sync2',
          source: 's.sync',
          compiled: JSON.stringify({
            when: [{ concept: 'Audit', action: 'log' }],
            then: [{ concept: 'Notification', action: 'send' }],
          }),
        },
        storage,
      );

      const result = await syncEntityHandler.chainFrom(
        { action: 'create', variant: '', depth: 3 },
        storage,
      );
      expect(result.variant).toBe('ok');
      const chain = JSON.parse(result.chain as string);
      expect(chain.length).toBeGreaterThanOrEqual(2);
      expect(chain[0].triggerAction).toBe('create');
      expect(chain[0].thenAction).toBe('log');
    });

    it('returns noChain when no syncs match the trigger', async () => {
      const result = await syncEntityHandler.chainFrom(
        { action: 'nonexistent', variant: '', depth: 2 },
        storage,
      );
      expect(result.variant).toBe('noChain');
    });
  });

  // ----------------------------------------------------------
  // findDeadEnds
  // ----------------------------------------------------------

  describe('findDeadEnds', () => {
    it('identifies syncs whose then-actions are not triggered by any sync', async () => {
      await syncEntityHandler.register(
        {
          name: 'sync1',
          source: 's.sync',
          compiled: JSON.stringify({
            when: [{ concept: 'Todo', action: 'create' }],
            then: [{ concept: 'Email', action: 'sendWelcome' }],
          }),
        },
        storage,
      );
      // 'sendWelcome' is not in any when-pattern, so sync1 is a dead-end

      const result = await syncEntityHandler.findDeadEnds({}, storage);
      expect(result.variant).toBe('ok');
      const deadEnds = JSON.parse(result.deadEnds as string);
      expect(deadEnds).toHaveLength(1);
      expect(deadEnds[0].name).toBe('sync1');
    });

    it('does not mark syncs as dead-ends if their then-actions are triggered', async () => {
      await syncEntityHandler.register(
        {
          name: 'sync1',
          source: 's.sync',
          compiled: JSON.stringify({
            when: [{ concept: 'Todo', action: 'create' }],
            then: [{ concept: 'Audit', action: 'log' }],
          }),
        },
        storage,
      );
      await syncEntityHandler.register(
        {
          name: 'sync2',
          source: 's.sync',
          compiled: JSON.stringify({
            when: [{ concept: 'Audit', action: 'log' }],
            then: [{ concept: 'Notification', action: 'send' }],
          }),
        },
        storage,
      );

      const result = await syncEntityHandler.findDeadEnds({}, storage);
      const deadEnds = JSON.parse(result.deadEnds as string);
      // sync2's then-action 'send' is not triggered by any sync => dead-end
      // sync1's then-action 'log' IS triggered by sync2 => not a dead-end
      const deadEndNames = deadEnds.map((d: Record<string, unknown>) => d.name);
      expect(deadEndNames).toContain('sync2');
      expect(deadEndNames).not.toContain('sync1');
    });
  });

  // ----------------------------------------------------------
  // findOrphanVariants
  // ----------------------------------------------------------

  describe('findOrphanVariants', () => {
    it('identifies variants not matched by any sync when-pattern', async () => {
      await syncEntityHandler.register(
        {
          name: 'sync1',
          source: 's.sync',
          compiled: JSON.stringify({
            when: [{
              action: 'create',
              outputFields: [{ name: 'variant', match: { type: 'literal', value: 'ok' } }],
            }],
            then: [],
          }),
        },
        storage,
      );

      await storage.put('variant-entity', 'v-1', { id: 'v-1', tag: 'ok', action: 'create' });
      await storage.put('variant-entity', 'v-2', { id: 'v-2', tag: 'error', action: 'create' });

      const result = await syncEntityHandler.findOrphanVariants({}, storage);
      expect(result.variant).toBe('ok');
      const orphans = JSON.parse(result.orphans as string);
      expect(orphans).toHaveLength(1);
      expect(orphans[0].tag).toBe('error');
    });
  });
});
