// ============================================================
// ManualResolution Concept Handler Tests
//
// Validates register and attemptResolve actions for the manual
// conflict resolution provider. Verifies that it always defers
// to human review (cannotResolve) and stores conflict details
// for later retrieval.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  manualResolutionHandler,
  resetManualResolutionCounter,
} from '../handlers/ts/manual-resolution.handler.js';

describe('ManualResolution', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetManualResolutionCounter();
  });

  // ---- register ----

  describe('register', () => {
    it('registers the manual resolution provider with lowest priority', async () => {
      const result = await manualResolutionHandler.register({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.name).toBe('manual');
      expect(result.category).toBe('conflict-resolution');
      expect(result.priority).toBe(99);
    });

    it('persists the registration to storage', async () => {
      await manualResolutionHandler.register({}, storage);
      const records = await storage.find('manual-resolution', { name: 'manual' });
      expect(records.length).toBeGreaterThan(0);
    });
  });

  // ---- attemptResolve ----

  describe('attemptResolve', () => {
    it('always returns cannotResolve (defers to human)', async () => {
      const result = await manualResolutionHandler.attemptResolve(
        {
          v1: 'value-a',
          v2: 'value-b',
          context: 'field-edit',
        },
        storage,
      );
      expect(result.variant).toBe('cannotResolve');
      expect(result.reason).toContain('Manual resolution required');
      expect(result.reason).toContain('human review');
    });

    it('stores the conflict details for later human review', async () => {
      await manualResolutionHandler.attemptResolve(
        {
          base: 'original',
          v1: 'edit-a',
          v2: 'edit-b',
          context: 'document-merge',
        },
        storage,
      );
      const records = await storage.find('manual-resolution', { status: 'pending' });
      expect(records.length).toBeGreaterThan(0);

      const conflict = records[0];
      expect(conflict.v1).toBe('edit-a');
      expect(conflict.v2).toBe('edit-b');
      expect(conflict.base).toBe('original');
      expect(conflict.context).toBe('document-merge');
    });

    it('stores candidates including v1, v2, and base when base is provided', async () => {
      await manualResolutionHandler.attemptResolve(
        {
          base: 'base-val',
          v1: 'val-1',
          v2: 'val-2',
          context: 'test',
        },
        storage,
      );
      const records = await storage.find('manual-resolution', { status: 'pending' });
      const candidates = JSON.parse(records[0].candidates as string);
      expect(candidates).toContain('val-1');
      expect(candidates).toContain('val-2');
      expect(candidates).toContain('base-val');
      expect(candidates.length).toBe(3);
    });

    it('stores candidates without base when base is not provided', async () => {
      await manualResolutionHandler.attemptResolve(
        {
          v1: 'val-1',
          v2: 'val-2',
          context: 'test',
        },
        storage,
      );
      const records = await storage.find('manual-resolution', { status: 'pending' });
      const candidates = JSON.parse(records[0].candidates as string);
      expect(candidates).toEqual(['val-1', 'val-2']);
    });

    it('returns cannotResolve regardless of input content types', async () => {
      // Even with JSON arrays that add-wins could resolve
      const result = await manualResolutionHandler.attemptResolve(
        {
          v1: JSON.stringify(['a', 'b']),
          v2: JSON.stringify(['c', 'd']),
          context: 'sets',
        },
        storage,
      );
      expect(result.variant).toBe('cannotResolve');
    });

    it('returns cannotResolve regardless of timestamped content', async () => {
      // Even with LWW-compatible timestamps
      const result = await manualResolutionHandler.attemptResolve(
        {
          v1: JSON.stringify({ _ts: 1000, value: 'old' }),
          v2: JSON.stringify({ _ts: 2000, value: 'new' }),
          context: 'lww-compat',
        },
        storage,
      );
      expect(result.variant).toBe('cannotResolve');
    });

    it('assigns unique conflict IDs', async () => {
      await manualResolutionHandler.attemptResolve(
        { v1: 'a', v2: 'b', context: 'c1' },
        storage,
      );
      await manualResolutionHandler.attemptResolve(
        { v1: 'x', v2: 'y', context: 'c2' },
        storage,
      );
      const records = await storage.find('manual-resolution', { status: 'pending' });
      const ids = records.map(r => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('records createdAt timestamp', async () => {
      await manualResolutionHandler.attemptResolve(
        { v1: 'a', v2: 'b', context: 'ts-check' },
        storage,
      );
      const records = await storage.find('manual-resolution', { status: 'pending' });
      expect(records[0].createdAt).toBeDefined();
      // Should be a valid ISO date
      expect(new Date(records[0].createdAt as string).toISOString()).toBe(records[0].createdAt);
    });
  });

  // ---- Multi-step: Manual is the last-resort policy ----

  describe('last-resort behavior', () => {
    it('manual resolution has the highest priority number (lowest precedence)', async () => {
      const result = await manualResolutionHandler.register({}, storage);
      // Priority 99 means it runs last among resolution providers
      expect(result.priority).toBe(99);
    });

    it('accumulates multiple pending conflicts for batch human review', async () => {
      for (let i = 0; i < 5; i++) {
        await manualResolutionHandler.attemptResolve(
          { v1: `left-${i}`, v2: `right-${i}`, context: `conflict-${i}` },
          storage,
        );
      }
      const pending = await storage.find('manual-resolution', { status: 'pending' });
      expect(pending.length).toBe(5);
    });
  });
});
