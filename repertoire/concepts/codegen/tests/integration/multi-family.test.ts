// ============================================================
// Multi-Family Integration Tests
//
// Validates that the generation pipeline works across multiple
// generator families (framework, interface, deploy) with
// independent cache entries and kind chains.
//
// See clef-generation-suite.md Part 2 (Kind System).
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/runtime';
import { buildCacheHandler } from '../../../../handlers/ts/framework/generation/build-cache.handler.js';
import { kindSystemHandler } from '../../../../handlers/ts/framework/generation/kind-system.handler.js';
import { generationPlanHandler } from '../../../../handlers/ts/framework/generation/generation-plan.handler.js';
import type { ConceptStorage } from '@clef/runtime';

describe('Multi-family integration', () => {
  let cacheStorage: ConceptStorage;
  let kindStorage: ConceptStorage;
  let planStorage: ConceptStorage;

  beforeEach(async () => {
    cacheStorage = createInMemoryStorage();
    kindStorage = createInMemoryStorage();
    planStorage = createInMemoryStorage();

    // Set up multi-family kind taxonomy
    // Framework family
    await kindSystemHandler.define({ name: 'ConceptManifest', category: 'model' }, kindStorage);
    await kindSystemHandler.define({ name: 'TypeScriptFiles', category: 'artifact' }, kindStorage);
    await kindSystemHandler.define({ name: 'RustFiles', category: 'artifact' }, kindStorage);
    await kindSystemHandler.connect(
      { from: 'ConceptManifest', to: 'TypeScriptFiles', relation: 'renders_to', transformName: 'TypeScriptGen' },
      kindStorage,
    );
    await kindSystemHandler.connect(
      { from: 'ConceptManifest', to: 'RustFiles', relation: 'renders_to', transformName: 'RustGen' },
      kindStorage,
    );

    // Interface family
    await kindSystemHandler.define({ name: 'Projection', category: 'model' }, kindStorage);
    await kindSystemHandler.define({ name: 'RestRoutes', category: 'artifact' }, kindStorage);
    await kindSystemHandler.define({ name: 'CliCommands', category: 'artifact' }, kindStorage);
    await kindSystemHandler.connect(
      { from: 'ConceptManifest', to: 'Projection', relation: 'normalizes_to', transformName: 'Projection' },
      kindStorage,
    );
    await kindSystemHandler.connect(
      { from: 'Projection', to: 'RestRoutes', relation: 'renders_to', transformName: 'RestTarget' },
      kindStorage,
    );
    await kindSystemHandler.connect(
      { from: 'Projection', to: 'CliCommands', relation: 'renders_to', transformName: 'CliTarget' },
      kindStorage,
    );
  });

  it('should track independent cache entries for each generator family', async () => {
    // Record framework family entries
    await buildCacheHandler.record(
      { stepKey: 'framework:TypeScriptGen:Auth', inputHash: 'h1', outputHash: 'o1', deterministic: true },
      cacheStorage,
    );
    await buildCacheHandler.record(
      { stepKey: 'framework:RustGen:Auth', inputHash: 'h1', outputHash: 'o2', deterministic: true },
      cacheStorage,
    );

    // Record interface family entries
    await buildCacheHandler.record(
      { stepKey: 'interface:RestTarget:Auth', inputHash: 'h2', outputHash: 'o3', deterministic: true },
      cacheStorage,
    );
    await buildCacheHandler.record(
      { stepKey: 'interface:CliTarget:Auth', inputHash: 'h2', outputHash: 'o4', deterministic: true },
      cacheStorage,
    );

    // All should be cached
    const checks = await Promise.all([
      buildCacheHandler.check({ stepKey: 'framework:TypeScriptGen:Auth', inputHash: 'h1', deterministic: true }, cacheStorage),
      buildCacheHandler.check({ stepKey: 'framework:RustGen:Auth', inputHash: 'h1', deterministic: true }, cacheStorage),
      buildCacheHandler.check({ stepKey: 'interface:RestTarget:Auth', inputHash: 'h2', deterministic: true }, cacheStorage),
      buildCacheHandler.check({ stepKey: 'interface:CliTarget:Auth', inputHash: 'h2', deterministic: true }, cacheStorage),
    ]);

    for (const check of checks) {
      expect(check.variant).toBe('unchanged');
    }
  });

  it('should route through full pipeline chains', async () => {
    // Route from ConceptManifest to CliCommands
    const route = await kindSystemHandler.route(
      { from: 'ConceptManifest', to: 'CliCommands' },
      kindStorage,
    );
    expect(route.variant).toBe('ok');

    const path = route.path as { kind: string }[];
    expect(path.length).toBe(2); // Projection, then CliCommands
    expect(path[0].kind).toBe('Projection');
    expect(path[1].kind).toBe('CliCommands');
  });

  it('should track steps from multiple families in a single generation run', async () => {
    const beginResult = await generationPlanHandler.begin({}, planStorage);
    const runId = beginResult.run as string;

    // Framework steps
    await generationPlanHandler.recordStep(
      { stepKey: 'framework:TypeScriptGen:Auth', status: 'done', filesProduced: 4, duration: 50, cached: false },
      planStorage,
    );
    await generationPlanHandler.recordStep(
      { stepKey: 'framework:RustGen:Auth', status: 'done', filesProduced: 3, duration: 80, cached: false },
      planStorage,
    );

    // Interface steps
    await generationPlanHandler.recordStep(
      { stepKey: 'interface:RestTarget:Auth', status: 'done', filesProduced: 2, duration: 30, cached: false },
      planStorage,
    );
    await generationPlanHandler.recordStep(
      { stepKey: 'interface:CliTarget:Auth', status: 'cached', cached: true },
      planStorage,
    );

    await generationPlanHandler.complete({}, planStorage);

    // Summary should aggregate across families
    const summary = await generationPlanHandler.summary({ run: runId }, planStorage);
    expect(summary.total).toBe(4);
    expect(summary.executed).toBe(3);
    expect(summary.cached).toBe(1);
    expect(summary.filesProduced).toBe(9);
  });

  it('should find consumers of a shared kind', async () => {
    // ConceptManifest is consumed by TypeScriptGen, RustGen, and Projection
    const consumers = await kindSystemHandler.consumers(
      { kind: 'ConceptManifest' },
      kindStorage,
    );
    const transforms = (consumers.transforms as { toKind: string; transformName: string }[]) || [];

    expect(transforms.length).toBe(3);
    const names = transforms.map(t => t.transformName).sort();
    expect(names).toContain('TypeScriptGen');
    expect(names).toContain('RustGen');
    expect(names).toContain('Projection');
  });
});
