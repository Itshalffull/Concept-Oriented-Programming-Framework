// ============================================================
// VariantEntity Handler Tests
//
// Tests for variant-entity: registration, retrieval,
// matching syncs, dead variant detection, and get.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  variantEntityHandler,
  resetVariantEntityCounter,
} from '../handlers/ts/variant-entity.handler.js';

describe('VariantEntity Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetVariantEntityCounter();
  });

  // ----------------------------------------------------------
  // register
  // ----------------------------------------------------------

  describe('register', () => {
    it('registers a new variant and returns ok', async () => {
      const result = await variantEntityHandler.register(
        { action: 'Todo/create', tag: 'ok', fields: '["id","title"]' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.variantRef).toBe('variant-entity-1');
    });

    it('stores the variant with the correct symbol', async () => {
      await variantEntityHandler.register(
        { action: 'Todo/create', tag: 'error', fields: '["message"]' },
        storage,
      );
      const record = await storage.get('variant-entity', 'variant-entity-1');
      expect(record).not.toBeNull();
      expect(record!.symbol).toBe('clef/variant/Todo/create/error');
      expect(record!.tag).toBe('error');
      expect(record!.fields).toBe('["message"]');
    });

    it('allows registering multiple variants for the same action', async () => {
      const a = await variantEntityHandler.register(
        { action: 'Todo/create', tag: 'ok', fields: '[]' },
        storage,
      );
      const b = await variantEntityHandler.register(
        { action: 'Todo/create', tag: 'error', fields: '[]' },
        storage,
      );
      expect(a.variantRef).not.toBe(b.variantRef);
    });
  });

  // ----------------------------------------------------------
  // get
  // ----------------------------------------------------------

  describe('get', () => {
    it('returns variant details after registration', async () => {
      const reg = await variantEntityHandler.register(
        { action: 'Todo/create', tag: 'ok', fields: '["id"]' },
        storage,
      );
      const result = await variantEntityHandler.get({ variant: reg.variantRef }, storage);
      expect(result.variant).toBe('ok');
      expect(result.action).toBe('Todo/create');
      expect(result.tag).toBe('ok');
      expect(result.fields).toBe('["id"]');
    });

    it('returns notfound for nonexistent variant', async () => {
      const result = await variantEntityHandler.get({ variant: 'nope' }, storage);
      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // matchingSyncs
  // ----------------------------------------------------------

  describe('matchingSyncs', () => {
    it('finds syncs that pattern-match on this variant tag', async () => {
      const reg = await variantEntityHandler.register(
        { action: 'Todo/create', tag: 'ok', fields: '[]' },
        storage,
      );

      await storage.put('sync-entity', 'sync-1', {
        id: 'sync-1',
        name: 'onTodoCreateOk',
        whenPatterns: JSON.stringify([{
          action: 'create',
          outputFields: [{ name: 'variant', match: { type: 'literal', value: 'ok' } }],
        }]),
      });

      const result = await variantEntityHandler.matchingSyncs({ variant: reg.variantRef }, storage);
      expect(result.variant).toBe('ok');
      const syncs = JSON.parse(result.syncs as string);
      expect(syncs).toHaveLength(1);
    });

    it('matches syncs with wildcard variant patterns', async () => {
      const reg = await variantEntityHandler.register(
        { action: 'Todo/create', tag: 'ok', fields: '[]' },
        storage,
      );

      await storage.put('sync-entity', 'sync-1', {
        id: 'sync-1',
        name: 'catchAll',
        whenPatterns: JSON.stringify([{
          action: 'create',
          outputFields: [{ name: 'variant', match: { type: 'wildcard' } }],
        }]),
      });

      const result = await variantEntityHandler.matchingSyncs({ variant: reg.variantRef }, storage);
      expect(result.variant).toBe('ok');
      const syncs = JSON.parse(result.syncs as string);
      expect(syncs).toHaveLength(1);
    });

    it('returns empty for nonexistent variant', async () => {
      const result = await variantEntityHandler.matchingSyncs({ variant: 'nope' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.syncs).toBe('[]');
    });
  });

  // ----------------------------------------------------------
  // isDead
  // ----------------------------------------------------------

  describe('isDead', () => {
    it('reports dead when no syncs and no runtime coverage', async () => {
      const reg = await variantEntityHandler.register(
        { action: 'Todo/create', tag: 'unused', fields: '[]' },
        storage,
      );

      const result = await variantEntityHandler.isDead({ variant: reg.variantRef }, storage);
      expect(result.variant).toBe('dead');
      expect(result.noMatchingSyncs).toBe('true');
      expect(result.noRuntimeOccurrences).toBe('true');
    });

    it('reports alive when syncs match and runtime coverage exists', async () => {
      const reg = await variantEntityHandler.register(
        { action: 'Todo/create', tag: 'ok', fields: '[]' },
        storage,
      );

      await storage.put('sync-entity', 'sync-1', {
        id: 'sync-1',
        name: 'onOk',
        whenPatterns: JSON.stringify([{
          action: 'create',
          outputFields: [{ name: 'variant', match: { type: 'literal', value: 'ok' } }],
        }]),
      });

      await storage.put('runtime-coverage', 'rc-1', {
        id: 'rc-1',
        symbol: 'clef/variant/Todo/create/ok',
        executionCount: 5,
      });

      const result = await variantEntityHandler.isDead({ variant: reg.variantRef }, storage);
      expect(result.variant).toBe('alive');
      expect(result.syncCount).toBe(1);
      expect(result.runtimeCount).toBe(1);
    });

    it('reports dead when variant record does not exist', async () => {
      const result = await variantEntityHandler.isDead({ variant: 'nope' }, storage);
      expect(result.variant).toBe('dead');
    });

    it('reports dead when syncs match but no runtime coverage', async () => {
      const reg = await variantEntityHandler.register(
        { action: 'Todo/create', tag: 'ok', fields: '[]' },
        storage,
      );

      await storage.put('sync-entity', 'sync-1', {
        id: 'sync-1',
        name: 'onOk',
        whenPatterns: JSON.stringify([{
          action: 'create',
          outputFields: [{ name: 'variant', match: { type: 'literal', value: 'ok' } }],
        }]),
      });

      const result = await variantEntityHandler.isDead({ variant: reg.variantRef }, storage);
      expect(result.variant).toBe('dead');
      expect(result.noMatchingSyncs).toBe('false');
      expect(result.noRuntimeOccurrences).toBe('true');
    });
  });
});
