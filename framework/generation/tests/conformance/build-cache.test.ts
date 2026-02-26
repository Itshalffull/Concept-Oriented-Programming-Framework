// ============================================================
// BuildCache Conformance Tests
//
// Validates incremental detection: check/record/invalidate
// cycle, cascading invalidation, staleness tracking.
// See copf-generation-kit.md Part 1.3
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@copf/kernel';
import { buildCacheHandler } from '../../implementations/typescript/build-cache.impl.js';
import type { ConceptStorage } from '@copf/kernel';

describe('BuildCache conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- check with no entry ---

  it('should return changed when no cache entry exists', async () => {
    const result = await buildCacheHandler.check(
      { stepKey: 'framework:TypeScriptGen:password', inputHash: 'abc', deterministic: true },
      storage,
    );
    expect(result.variant).toBe('changed');
    expect(result.previousHash).toBeNull();
  });

  // --- record then check ---

  it('should return unchanged after recording with same input hash', async () => {
    await buildCacheHandler.record(
      {
        stepKey: 'framework:TypeScriptGen:password',
        inputHash: 'abc',
        outputHash: 'xyz',
        outputRef: '.copf-cache/ts/password',
        sourceLocator: './specs/password.concept',
        deterministic: true,
      },
      storage,
    );

    const result = await buildCacheHandler.check(
      { stepKey: 'framework:TypeScriptGen:password', inputHash: 'abc', deterministic: true },
      storage,
    );
    expect(result.variant).toBe('unchanged');
    expect(result.lastRun).toBeDefined();
    expect(result.outputRef).toBe('.copf-cache/ts/password');
  });

  it('should return changed when input hash differs', async () => {
    await buildCacheHandler.record(
      {
        stepKey: 'framework:TypeScriptGen:password',
        inputHash: 'abc',
        outputHash: 'xyz',
        deterministic: true,
      },
      storage,
    );

    const result = await buildCacheHandler.check(
      { stepKey: 'framework:TypeScriptGen:password', inputHash: 'def', deterministic: true },
      storage,
    );
    expect(result.variant).toBe('changed');
    expect(result.previousHash).toBe('abc');
  });

  // --- nondeterministic ---

  it('should always return changed for nondeterministic transforms', async () => {
    await buildCacheHandler.record(
      {
        stepKey: 'framework:NonDetGen:password',
        inputHash: 'abc',
        outputHash: 'xyz',
        deterministic: false,
      },
      storage,
    );

    const result = await buildCacheHandler.check(
      { stepKey: 'framework:NonDetGen:password', inputHash: 'abc', deterministic: false },
      storage,
    );
    expect(result.variant).toBe('changed');
  });

  // --- invalidate ---

  it('should mark entry as stale on invalidate', async () => {
    await buildCacheHandler.record(
      {
        stepKey: 'framework:TypeScriptGen:password',
        inputHash: 'abc',
        outputHash: 'xyz',
        deterministic: true,
      },
      storage,
    );

    await buildCacheHandler.invalidate(
      { stepKey: 'framework:TypeScriptGen:password' },
      storage,
    );

    // Same hash should now return changed (stale)
    const result = await buildCacheHandler.check(
      { stepKey: 'framework:TypeScriptGen:password', inputHash: 'abc', deterministic: true },
      storage,
    );
    expect(result.variant).toBe('changed');
  });

  it('should return notFound when invalidating nonexistent entry', async () => {
    const result = await buildCacheHandler.invalidate(
      { stepKey: 'nonexistent' },
      storage,
    );
    expect(result.variant).toBe('notFound');
  });

  // --- invalidateBySource ---

  it('should invalidate all entries for a source locator', async () => {
    await buildCacheHandler.record(
      {
        stepKey: 'framework:TypeScriptGen:password',
        inputHash: 'a1',
        outputHash: 'o1',
        sourceLocator: './specs/password.concept',
        deterministic: true,
      },
      storage,
    );
    await buildCacheHandler.record(
      {
        stepKey: 'framework:RustGen:password',
        inputHash: 'a2',
        outputHash: 'o2',
        sourceLocator: './specs/password.concept',
        deterministic: true,
      },
      storage,
    );
    await buildCacheHandler.record(
      {
        stepKey: 'framework:TypeScriptGen:user',
        inputHash: 'a3',
        outputHash: 'o3',
        sourceLocator: './specs/user.concept',
        deterministic: true,
      },
      storage,
    );

    const result = await buildCacheHandler.invalidateBySource(
      { sourceLocator: './specs/password.concept' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const invalidated = result.invalidated as string[];
    expect(invalidated).toHaveLength(2);
    expect(invalidated).toContain('framework:TypeScriptGen:password');
    expect(invalidated).toContain('framework:RustGen:password');

    // user entry should not be stale
    const userCheck = await buildCacheHandler.check(
      { stepKey: 'framework:TypeScriptGen:user', inputHash: 'a3', deterministic: true },
      storage,
    );
    expect(userCheck.variant).toBe('unchanged');
  });

  // --- invalidateByKind ---

  it('should invalidate entries matching kind name', async () => {
    await buildCacheHandler.record(
      {
        stepKey: 'framework:TypeScriptGen:password',
        inputHash: 'a1',
        outputHash: 'o1',
        deterministic: true,
      },
      storage,
    );

    const result = await buildCacheHandler.invalidateByKind(
      { kindName: 'TypeScriptGen' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect((result.invalidated as string[])).toContain('framework:TypeScriptGen:password');
  });

  // --- invalidateAll ---

  it('should mark all entries as stale', async () => {
    await buildCacheHandler.record(
      { stepKey: 'step1', inputHash: 'a', outputHash: 'b', deterministic: true },
      storage,
    );
    await buildCacheHandler.record(
      { stepKey: 'step2', inputHash: 'c', outputHash: 'd', deterministic: true },
      storage,
    );

    const result = await buildCacheHandler.invalidateAll({}, storage);
    expect(result.variant).toBe('ok');
    expect(result.cleared).toBe(2);

    // Both should now be stale
    const check1 = await buildCacheHandler.check(
      { stepKey: 'step1', inputHash: 'a', deterministic: true },
      storage,
    );
    expect(check1.variant).toBe('changed');

    const check2 = await buildCacheHandler.check(
      { stepKey: 'step2', inputHash: 'c', deterministic: true },
      storage,
    );
    expect(check2.variant).toBe('changed');
  });

  // --- status ---

  it('should return status of all entries', async () => {
    await buildCacheHandler.record(
      { stepKey: 'step1', inputHash: 'a', outputHash: 'b', deterministic: true },
      storage,
    );
    await buildCacheHandler.record(
      { stepKey: 'step2', inputHash: 'c', outputHash: 'd', deterministic: true },
      storage,
    );
    await buildCacheHandler.invalidate({ stepKey: 'step2' }, storage);

    const result = await buildCacheHandler.status({}, storage);
    expect(result.variant).toBe('ok');
    const entries = result.entries as any[];
    expect(entries).toHaveLength(2);

    const step1 = entries.find((e: any) => e.stepKey === 'step1');
    const step2 = entries.find((e: any) => e.stepKey === 'step2');
    expect(step1.stale).toBe(false);
    expect(step2.stale).toBe(true);
  });

  // --- staleSteps ---

  it('should return only stale step keys', async () => {
    await buildCacheHandler.record(
      { stepKey: 'step1', inputHash: 'a', outputHash: 'b', deterministic: true },
      storage,
    );
    await buildCacheHandler.record(
      { stepKey: 'step2', inputHash: 'c', outputHash: 'd', deterministic: true },
      storage,
    );
    await buildCacheHandler.invalidate({ stepKey: 'step2' }, storage);

    const result = await buildCacheHandler.staleSteps({}, storage);
    expect(result.variant).toBe('ok');
    const steps = result.steps as string[];
    expect(steps).toEqual(['step2']);
  });

  // --- re-record clears staleness ---

  it('should clear stale flag when re-recording a step', async () => {
    await buildCacheHandler.record(
      { stepKey: 'step1', inputHash: 'a', outputHash: 'b', deterministic: true },
      storage,
    );
    await buildCacheHandler.invalidate({ stepKey: 'step1' }, storage);

    // Re-record
    await buildCacheHandler.record(
      { stepKey: 'step1', inputHash: 'a2', outputHash: 'b2', deterministic: true },
      storage,
    );

    const check = await buildCacheHandler.check(
      { stepKey: 'step1', inputHash: 'a2', deterministic: true },
      storage,
    );
    expect(check.variant).toBe('unchanged');
  });
});
