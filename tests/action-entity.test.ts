// ============================================================
// ActionEntity Handler Tests
//
// Tests for the action-entity semantic entity: registration,
// retrieval, duplicate detection, concept queries, sync
// relationship tracing, and implementation symbol lookup.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  actionEntityHandler,
  resetActionEntityCounter,
} from '../implementations/typescript/action-entity.impl.js';

describe('ActionEntity Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetActionEntityCounter();
  });

  // ----------------------------------------------------------
  // register
  // ----------------------------------------------------------

  describe('register', () => {
    it('registers a new action and returns ok with an id', async () => {
      const result = await actionEntityHandler.register(
        { concept: 'Todo', name: 'create', params: '[]', variantRefs: '["ok","error"]' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.action).toBe('action-entity-1');
    });

    it('stores the action with the correct symbol', async () => {
      await actionEntityHandler.register(
        { concept: 'Todo', name: 'create', params: '[]', variantRefs: '["ok"]' },
        storage,
      );
      const record = await storage.get('action-entity', 'action-entity-1');
      expect(record).not.toBeNull();
      expect(record!.symbol).toBe('copf/action/Todo/create');
      expect(record!.variantCount).toBe(1);
    });

    it('returns the existing id for a duplicate concept+name', async () => {
      const first = await actionEntityHandler.register(
        { concept: 'Todo', name: 'create', params: '[]', variantRefs: '[]' },
        storage,
      );
      const second = await actionEntityHandler.register(
        { concept: 'Todo', name: 'create', params: '["title"]', variantRefs: '["ok"]' },
        storage,
      );
      expect(second.variant).toBe('ok');
      expect(second.action).toBe(first.action);
    });

    it('registers different actions on the same concept', async () => {
      const a = await actionEntityHandler.register(
        { concept: 'Todo', name: 'create', params: '[]', variantRefs: '[]' },
        storage,
      );
      const b = await actionEntityHandler.register(
        { concept: 'Todo', name: 'delete', params: '[]', variantRefs: '[]' },
        storage,
      );
      expect(a.action).not.toBe(b.action);
    });

    it('handles invalid JSON in variantRefs gracefully', async () => {
      const result = await actionEntityHandler.register(
        { concept: 'Todo', name: 'create', params: '[]', variantRefs: 'not-json' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const record = await storage.get('action-entity', result.action as string);
      expect(record!.variantCount).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // get
  // ----------------------------------------------------------

  describe('get', () => {
    it('returns the action details after registration', async () => {
      const reg = await actionEntityHandler.register(
        { concept: 'Todo', name: 'create', params: '["title"]', variantRefs: '["ok","error"]' },
        storage,
      );
      const result = await actionEntityHandler.get({ action: reg.action }, storage);
      expect(result.variant).toBe('ok');
      expect(result.concept).toBe('Todo');
      expect(result.name).toBe('create');
      expect(result.params).toBe('["title"]');
      expect(result.variantCount).toBe(2);
    });

    it('returns notfound for a nonexistent action', async () => {
      const result = await actionEntityHandler.get({ action: 'nonexistent' }, storage);
      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // findByConcept
  // ----------------------------------------------------------

  describe('findByConcept', () => {
    it('returns actions filtered by concept', async () => {
      await actionEntityHandler.register(
        { concept: 'Todo', name: 'create', params: '[]', variantRefs: '[]' },
        storage,
      );
      await actionEntityHandler.register(
        { concept: 'Todo', name: 'delete', params: '[]', variantRefs: '[]' },
        storage,
      );
      await actionEntityHandler.register(
        { concept: 'User', name: 'signup', params: '[]', variantRefs: '[]' },
        storage,
      );

      const result = await actionEntityHandler.findByConcept({ concept: 'Todo' }, storage);
      expect(result.variant).toBe('ok');
      const actions = JSON.parse(result.actions as string);
      expect(actions).toHaveLength(2);
      expect(actions.every((a: Record<string, unknown>) => a.concept === 'Todo')).toBe(true);
    });

    it('returns all actions when concept is empty', async () => {
      await actionEntityHandler.register(
        { concept: 'Todo', name: 'create', params: '[]', variantRefs: '[]' },
        storage,
      );
      await actionEntityHandler.register(
        { concept: 'User', name: 'signup', params: '[]', variantRefs: '[]' },
        storage,
      );

      const result = await actionEntityHandler.findByConcept({ concept: '' }, storage);
      expect(result.variant).toBe('ok');
      const actions = JSON.parse(result.actions as string);
      expect(actions).toHaveLength(2);
    });
  });

  // ----------------------------------------------------------
  // triggeringSyncs
  // ----------------------------------------------------------

  describe('triggeringSyncs', () => {
    it('finds syncs that trigger on this action via when-patterns', async () => {
      const reg = await actionEntityHandler.register(
        { concept: 'Todo', name: 'create', params: '[]', variantRefs: '[]' },
        storage,
      );

      // Seed a sync-entity with a when-pattern referencing Todo.create
      await storage.put('sync-entity', 'sync-1', {
        id: 'sync-1',
        name: 'onTodoCreate',
        compiled: JSON.stringify({
          when: [{ concept: 'Todo', action: 'create' }],
          then: [{ concept: 'Notification', action: 'send' }],
        }),
      });

      const result = await actionEntityHandler.triggeringSyncs({ action: reg.action }, storage);
      expect(result.variant).toBe('ok');
      const syncs = JSON.parse(result.syncs as string);
      expect(syncs).toHaveLength(1);
      expect(syncs[0].name).toBe('onTodoCreate');
    });

    it('returns empty array for nonexistent action', async () => {
      const result = await actionEntityHandler.triggeringSyncs({ action: 'nope' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.syncs).toBe('[]');
    });
  });

  // ----------------------------------------------------------
  // invokingSyncs
  // ----------------------------------------------------------

  describe('invokingSyncs', () => {
    it('finds syncs that invoke this action via then-actions', async () => {
      const reg = await actionEntityHandler.register(
        { concept: 'Notification', name: 'send', params: '[]', variantRefs: '[]' },
        storage,
      );

      await storage.put('sync-entity', 'sync-1', {
        id: 'sync-1',
        name: 'onTodoCreate',
        compiled: JSON.stringify({
          when: [{ concept: 'Todo', action: 'create' }],
          then: [{ concept: 'Notification', action: 'send' }],
        }),
      });

      const result = await actionEntityHandler.invokingSyncs({ action: reg.action }, storage);
      expect(result.variant).toBe('ok');
      const syncs = JSON.parse(result.syncs as string);
      expect(syncs).toHaveLength(1);
    });

    it('returns empty array when no syncs invoke this action', async () => {
      const reg = await actionEntityHandler.register(
        { concept: 'Todo', name: 'create', params: '[]', variantRefs: '[]' },
        storage,
      );
      const result = await actionEntityHandler.invokingSyncs({ action: reg.action }, storage);
      expect(result.variant).toBe('ok');
      expect(result.syncs).toBe('[]');
    });
  });

  // ----------------------------------------------------------
  // implementations
  // ----------------------------------------------------------

  describe('implementations', () => {
    it('returns the stored implementation symbols', async () => {
      const reg = await actionEntityHandler.register(
        { concept: 'Todo', name: 'create', params: '[]', variantRefs: '[]' },
        storage,
      );
      const result = await actionEntityHandler.implementations({ action: reg.action }, storage);
      expect(result.variant).toBe('ok');
      expect(result.symbols).toBe('[]');
    });

    it('returns empty for nonexistent action', async () => {
      const result = await actionEntityHandler.implementations({ action: 'nope' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.symbols).toBe('[]');
    });
  });

  // ----------------------------------------------------------
  // interfaceExposures
  // ----------------------------------------------------------

  describe('interfaceExposures', () => {
    it('returns exposures linked to the action symbol', async () => {
      const reg = await actionEntityHandler.register(
        { concept: 'Todo', name: 'create', params: '[]', variantRefs: '[]' },
        storage,
      );

      await storage.put('interface-exposure', 'exp-1', {
        id: 'exp-1',
        actionSymbol: 'copf/action/Todo/create',
        surface: 'REST',
      });

      const result = await actionEntityHandler.interfaceExposures({ action: reg.action }, storage);
      expect(result.variant).toBe('ok');
      const exposures = JSON.parse(result.exposures as string);
      expect(exposures).toHaveLength(1);
      expect(exposures[0].surface).toBe('REST');
    });

    it('returns empty for nonexistent action', async () => {
      const result = await actionEntityHandler.interfaceExposures({ action: 'nope' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.exposures).toBe('[]');
    });
  });
});
