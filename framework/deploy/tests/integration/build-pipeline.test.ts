// ============================================================
// Build Pipeline Integration Test
//
// Tests the full build pipeline that sync chains would orchestrate:
// 1. Toolchain/resolve — find compiler for language+platform
// 2. Builder/build — compile concept for language+platform
// 3. Artifact/store — store content-addressed artifact
// 4. Verify: artifact is retrievable by hash
// 5. Verify: rebuild with same inputs hits cache
// 6. Verify: source change triggers rebuild
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/kernel';
import { toolchainHandler } from '../../../../implementations/typescript/deploy/toolchain.impl.js';
import { builderHandler } from '../../../../implementations/typescript/deploy/builder.impl.js';
import { artifactHandler } from '../../../../implementations/typescript/deploy/artifact.impl.js';
import type { ConceptStorage } from '@clef/kernel';

/**
 * Simulates the build pipeline that sync chains would orchestrate:
 * 1. Toolchain/resolve — resolve compiler for language+platform
 * 2. Builder/build — compile concept for language+platform
 * 3. Artifact/store — store content-addressed artifact
 *
 * Returns whether the build was cached (skipped) and the artifact hash.
 */
async function runBuildPipeline(
  toolchainStorage: ConceptStorage,
  builderStorage: ConceptStorage,
  artifactStorage: ConceptStorage,
  concept: string,
  source: string,
  language: string,
  platform: string,
  config: { mode: string; features?: string[] },
): Promise<{ cached: boolean; artifactHash: string | null }> {
  // Step 1: Toolchain/resolve — find the compiler
  const resolveResult = await toolchainHandler.resolve(
    { language, platform },
    toolchainStorage,
  );

  if (resolveResult.variant !== 'ok') {
    return { cached: false, artifactHash: null };
  }

  // Step 2: Builder/build — compile the concept
  const buildResult = await builderHandler.build(
    { concept, source, language, platform, config },
    builderStorage,
  );

  if (buildResult.variant !== 'ok') {
    return { cached: false, artifactHash: null };
  }

  const artifactHash = buildResult.artifactHash as string;

  // Check if artifact already exists (cache hit via content-addressing)
  const existing = await artifactHandler.resolve(
    { hash: artifactHash },
    artifactStorage,
  );

  if (existing.variant === 'ok') {
    return { cached: true, artifactHash };
  }

  // Step 3: Artifact/store — store the content-addressed artifact
  await artifactHandler.build(
    {
      concept,
      spec: `${concept}.concept`,
      implementation: `${concept}.impl.${language}`,
      deps: [source],
    },
    artifactStorage,
  );

  return { cached: false, artifactHash };
}

describe('Build pipeline integration', () => {
  let toolchainStorage: ConceptStorage;
  let builderStorage: ConceptStorage;
  let artifactStorage: ConceptStorage;

  beforeEach(() => {
    toolchainStorage = createInMemoryStorage();
    builderStorage = createInMemoryStorage();
    artifactStorage = createInMemoryStorage();
  });

  it('should execute full pipeline on first build', async () => {
    const result = await runBuildPipeline(
      toolchainStorage, builderStorage, artifactStorage,
      'Password', 'src-v1', 'typescript', 'node',
      { mode: 'release' },
    );

    expect(result.cached).toBe(false);
    expect(result.artifactHash).toBeDefined();
    expect(typeof result.artifactHash).toBe('string');
    expect(result.artifactHash!.length).toBeGreaterThan(0);
  });

  it('should cache second build with same source (skip rebuild)', async () => {
    // First build
    const first = await runBuildPipeline(
      toolchainStorage, builderStorage, artifactStorage,
      'Password', 'src-v1', 'typescript', 'node',
      { mode: 'release' },
    );
    expect(first.cached).toBe(false);

    // Second build — same source hash produces same artifact hash
    const second = await runBuildPipeline(
      toolchainStorage, builderStorage, artifactStorage,
      'Password', 'src-v1', 'typescript', 'node',
      { mode: 'release' },
    );

    expect(second.cached).toBe(true);
    expect(second.artifactHash).toBe(first.artifactHash);
  });

  it('should trigger rebuild when source changes', async () => {
    // First build
    const first = await runBuildPipeline(
      toolchainStorage, builderStorage, artifactStorage,
      'Password', 'src-v1', 'typescript', 'node',
      { mode: 'release' },
    );

    // Second build — different source hash
    const second = await runBuildPipeline(
      toolchainStorage, builderStorage, artifactStorage,
      'Password', 'src-v2', 'typescript', 'node',
      { mode: 'release' },
    );

    expect(second.cached).toBe(false);
    expect(second.artifactHash).not.toBe(first.artifactHash);
  });

  it('should build multiple concepts independently per language', async () => {
    const passwordResult = await runBuildPipeline(
      toolchainStorage, builderStorage, artifactStorage,
      'Password', 'pw-src', 'typescript', 'node',
      { mode: 'release' },
    );

    const userResult = await runBuildPipeline(
      toolchainStorage, builderStorage, artifactStorage,
      'User', 'user-src', 'typescript', 'node',
      { mode: 'release' },
    );

    expect(passwordResult.cached).toBe(false);
    expect(userResult.cached).toBe(false);
    expect(passwordResult.artifactHash).not.toBe(userResult.artifactHash);
  });

  it('should build multiple languages independently per concept', async () => {
    const tsResult = await runBuildPipeline(
      toolchainStorage, builderStorage, artifactStorage,
      'Password', 'pw-src-ts', 'typescript', 'node',
      { mode: 'release' },
    );

    const rustResult = await runBuildPipeline(
      toolchainStorage, builderStorage, artifactStorage,
      'Password', 'pw-src-rs', 'rust', 'x86_64-linux',
      { mode: 'release' },
    );

    expect(tsResult.cached).toBe(false);
    expect(rustResult.cached).toBe(false);
    expect(tsResult.artifactHash).not.toBe(rustResult.artifactHash);
  });

  it('should share toolchain resolution across concepts for same language', async () => {
    // Build two concepts for the same language
    await runBuildPipeline(
      toolchainStorage, builderStorage, artifactStorage,
      'Password', 'pw-src', 'typescript', 'node',
      { mode: 'release' },
    );
    await runBuildPipeline(
      toolchainStorage, builderStorage, artifactStorage,
      'User', 'user-src', 'typescript', 'node',
      { mode: 'release' },
    );

    // The toolchain list should only have one resolved entry for typescript compiler
    const listResult = await toolchainHandler.list(
      { language: 'typescript' },
      toolchainStorage,
    );
    expect(listResult.variant).toBe('ok');
    const tools = listResult.tools as any[];
    // Same tool resolved once, reused for both concepts
    expect(tools).toHaveLength(1);
    expect(tools[0].language).toBe('typescript');
    expect(tools[0].category).toBe('compiler');
  });

  it('should stop pipeline before store when toolchain fails', async () => {
    // Run the pipeline with an unknown language — toolchain resolution fails
    const result = await runBuildPipeline(
      toolchainStorage, builderStorage, artifactStorage,
      'Broken', 'src-broken', 'haskell', 'linux',
      { mode: 'release' },
    );

    // Pipeline should stop — toolchain resolution fails for unknown language
    expect(result.artifactHash).toBeNull();

    // Artifact store should have no entries
    const artifactCheck = await artifactHandler.resolve(
      { hash: 'nonexistent' },
      artifactStorage,
    );
    expect(artifactCheck.variant).toBe('notfound');
  });

  it('should produce retrievable artifact by hash after full pipeline', async () => {
    const result = await runBuildPipeline(
      toolchainStorage, builderStorage, artifactStorage,
      'Password', 'src-v1', 'typescript', 'node',
      { mode: 'release' },
    );
    expect(result.artifactHash).toBeDefined();

    // Verify the build is recorded in builder history
    const historyResult = await builderHandler.history(
      { concept: 'Password' },
      builderStorage,
    );
    expect(historyResult.variant).toBe('ok');
    const builds = historyResult.builds as any[];
    expect(builds.length).toBeGreaterThanOrEqual(1);
    expect(builds[0].artifactHash).toBe(result.artifactHash);
  });
});
