// ============================================================
// AddWinsResolution Concept Handler Tests
//
// Validates register and attemptResolve actions for the add-wins
// (OR-Set semantics) conflict resolution provider. Verifies that
// set union is correctly computed and additions win over removals.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  addWinsResolutionHandler,
  resetAddWinsResolutionCounter,
} from '../implementations/typescript/add-wins-resolution.impl.js';

describe('AddWinsResolution', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetAddWinsResolutionCounter();
  });

  // ---- register ----

  describe('register', () => {
    it('registers the add-wins resolution provider', async () => {
      const result = await addWinsResolutionHandler.register({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('add-wins');
      expect(result.category).toBe('conflict-resolution');
      expect(result.priority).toBe(20);
    });

    it('persists the registration to storage', async () => {
      await addWinsResolutionHandler.register({}, storage);
      const records = await storage.find('add-wins-resolution', { name: 'add-wins' });
      expect(records.length).toBeGreaterThan(0);
      expect(records[0].category).toBe('conflict-resolution');
    });
  });

  // ---- attemptResolve ----

  describe('attemptResolve', () => {
    it('computes the set union of two sets (additions win)', async () => {
      const result = await addWinsResolutionHandler.attemptResolve(
        {
          v1: JSON.stringify(['a', 'b', 'c']),
          v2: JSON.stringify(['b', 'c', 'd']),
          context: 'tags',
        },
        storage,
      );
      expect(result.variant).toBe('resolved');
      const resolved = JSON.parse(result.result as string);
      expect(resolved).toEqual(['a', 'b', 'c', 'd']);
    });

    it('handles disjoint sets (full union)', async () => {
      const result = await addWinsResolutionHandler.attemptResolve(
        {
          v1: JSON.stringify(['x', 'y']),
          v2: JSON.stringify(['a', 'b']),
          context: 'permissions',
        },
        storage,
      );
      expect(result.variant).toBe('resolved');
      const resolved = JSON.parse(result.result as string);
      expect(resolved).toEqual(['a', 'b', 'x', 'y']);
    });

    it('handles identical sets', async () => {
      const result = await addWinsResolutionHandler.attemptResolve(
        {
          v1: JSON.stringify(['a', 'b']),
          v2: JSON.stringify(['a', 'b']),
          context: 'tags',
        },
        storage,
      );
      expect(result.variant).toBe('resolved');
      const resolved = JSON.parse(result.result as string);
      expect(resolved).toEqual(['a', 'b']);
    });

    it('handles empty sets', async () => {
      const result = await addWinsResolutionHandler.attemptResolve(
        {
          v1: JSON.stringify([]),
          v2: JSON.stringify(['a']),
          context: 'tags',
        },
        storage,
      );
      expect(result.variant).toBe('resolved');
      const resolved = JSON.parse(result.result as string);
      expect(resolved).toEqual(['a']);
    });

    it('add wins over removal: item removed in v1 but present in v2 is kept', async () => {
      // base had ['a', 'b', 'c']
      // v1 removed 'c' -> ['a', 'b']
      // v2 kept all -> ['a', 'b', 'c']
      // Result: union = ['a', 'b', 'c'] (add wins)
      const result = await addWinsResolutionHandler.attemptResolve(
        {
          base: JSON.stringify(['a', 'b', 'c']),
          v1: JSON.stringify(['a', 'b']),
          v2: JSON.stringify(['a', 'b', 'c']),
          context: 'membership',
        },
        storage,
      );
      expect(result.variant).toBe('resolved');
      const resolved = JSON.parse(result.result as string);
      expect(resolved).toContain('c');
    });

    it('returns sorted result for deterministic output', async () => {
      const result = await addWinsResolutionHandler.attemptResolve(
        {
          v1: JSON.stringify(['z', 'a', 'm']),
          v2: JSON.stringify(['b', 'z']),
          context: 'items',
        },
        storage,
      );
      const resolved = JSON.parse(result.result as string);
      expect(resolved).toEqual(['a', 'b', 'm', 'z']);
    });

    it('returns cannotResolve when v1 is not a valid set', async () => {
      const result = await addWinsResolutionHandler.attemptResolve(
        {
          v1: 'not-json',
          v2: JSON.stringify(['a']),
          context: 'tags',
        },
        storage,
      );
      expect(result.variant).toBe('cannotResolve');
      expect(result.reason).toContain('not a set-like structure');
    });

    it('returns cannotResolve when v2 is not a valid set', async () => {
      const result = await addWinsResolutionHandler.attemptResolve(
        {
          v1: JSON.stringify(['a']),
          v2: '{"key": "value"}',
          context: 'tags',
        },
        storage,
      );
      expect(result.variant).toBe('cannotResolve');
    });

    it('returns cannotResolve when both are non-array JSON', async () => {
      const result = await addWinsResolutionHandler.attemptResolve(
        {
          v1: '"just a string"',
          v2: '42',
          context: 'tags',
        },
        storage,
      );
      expect(result.variant).toBe('cannotResolve');
    });

    it('caches the resolution in storage', async () => {
      await addWinsResolutionHandler.attemptResolve(
        {
          v1: JSON.stringify(['a']),
          v2: JSON.stringify(['b']),
          context: 'cache-test',
        },
        storage,
      );
      const records = await storage.find('add-wins-resolution', {});
      // At least one resolution cache record should exist
      const cacheRecords = records.filter(r => r.resolvedAt !== undefined);
      expect(cacheRecords.length).toBeGreaterThan(0);
      expect(cacheRecords[0].result).toBe(JSON.stringify(['a', 'b']));
    });

    it('works without base set provided', async () => {
      const result = await addWinsResolutionHandler.attemptResolve(
        {
          v1: JSON.stringify(['a', 'b']),
          v2: JSON.stringify(['c']),
          context: 'no-base',
        },
        storage,
      );
      expect(result.variant).toBe('resolved');
      const resolved = JSON.parse(result.result as string);
      expect(resolved).toEqual(['a', 'b', 'c']);
    });

    it('deduplicates items present in both sets', async () => {
      const result = await addWinsResolutionHandler.attemptResolve(
        {
          v1: JSON.stringify(['a', 'b', 'a']),
          v2: JSON.stringify(['b', 'b', 'c']),
          context: 'dedup',
        },
        storage,
      );
      expect(result.variant).toBe('resolved');
      const resolved = JSON.parse(result.result as string);
      // Set ensures unique values
      expect(resolved).toEqual(['a', 'b', 'c']);
    });
  });
});
