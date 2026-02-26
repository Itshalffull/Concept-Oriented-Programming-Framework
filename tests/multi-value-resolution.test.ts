// ============================================================
// MultiValueResolution Concept Handler Tests
//
// Validates register and attemptResolve actions for the
// multi-value (keep-all) conflict resolution provider. Verifies
// that both concurrent values are preserved in the resolution
// result and that output is commutative (order-independent).
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  multiValueResolutionHandler,
  resetMultiValueResolutionCounter,
} from '../handlers/ts/multi-value-resolution.handler.js';

describe('MultiValueResolution', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetMultiValueResolutionCounter();
  });

  // ---- register ----

  describe('register', () => {
    it('registers the multi-value resolution provider', async () => {
      const result = await multiValueResolutionHandler.register({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('multi-value');
      expect(result.category).toBe('conflict-resolution');
      expect(result.priority).toBe(30);
    });

    it('persists the registration to storage', async () => {
      await multiValueResolutionHandler.register({}, storage);
      const records = await storage.find('multi-value-resolution', { name: 'multi-value' });
      expect(records.length).toBeGreaterThan(0);
    });
  });

  // ---- attemptResolve ----

  describe('attemptResolve', () => {
    it('keeps both values in the result', async () => {
      const result = await multiValueResolutionHandler.attemptResolve(
        { v1: 'apple', v2: 'banana', context: 'cart' },
        storage,
      );
      expect(result.variant).toBe('resolved');
      const resolved = JSON.parse(result.result as string);
      expect(resolved).toContain('apple');
      expect(resolved).toContain('banana');
      expect(resolved.length).toBe(2);
    });

    it('produces sorted output for commutativity', async () => {
      const r1 = await multiValueResolutionHandler.attemptResolve(
        { v1: 'zebra', v2: 'alpha', context: 'test' },
        storage,
      );
      const r2 = await multiValueResolutionHandler.attemptResolve(
        { v1: 'alpha', v2: 'zebra', context: 'test' },
        storage,
      );
      // Both should produce the same result regardless of input order
      expect(r1.result).toBe(r2.result);

      const resolved = JSON.parse(r1.result as string);
      expect(resolved).toEqual(['alpha', 'zebra']);
    });

    it('works with JSON values', async () => {
      const v1 = JSON.stringify({ price: 10 });
      const v2 = JSON.stringify({ price: 15 });
      const result = await multiValueResolutionHandler.attemptResolve(
        { v1, v2, context: 'pricing' },
        storage,
      );
      expect(result.variant).toBe('resolved');
      const resolved = JSON.parse(result.result as string);
      expect(resolved.length).toBe(2);
      expect(resolved).toContain(v1);
      expect(resolved).toContain(v2);
    });

    it('preserves identical values (both kept even if same)', async () => {
      const result = await multiValueResolutionHandler.attemptResolve(
        { v1: 'same', v2: 'same', context: 'dup' },
        storage,
      );
      expect(result.variant).toBe('resolved');
      const resolved = JSON.parse(result.result as string);
      expect(resolved).toEqual(['same', 'same']);
    });

    it('works without base parameter', async () => {
      const result = await multiValueResolutionHandler.attemptResolve(
        { v1: 'left', v2: 'right', context: 'no-base' },
        storage,
      );
      expect(result.variant).toBe('resolved');
    });

    it('works with base parameter provided', async () => {
      const result = await multiValueResolutionHandler.attemptResolve(
        { base: 'original', v1: 'edit-a', v2: 'edit-b', context: 'with-base' },
        storage,
      );
      expect(result.variant).toBe('resolved');
      const resolved = JSON.parse(result.result as string);
      // Multi-value keeps v1 and v2, not base
      expect(resolved).toContain('edit-a');
      expect(resolved).toContain('edit-b');
      expect(resolved).not.toContain('original');
    });

    it('always resolves (never returns cannotResolve)', async () => {
      // Multi-value can handle any content type
      const testCases = [
        { v1: 'plain text', v2: 'more text' },
        { v1: '123', v2: '456' },
        { v1: '', v2: 'something' },
        { v1: JSON.stringify([1, 2]), v2: JSON.stringify([3, 4]) },
      ];

      for (const tc of testCases) {
        const result = await multiValueResolutionHandler.attemptResolve(
          { ...tc, context: 'always-resolves' },
          storage,
        );
        expect(result.variant).toBe('resolved');
      }
    });

    it('caches the resolution in storage', async () => {
      await multiValueResolutionHandler.attemptResolve(
        { v1: 'a', v2: 'b', context: 'cache-test' },
        storage,
      );
      const records = await storage.find('multi-value-resolution', {});
      const cacheRecords = records.filter(r => r.resolvedAt !== undefined);
      expect(cacheRecords.length).toBeGreaterThan(0);
      expect(cacheRecords[0].v1).toBe('a');
      expect(cacheRecords[0].v2).toBe('b');
    });

    it('generates unique cache IDs for each resolution', async () => {
      await multiValueResolutionHandler.attemptResolve(
        { v1: 'a', v2: 'b', context: 'c1' },
        storage,
      );
      await multiValueResolutionHandler.attemptResolve(
        { v1: 'x', v2: 'y', context: 'c2' },
        storage,
      );
      const records = await storage.find('multi-value-resolution', {});
      const cacheRecords = records.filter(r => r.resolvedAt !== undefined);
      const ids = cacheRecords.map(r => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  // ---- Comparison with other providers ----

  describe('behavioral comparison', () => {
    it('multi-value keeps both values where LWW would pick one', async () => {
      const v1 = JSON.stringify({ data: 'old', _ts: 1000 });
      const v2 = JSON.stringify({ data: 'new', _ts: 2000 });

      const result = await multiValueResolutionHandler.attemptResolve(
        { v1, v2, context: 'lww-comparison' },
        storage,
      );
      expect(result.variant).toBe('resolved');
      const resolved = JSON.parse(result.result as string);
      // Multi-value keeps BOTH, not just the latest
      expect(resolved.length).toBe(2);
      expect(resolved).toContain(v1);
      expect(resolved).toContain(v2);
    });

    it('multi-value keeps both values where add-wins would merge sets', async () => {
      const v1 = JSON.stringify(['a', 'b']);
      const v2 = JSON.stringify(['c', 'd']);

      const result = await multiValueResolutionHandler.attemptResolve(
        { v1, v2, context: 'add-wins-comparison' },
        storage,
      );
      expect(result.variant).toBe('resolved');
      const resolved = JSON.parse(result.result as string);
      // Multi-value treats each version as an opaque value
      expect(resolved.length).toBe(2);
      expect(resolved).toContain(v1);
      expect(resolved).toContain(v2);
    });
  });
});
