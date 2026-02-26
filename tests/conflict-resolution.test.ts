// ============================================================
// ConflictResolution Concept Handler Tests
//
// Validates detect, resolve, manualResolve, and registerPolicy
// actions including happy paths, error cases, and multi-step
// sequences for the collaboration suite's conflict resolution concept.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  conflictResolutionHandler,
  resetConflictResolutionCounter,
} from '../handlers/ts/conflict-resolution.handler.js';

describe('ConflictResolution', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetConflictResolutionCounter();
  });

  // ---- registerPolicy ----

  describe('registerPolicy', () => {
    it('registers a new policy and returns ok with the policy ID', async () => {
      const result = await conflictResolutionHandler.registerPolicy(
        { name: 'lww', priority: 10 },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.policy).toBe('policy-1');
    });

    it('returns duplicate when registering the same policy name twice', async () => {
      await conflictResolutionHandler.registerPolicy(
        { name: 'lww', priority: 10 },
        storage,
      );
      const result = await conflictResolutionHandler.registerPolicy(
        { name: 'lww', priority: 20 },
        storage,
      );
      expect(result.variant).toBe('duplicate');
      expect(result.message).toContain('lww');
    });

    it('allows registering multiple distinct policies', async () => {
      const r1 = await conflictResolutionHandler.registerPolicy(
        { name: 'lww', priority: 10 },
        storage,
      );
      const r2 = await conflictResolutionHandler.registerPolicy(
        { name: 'manual', priority: 99 },
        storage,
      );
      expect(r1.variant).toBe('ok');
      expect(r2.variant).toBe('ok');
      expect(r1.policy).not.toBe(r2.policy);
    });
  });

  // ---- detect ----

  describe('detect', () => {
    it('returns noConflict when versions are identical', async () => {
      const result = await conflictResolutionHandler.detect(
        { version1: 'abc', version2: 'abc', context: 'field-merge' },
        storage,
      );
      expect(result.variant).toBe('noConflict');
    });

    it('returns detected when versions differ', async () => {
      const result = await conflictResolutionHandler.detect(
        { base: 'original', version1: 'v1', version2: 'v2', context: 'text-edit' },
        storage,
      );
      expect(result.variant).toBe('detected');
      expect(result.conflictId).toBeDefined();
      const detail = JSON.parse(result.detail as string);
      expect(detail.base).toBe('original');
      expect(detail.version1).toBe('v1');
      expect(detail.version2).toBe('v2');
      expect(detail.context).toBe('text-edit');
    });

    it('stores the conflict in storage as pending', async () => {
      const result = await conflictResolutionHandler.detect(
        { version1: 'a', version2: 'b', context: 'ctx' },
        storage,
      );
      const stored = await storage.get('conflict-resolution', result.conflictId as string);
      expect(stored).not.toBeNull();
      expect(stored!.status).toBe('pending');
      expect(stored!.resolution).toBeNull();
    });

    it('handles missing base gracefully', async () => {
      const result = await conflictResolutionHandler.detect(
        { version1: 'x', version2: 'y', context: 'no-base' },
        storage,
      );
      expect(result.variant).toBe('detected');
      const detail = JSON.parse(result.detail as string);
      expect(detail.base).toBeNull();
    });
  });

  // ---- resolve ----

  describe('resolve', () => {
    it('returns noPolicy when conflict ID does not exist', async () => {
      const result = await conflictResolutionHandler.resolve(
        { conflictId: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('noPolicy');
      expect(result.message).toContain('nonexistent');
    });

    it('returns noPolicy when no policies are registered', async () => {
      const detected = await conflictResolutionHandler.detect(
        { version1: 'a', version2: 'b', context: 'ctx' },
        storage,
      );
      const result = await conflictResolutionHandler.resolve(
        { conflictId: detected.conflictId },
        storage,
      );
      expect(result.variant).toBe('noPolicy');
      expect(result.message).toContain('No resolution policies registered');
    });

    it('returns noPolicy when override policy name does not match any registered', async () => {
      await conflictResolutionHandler.registerPolicy(
        { name: 'lww', priority: 10 },
        storage,
      );
      const detected = await conflictResolutionHandler.detect(
        { version1: 'a', version2: 'b', context: 'ctx' },
        storage,
      );
      const result = await conflictResolutionHandler.resolve(
        { conflictId: detected.conflictId, policyOverride: 'nonexistent-policy' },
        storage,
      );
      expect(result.variant).toBe('noPolicy');
      expect(result.message).toContain('nonexistent-policy');
    });

    it('returns requiresHuman when no automatic resolution is available', async () => {
      await conflictResolutionHandler.registerPolicy(
        { name: 'lww', priority: 10 },
        storage,
      );
      const detected = await conflictResolutionHandler.detect(
        { base: 'orig', version1: 'v1', version2: 'v2', context: 'ctx' },
        storage,
      );
      const result = await conflictResolutionHandler.resolve(
        { conflictId: detected.conflictId },
        storage,
      );
      expect(result.variant).toBe('requiresHuman');
      expect(result.conflictId).toBe(detected.conflictId);
      expect(result.options).toBeDefined();
      const options = result.options as string[];
      // Should include version1, version2, and base
      expect(options.length).toBe(3);
    });

    it('returns requiresHuman options without base when base is null', async () => {
      await conflictResolutionHandler.registerPolicy(
        { name: 'lww', priority: 10 },
        storage,
      );
      const detected = await conflictResolutionHandler.detect(
        { version1: 'v1', version2: 'v2', context: 'ctx' },
        storage,
      );
      const result = await conflictResolutionHandler.resolve(
        { conflictId: detected.conflictId },
        storage,
      );
      expect(result.variant).toBe('requiresHuman');
      const options = result.options as string[];
      // Only version1 and version2 (no base)
      expect(options.length).toBe(2);
    });

    it('returns resolved when conflict already has a resolution set', async () => {
      const detected = await conflictResolutionHandler.detect(
        { version1: 'a', version2: 'b', context: 'ctx' },
        storage,
      );

      // Manually set the resolution on the conflict record
      const conflict = await storage.get('conflict-resolution', detected.conflictId as string);
      await storage.put('conflict-resolution', detected.conflictId as string, {
        ...conflict!,
        resolution: 'merged-result',
      });

      await conflictResolutionHandler.registerPolicy(
        { name: 'auto', priority: 1 },
        storage,
      );

      const result = await conflictResolutionHandler.resolve(
        { conflictId: detected.conflictId },
        storage,
      );
      expect(result.variant).toBe('resolved');
      expect(result.result).toBe('merged-result');
    });
  });

  // ---- manualResolve ----

  describe('manualResolve', () => {
    it('resolves a pending conflict with the chosen value', async () => {
      const detected = await conflictResolutionHandler.detect(
        { version1: 'v1', version2: 'v2', context: 'ctx' },
        storage,
      );
      const result = await conflictResolutionHandler.manualResolve(
        { conflictId: detected.conflictId, chosen: 'v1' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.result).toBe('v1');
    });

    it('marks the conflict as resolved in storage', async () => {
      const detected = await conflictResolutionHandler.detect(
        { version1: 'v1', version2: 'v2', context: 'ctx' },
        storage,
      );
      await conflictResolutionHandler.manualResolve(
        { conflictId: detected.conflictId, chosen: 'v2' },
        storage,
      );
      const stored = await storage.get('conflict-resolution', detected.conflictId as string);
      expect(stored!.status).toBe('resolved');
      expect(stored!.resolution).toBe('v2');
    });

    it('returns notPending when conflict does not exist', async () => {
      const result = await conflictResolutionHandler.manualResolve(
        { conflictId: 'ghost', chosen: 'x' },
        storage,
      );
      expect(result.variant).toBe('notPending');
      expect(result.message).toContain('not found');
    });

    it('returns notPending when conflict was already resolved', async () => {
      const detected = await conflictResolutionHandler.detect(
        { version1: 'v1', version2: 'v2', context: 'ctx' },
        storage,
      );
      await conflictResolutionHandler.manualResolve(
        { conflictId: detected.conflictId, chosen: 'v1' },
        storage,
      );
      const result = await conflictResolutionHandler.manualResolve(
        { conflictId: detected.conflictId, chosen: 'v2' },
        storage,
      );
      expect(result.variant).toBe('notPending');
      expect(result.message).toContain('already resolved');
    });
  });

  // ---- Multi-step sequences ----

  describe('full detect-then-resolve workflow', () => {
    it('detect -> registerPolicy -> resolve -> manualResolve sequence', async () => {
      // Detect a conflict
      const detected = await conflictResolutionHandler.detect(
        { base: 'base', version1: 'edit-A', version2: 'edit-B', context: 'doc-merge' },
        storage,
      );
      expect(detected.variant).toBe('detected');

      // Register a policy
      await conflictResolutionHandler.registerPolicy(
        { name: 'manual', priority: 99 },
        storage,
      );

      // Attempt automatic resolve - should escalate to human
      const autoResult = await conflictResolutionHandler.resolve(
        { conflictId: detected.conflictId },
        storage,
      );
      expect(autoResult.variant).toBe('requiresHuman');

      // Human picks version1
      const manualResult = await conflictResolutionHandler.manualResolve(
        { conflictId: detected.conflictId, chosen: 'edit-A' },
        storage,
      );
      expect(manualResult.variant).toBe('ok');
      expect(manualResult.result).toBe('edit-A');

      // Verify storage state
      const stored = await storage.get('conflict-resolution', detected.conflictId as string);
      expect(stored!.status).toBe('resolved');
      expect(stored!.resolution).toBe('edit-A');
    });

    it('handles multiple concurrent conflicts independently', async () => {
      const d1 = await conflictResolutionHandler.detect(
        { version1: 'a1', version2: 'a2', context: 'field-a' },
        storage,
      );
      const d2 = await conflictResolutionHandler.detect(
        { version1: 'b1', version2: 'b2', context: 'field-b' },
        storage,
      );

      expect(d1.conflictId).not.toBe(d2.conflictId);

      // Resolve first conflict
      await conflictResolutionHandler.manualResolve(
        { conflictId: d1.conflictId, chosen: 'a1' },
        storage,
      );

      // Second should still be pending
      const s2 = await storage.get('conflict-resolution', d2.conflictId as string);
      expect(s2!.status).toBe('pending');

      // Resolve second conflict
      await conflictResolutionHandler.manualResolve(
        { conflictId: d2.conflictId, chosen: 'b2' },
        storage,
      );

      const s2After = await storage.get('conflict-resolution', d2.conflictId as string);
      expect(s2After!.status).toBe('resolved');
      expect(s2After!.resolution).toBe('b2');
    });
  });
});
