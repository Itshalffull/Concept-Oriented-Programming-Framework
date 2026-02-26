// ============================================================
// Cascade Invalidation Integration Tests
//
// Validates the full invalidation cascade path:
//   Resource change → BuildCache invalidate → KindSystem
//   dependents → cascade invalidation of downstream steps.
//
// See clef-generation-suite.md Part 3 (Sync Graph).
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/kernel';
import { resourceHandler } from '../../implementations/typescript/resource.impl.js';
import { buildCacheHandler } from '../../implementations/typescript/build-cache.impl.js';
import { kindSystemHandler } from '../../implementations/typescript/kind-system.impl.js';
import type { ConceptStorage } from '@clef/kernel';

describe('Cascade invalidation integration', () => {
  let resourceStorage: ConceptStorage;
  let cacheStorage: ConceptStorage;
  let kindStorage: ConceptStorage;

  beforeEach(async () => {
    resourceStorage = createInMemoryStorage();
    cacheStorage = createInMemoryStorage();
    kindStorage = createInMemoryStorage();

    // Set up kind taxonomy: source → model → artifact
    await kindSystemHandler.define({ name: 'ConceptDSL', category: 'source' }, kindStorage);
    await kindSystemHandler.define({ name: 'ConceptManifest', category: 'model' }, kindStorage);
    await kindSystemHandler.define({ name: 'TypeScriptFiles', category: 'artifact' }, kindStorage);
    await kindSystemHandler.connect(
      { from: 'ConceptDSL', to: 'ConceptManifest', relation: 'parses_to', transformName: 'SchemaGen' },
      kindStorage,
    );
    await kindSystemHandler.connect(
      { from: 'ConceptManifest', to: 'TypeScriptFiles', relation: 'renders_to', transformName: 'TypeScriptGen' },
      kindStorage,
    );

    // Populate cache entries
    await buildCacheHandler.record(
      {
        stepKey: 'framework:SchemaGen:Password',
        inputHash: 'aaa',
        outputHash: 'bbb',
        sourceLocator: 'specs/password.concept',
        deterministic: true,
        kind: 'ConceptManifest',
      },
      cacheStorage,
    );
    await buildCacheHandler.record(
      {
        stepKey: 'framework:TypeScriptGen:Password',
        inputHash: 'bbb',
        outputHash: 'ccc',
        sourceLocator: 'specs/password.concept',
        deterministic: true,
        kind: 'TypeScriptFiles',
      },
      cacheStorage,
    );
  });

  it('should invalidate direct cache entry when source changes', async () => {
    // Resource changes
    await resourceHandler.upsert(
      { locator: 'specs/password.concept', kind: 'ConceptDSL', digest: 'new-digest' },
      resourceStorage,
    );

    // Invalidate by source
    const result = await buildCacheHandler.invalidateBySource(
      { sourceLocator: 'specs/password.concept' },
      cacheStorage,
    );
    expect(result.variant).toBe('ok');
    const invalidated = result.invalidated as string[];
    expect(invalidated.length).toBeGreaterThanOrEqual(1);

    // Verify SchemaGen step is now stale
    const check = await buildCacheHandler.check(
      { stepKey: 'framework:SchemaGen:Password', inputHash: 'aaa', deterministic: true },
      cacheStorage,
    );
    expect(check.variant).toBe('changed');
  });

  it('should cascade invalidation to downstream kind steps', async () => {
    // Get dependents of ConceptManifest
    const dependents = await kindSystemHandler.dependents(
      { kind: 'ConceptManifest' },
      kindStorage,
    );
    const depKinds = (dependents.downstream as string[]) || [];
    expect(depKinds).toContain('TypeScriptFiles');

    // Invalidate by kind (simulates cascade)
    const result = await buildCacheHandler.invalidateByKind(
      { kind: 'TypeScriptFiles' },
      cacheStorage,
    );
    expect(result.variant).toBe('ok');

    // Verify TypeScriptGen step is now stale
    const check = await buildCacheHandler.check(
      { stepKey: 'framework:TypeScriptGen:Password', inputHash: 'bbb', deterministic: true },
      cacheStorage,
    );
    expect(check.variant).toBe('changed');
  });

  it('should cascade invalidation through full source → model → artifact chain', async () => {
    // 1. Source change invalidates model step
    await buildCacheHandler.invalidateBySource(
      { sourceLocator: 'specs/password.concept' },
      cacheStorage,
    );

    // 2. Model step invalidation triggers kind-based cascade
    // Get dependents of the model kind
    const dependents = await kindSystemHandler.dependents(
      { kind: 'ConceptManifest' },
      kindStorage,
    );
    const depKinds = (dependents.downstream as string[]) || [];

    // 3. Invalidate all dependent kinds
    for (const kind of depKinds) {
      await buildCacheHandler.invalidateByKind({ kind }, cacheStorage);
    }

    // 4. Verify entire chain is invalidated
    const schemaCheck = await buildCacheHandler.check(
      { stepKey: 'framework:SchemaGen:Password', inputHash: 'aaa', deterministic: true },
      cacheStorage,
    );
    const tsCheck = await buildCacheHandler.check(
      { stepKey: 'framework:TypeScriptGen:Password', inputHash: 'bbb', deterministic: true },
      cacheStorage,
    );

    expect(schemaCheck.variant).toBe('changed');
    expect(tsCheck.variant).toBe('changed');
  });

  it('should not cascade to unrelated kind chains', async () => {
    // Add a parallel chain: SolidityFiles from ConceptManifest
    await kindSystemHandler.define({ name: 'SolidityFiles', category: 'artifact' }, kindStorage);
    await kindSystemHandler.connect(
      { from: 'ConceptManifest', to: 'SolidityFiles', relation: 'renders_to', transformName: 'SolidityGen' },
      kindStorage,
    );

    // Record a Solidity cache entry
    await buildCacheHandler.record(
      {
        stepKey: 'framework:SolidityGen:Password',
        inputHash: 'bbb',
        outputHash: 'ddd',
        deterministic: true,
        kind: 'SolidityFiles',
      },
      cacheStorage,
    );

    // Invalidate only TypeScriptFiles kind
    await buildCacheHandler.invalidateByKind(
      { kind: 'TypeScriptFiles' },
      cacheStorage,
    );

    // TypeScriptGen should be invalidated
    const tsCheck = await buildCacheHandler.check(
      { stepKey: 'framework:TypeScriptGen:Password', inputHash: 'bbb', deterministic: true },
      cacheStorage,
    );
    expect(tsCheck.variant).toBe('changed');

    // SolidityGen should still be cached
    const solCheck = await buildCacheHandler.check(
      { stepKey: 'framework:SolidityGen:Password', inputHash: 'bbb', deterministic: true },
      cacheStorage,
    );
    expect(solCheck.variant).toBe('unchanged');
  });
});
