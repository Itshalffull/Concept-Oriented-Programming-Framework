// ============================================================
// LWWResolution Concept Handler Tests
//
// Validates register and attemptResolve actions for the
// Last-Writer-Wins conflict resolution provider. Verifies that
// the most recent timestamp wins, and that resolution fails
// gracefully when timestamps cannot be extracted.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  lWWResolutionHandler,
  resetLWWResolutionCounter,
} from '../implementations/typescript/lww-resolution.impl.js';

describe('LWWResolution', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetLWWResolutionCounter();
  });

  // ---- register ----

  describe('register', () => {
    it('registers the LWW resolution provider', async () => {
      const result = await lWWResolutionHandler.register({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('lww');
      expect(result.category).toBe('conflict-resolution');
      expect(result.priority).toBe(10);
    });

    it('persists the registration to storage', async () => {
      await lWWResolutionHandler.register({}, storage);
      const records = await storage.find('lww-resolution', { name: 'lww' });
      expect(records.length).toBeGreaterThan(0);
    });
  });

  // ---- attemptResolve ----

  describe('attemptResolve', () => {
    it('picks v1 when v1 has a later _ts timestamp (JSON object)', async () => {
      const v1 = JSON.stringify({ value: 'newer', _ts: '2026-01-02T00:00:00.000Z' });
      const v2 = JSON.stringify({ value: 'older', _ts: '2026-01-01T00:00:00.000Z' });
      const result = await lWWResolutionHandler.attemptResolve(
        { v1, v2, context: 'test' },
        storage,
      );
      expect(result.variant).toBe('resolved');
      expect(result.result).toBe(v1);
    });

    it('picks v2 when v2 has a later _ts timestamp (JSON object)', async () => {
      const v1 = JSON.stringify({ value: 'older', _ts: '2026-01-01T00:00:00.000Z' });
      const v2 = JSON.stringify({ value: 'newer', _ts: '2026-01-02T00:00:00.000Z' });
      const result = await lWWResolutionHandler.attemptResolve(
        { v1, v2, context: 'test' },
        storage,
      );
      expect(result.variant).toBe('resolved');
      expect(result.result).toBe(v2);
    });

    it('supports numeric epoch _ts values', async () => {
      const v1 = JSON.stringify({ data: 'a', _ts: 1000 });
      const v2 = JSON.stringify({ data: 'b', _ts: 2000 });
      const result = await lWWResolutionHandler.attemptResolve(
        { v1, v2, context: 'epoch' },
        storage,
      );
      expect(result.variant).toBe('resolved');
      expect(result.result).toBe(v2);
    });

    it('supports raw ISO timestamp strings', async () => {
      const v1 = '2026-06-01T12:00:00.000Z';
      const v2 = '2026-01-01T12:00:00.000Z';
      const result = await lWWResolutionHandler.attemptResolve(
        { v1, v2, context: 'raw-iso' },
        storage,
      );
      expect(result.variant).toBe('resolved');
      expect(result.result).toBe(v1);
    });

    it('returns cannotResolve when neither value has extractable timestamps', async () => {
      const result = await lWWResolutionHandler.attemptResolve(
        { v1: 'hello', v2: 'world', context: 'no-ts' },
        storage,
      );
      expect(result.variant).toBe('cannotResolve');
      expect(result.reason).toContain('timestamps');
    });

    it('returns cannotResolve when only one value has a timestamp', async () => {
      const v1 = JSON.stringify({ data: 'a', _ts: 1000 });
      const v2 = 'no-timestamp-here';
      const result = await lWWResolutionHandler.attemptResolve(
        { v1, v2, context: 'partial' },
        storage,
      );
      expect(result.variant).toBe('cannotResolve');
    });

    it('returns cannotResolve when timestamps are identical (exactly concurrent)', async () => {
      const ts = '2026-01-01T00:00:00.000Z';
      const v1 = JSON.stringify({ data: 'a', _ts: ts });
      const v2 = JSON.stringify({ data: 'b', _ts: ts });
      const result = await lWWResolutionHandler.attemptResolve(
        { v1, v2, context: 'tie' },
        storage,
      );
      expect(result.variant).toBe('cannotResolve');
      expect(result.reason).toContain('identical');
    });

    it('works with base parameter provided', async () => {
      const base = JSON.stringify({ data: 'original', _ts: '2026-01-01T00:00:00.000Z' });
      const v1 = JSON.stringify({ data: 'edit-a', _ts: '2026-01-02T00:00:00.000Z' });
      const v2 = JSON.stringify({ data: 'edit-b', _ts: '2026-01-03T00:00:00.000Z' });
      const result = await lWWResolutionHandler.attemptResolve(
        { base, v1, v2, context: 'with-base' },
        storage,
      );
      expect(result.variant).toBe('resolved');
      expect(result.result).toBe(v2); // v2 is latest
    });

    it('caches the resolution in storage', async () => {
      const v1 = JSON.stringify({ _ts: 1000 });
      const v2 = JSON.stringify({ _ts: 2000 });
      await lWWResolutionHandler.attemptResolve(
        { v1, v2, context: 'cache-test' },
        storage,
      );
      const records = await storage.find('lww-resolution', {});
      const cacheRecords = records.filter(r => r.resolvedAt !== undefined);
      expect(cacheRecords.length).toBeGreaterThan(0);
    });

    it('handles _ts as ISO string within JSON object', async () => {
      const v1 = JSON.stringify({ _ts: '2026-03-15T10:30:00.000Z' });
      const v2 = JSON.stringify({ _ts: '2026-03-15T10:29:00.000Z' });
      const result = await lWWResolutionHandler.attemptResolve(
        { v1, v2, context: 'iso-in-json' },
        storage,
      );
      expect(result.variant).toBe('resolved');
      expect(result.result).toBe(v1); // v1 is 1 minute later
    });

    it('picks the correct winner with very close timestamps', async () => {
      const v1 = JSON.stringify({ _ts: 1000001 });
      const v2 = JSON.stringify({ _ts: 1000000 });
      const result = await lWWResolutionHandler.attemptResolve(
        { v1, v2, context: 'close' },
        storage,
      );
      expect(result.variant).toBe('resolved');
      expect(result.result).toBe(v1); // v1 is 1ms later
    });
  });
});
