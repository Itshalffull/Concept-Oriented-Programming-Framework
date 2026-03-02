// VariantEntity — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { variantEntityHandler } from './handler.js';
import type { VariantEntityStorage } from './types.js';

const createTestStorage = (): VariantEntityStorage => {
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

const createFailingStorage = (): VariantEntityStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = variantEntityHandler;

describe('VariantEntity handler', () => {
  describe('register', () => {
    it('should register a new variant and return its ID', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        { action: 'button', tag: 'primary', fields: 'color,size' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        // Note: VariantEntityRegisterOutput has duplicate 'variant' fields in the
        // generated types — the variantId overwrites 'ok' in the JS object.
        expect(result.right.variant).toBe('button::primary');
      }
    });

    it('should persist variant to storage', async () => {
      const storage = createTestStorage();
      await handler.register(
        { action: 'card', tag: 'compact', fields: 'title,body' },
        storage,
      )();
      const stored = await storage.get('variant_entity', 'card::compact');
      expect(stored).not.toBeNull();
      expect(stored!.action).toBe('card');
      expect(stored!.tag).toBe('compact');
      expect(stored!.fields).toBe('title,body');
    });

    it('should update variant action index', async () => {
      const storage = createTestStorage();
      await handler.register(
        { action: 'alert', tag: 'success', fields: 'message' },
        storage,
      )();
      const index = await storage.get('variant_action_index', 'alert');
      expect(index).not.toBeNull();
      const variants = index!.variants as string[];
      expect(variants).toContain('alert::success');
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.register(
        { action: 'fail', tag: 'test', fields: 'x' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('matchingSyncs', () => {
    it('should return empty array when variant has no matching syncs', async () => {
      const storage = createTestStorage();
      await handler.register(
        { action: 'badge', tag: 'info', fields: 'label' },
        storage,
      )();
      const result = await handler.matchingSyncs(
        { variant: 'badge::info' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const syncs = JSON.parse(result.right.syncs);
        expect(syncs).toEqual([]);
      }
    });

    it('should return empty array when variant does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.matchingSyncs(
        { variant: 'nonexistent::variant' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const syncs = JSON.parse(result.right.syncs);
        expect(syncs).toEqual([]);
      }
    });
  });

  describe('isDead', () => {
    it('should return dead when variant does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.isDead(
        { variant: 'nonexistent::variant' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('dead');
      }
    });

    it('should return dead when variant has no syncs and no runtime occurrences', async () => {
      const storage = createTestStorage();
      await handler.register(
        { action: 'chip', tag: 'outline', fields: 'text' },
        storage,
      )();
      const result = await handler.isDead(
        { variant: 'chip::outline' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('dead');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.isDead(
        { variant: 'fail::test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('get', () => {
    it('should retrieve variant details by ID', async () => {
      const storage = createTestStorage();
      await handler.register(
        { action: 'toggle', tag: 'switch', fields: 'on,off' },
        storage,
      )();
      const result = await handler.get(
        { variant: 'toggle::switch' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        // Note: VariantEntityGetOutputOk has duplicate 'variant' fields in the
        // generated types — the variantId overwrites 'ok' in the JS object.
        // Check other fields to confirm a successful retrieval.
        const r = result.right as Record<string, unknown>;
        expect(r.action).toBe('toggle');
        expect(r.tag).toBe('switch');
        expect(r.fields).toBe('on,off');
      }
    });

    it('should return notfound for missing variant', async () => {
      const storage = createTestStorage();
      const result = await handler.get(
        { variant: 'missing::variant' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.get(
        { variant: 'fail::test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
