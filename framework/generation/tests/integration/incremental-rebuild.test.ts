// ============================================================
// Incremental Rebuild Integration Test
//
// Tests the full generation pipeline: Resource → BuildCache →
// Generator → Emitter → BuildCache record. Verifies that
// second runs with unchanged input skip generation.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/kernel';
import { resourceHandler } from '../../implementations/typescript/resource.impl.js';
import { buildCacheHandler } from '../../implementations/typescript/build-cache.impl.js';
import { emitterHandler } from '../../../../implementations/typescript/framework/emitter.impl.js';
import type { ConceptStorage } from '@clef/kernel';

/**
 * Simulates the generation pipeline that sync chains would orchestrate:
 * 1. Resource/upsert — detect source change
 * 2. BuildCache/check — check if generation is needed
 * 3. (If changed) Generate output
 * 4. Emitter/write — write generated files
 * 5. BuildCache/record — record successful generation
 */
async function runGenerationPipeline(
  resourceStorage: ConceptStorage,
  cacheStorage: ConceptStorage,
  emitterStorage: ConceptStorage,
  sourceLocator: string,
  sourceDigest: string,
  generatorName: string,
): Promise<{ skipped: boolean; filesWritten: number }> {
  // Step 1: Upsert resource
  await resourceHandler.upsert(
    { locator: sourceLocator, kind: 'concept-spec', digest: sourceDigest },
    resourceStorage,
  );

  // Step 2: Check build cache
  const stepKey = `framework:${generatorName}:${sourceLocator}`;
  const cacheCheck = await buildCacheHandler.check(
    { stepKey, inputHash: sourceDigest, deterministic: true },
    cacheStorage,
  );

  if (cacheCheck.variant === 'unchanged') {
    return { skipped: true, filesWritten: 0 };
  }

  // Step 3: Simulate generation (produce files)
  const generatedFiles = [
    { path: `generated/${sourceLocator.replace('.concept', '.types.ts')}`, content: `// Types for ${sourceLocator} v${sourceDigest}` },
    { path: `generated/${sourceLocator.replace('.concept', '.handler.ts')}`, content: `// Handler for ${sourceLocator} v${sourceDigest}` },
  ];

  // Step 4: Write via Emitter
  let filesWritten = 0;
  for (const file of generatedFiles) {
    const result = await emitterHandler.write(
      {
        path: file.path,
        content: file.content,
        sources: [{ sourcePath: sourceLocator }],
      },
      emitterStorage,
    );
    if (result.written) filesWritten++;
  }

  // Step 5: Record in build cache
  const outputHash = sourceDigest + ':output';
  await buildCacheHandler.record(
    {
      stepKey,
      inputHash: sourceDigest,
      outputHash,
      sourceLocator,
      deterministic: true,
    },
    cacheStorage,
  );

  return { skipped: false, filesWritten };
}

describe('Incremental rebuild integration', () => {
  let resourceStorage: ConceptStorage;
  let cacheStorage: ConceptStorage;
  let emitterStorage: ConceptStorage;

  beforeEach(() => {
    resourceStorage = createInMemoryStorage();
    cacheStorage = createInMemoryStorage();
    emitterStorage = createInMemoryStorage();
  });

  it('should execute generation on first run', async () => {
    const result = await runGenerationPipeline(
      resourceStorage, cacheStorage, emitterStorage,
      './specs/password.concept', 'digest-v1', 'TypeScriptGen',
    );

    expect(result.skipped).toBe(false);
    expect(result.filesWritten).toBe(2);
  });

  it('should skip generation on second run with same input', async () => {
    // First run
    await runGenerationPipeline(
      resourceStorage, cacheStorage, emitterStorage,
      './specs/password.concept', 'digest-v1', 'TypeScriptGen',
    );

    // Second run — same digest
    const result = await runGenerationPipeline(
      resourceStorage, cacheStorage, emitterStorage,
      './specs/password.concept', 'digest-v1', 'TypeScriptGen',
    );

    expect(result.skipped).toBe(true);
    expect(result.filesWritten).toBe(0);
  });

  it('should re-generate when input changes', async () => {
    // First run
    await runGenerationPipeline(
      resourceStorage, cacheStorage, emitterStorage,
      './specs/password.concept', 'digest-v1', 'TypeScriptGen',
    );

    // Second run — different digest
    const result = await runGenerationPipeline(
      resourceStorage, cacheStorage, emitterStorage,
      './specs/password.concept', 'digest-v2', 'TypeScriptGen',
    );

    expect(result.skipped).toBe(false);
    expect(result.filesWritten).toBe(2);
  });

  it('should handle multiple concepts independently', async () => {
    // Generate for two concepts
    await runGenerationPipeline(
      resourceStorage, cacheStorage, emitterStorage,
      './specs/password.concept', 'pw-v1', 'TypeScriptGen',
    );
    await runGenerationPipeline(
      resourceStorage, cacheStorage, emitterStorage,
      './specs/user.concept', 'user-v1', 'TypeScriptGen',
    );

    // Change only password
    const pwResult = await runGenerationPipeline(
      resourceStorage, cacheStorage, emitterStorage,
      './specs/password.concept', 'pw-v2', 'TypeScriptGen',
    );
    const userResult = await runGenerationPipeline(
      resourceStorage, cacheStorage, emitterStorage,
      './specs/user.concept', 'user-v1', 'TypeScriptGen',
    );

    expect(pwResult.skipped).toBe(false);   // password changed
    expect(userResult.skipped).toBe(true);   // user unchanged
  });

  it('should force rebuild after invalidateAll', async () => {
    // First run
    await runGenerationPipeline(
      resourceStorage, cacheStorage, emitterStorage,
      './specs/password.concept', 'digest-v1', 'TypeScriptGen',
    );

    // Invalidate all
    await buildCacheHandler.invalidateAll({}, cacheStorage);

    // Should re-generate even with same digest
    const result = await runGenerationPipeline(
      resourceStorage, cacheStorage, emitterStorage,
      './specs/password.concept', 'digest-v1', 'TypeScriptGen',
    );

    expect(result.skipped).toBe(false);
  });

  it('should track source provenance through Emitter', async () => {
    await runGenerationPipeline(
      resourceStorage, cacheStorage, emitterStorage,
      './specs/password.concept', 'digest-v1', 'TypeScriptGen',
    );

    // Trace: which source produced the types file?
    const trace = await emitterHandler.trace(
      { outputPath: 'generated/./specs/password.types.ts' },
      emitterStorage,
    );
    expect(trace.variant).toBe('ok');
    expect((trace.sources as any[])[0].sourcePath).toBe('./specs/password.concept');

    // Affected: what outputs come from password.concept?
    const affected = await emitterHandler.affected(
      { sourcePath: './specs/password.concept' },
      emitterStorage,
    );
    expect(affected.variant).toBe('ok');
    expect((affected.outputs as string[])).toHaveLength(2);
  });
});
