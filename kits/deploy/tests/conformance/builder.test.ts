// ============================================================
// Builder Conformance Tests
//
// Validates build coordination: single-concept builds, multi-
// concept buildAll, test execution, status queries, and history
// tracking with per-language filtering.
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@copf/kernel';
import { builderHandler } from '../../../../implementations/typescript/deploy/builder.impl.js';
import type { ConceptStorage } from '@copf/kernel';

describe('Builder conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- build: ok ---

  it('should return artifactHash, artifactLocation, and duration on successful build', async () => {
    const result = await builderHandler.build(
      {
        conceptName: 'Password',
        target: 'typescript',
        sourceHash: 'src-abc123',
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.artifactHash).toBeDefined();
    expect(typeof result.artifactHash).toBe('string');
    expect(result.artifactLocation).toBeDefined();
    expect(typeof result.artifactLocation).toBe('string');
    expect(result.duration).toBeDefined();
    expect(typeof result.duration).toBe('number');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should produce different artifact hashes for different sources', async () => {
    const first = await builderHandler.build(
      {
        conceptName: 'Password',
        target: 'typescript',
        sourceHash: 'src-v1',
      },
      storage,
    );

    const second = await builderHandler.build(
      {
        conceptName: 'Password',
        target: 'typescript',
        sourceHash: 'src-v2',
      },
      storage,
    );

    expect(first.variant).toBe('ok');
    expect(second.variant).toBe('ok');
    expect(first.artifactHash).not.toBe(second.artifactHash);
  });

  // --- build: compilationError ---

  it('should return compilationError with structured errors', async () => {
    const result = await builderHandler.build(
      {
        conceptName: 'Broken',
        target: 'typescript',
        sourceHash: 'src-broken',
        simulateError: 'compilationError',
      },
      storage,
    );
    expect(result.variant).toBe('compilationError');
    expect(result.errors).toBeDefined();
    const errors = result.errors as any[];
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toBeDefined();
    expect(typeof errors[0].message).toBe('string');
  });

  // --- build: testFailure ---

  it('should return testFailure with pass and fail counts', async () => {
    const result = await builderHandler.build(
      {
        conceptName: 'Flaky',
        target: 'typescript',
        sourceHash: 'src-flaky',
        simulateError: 'testFailure',
      },
      storage,
    );
    expect(result.variant).toBe('testFailure');
    expect(result.passed).toBeDefined();
    expect(typeof result.passed).toBe('number');
    expect(result.failed).toBeDefined();
    expect(typeof result.failed).toBe('number');
    expect(result.failed).toBeGreaterThan(0);
  });

  // --- build: toolchainError ---

  it('should propagate toolchainError with reason', async () => {
    const result = await builderHandler.build(
      {
        conceptName: 'NoCompiler',
        target: 'rust',
        sourceHash: 'src-no-compiler',
        simulateError: 'toolchainError',
      },
      storage,
    );
    expect(result.variant).toBe('toolchainError');
    expect(result.reason).toBeDefined();
    expect(typeof result.reason).toBe('string');
  });

  // --- buildAll: ok ---

  it('should return per-concept per-target results on buildAll ok', async () => {
    const result = await builderHandler.buildAll(
      {
        concepts: [
          { conceptName: 'Password', target: 'typescript', sourceHash: 'pw-hash' },
          { conceptName: 'User', target: 'typescript', sourceHash: 'user-hash' },
          { conceptName: 'Password', target: 'rust', sourceHash: 'pw-rust-hash' },
        ],
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    const results = result.results as any[];
    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.conceptName).toBeDefined();
      expect(r.target).toBeDefined();
      expect(r.artifactHash).toBeDefined();
    }
  });

  // --- buildAll: partial ---

  it('should return completed and failed lists on partial buildAll', async () => {
    const result = await builderHandler.buildAll(
      {
        concepts: [
          { conceptName: 'Password', target: 'typescript', sourceHash: 'pw-hash' },
          { conceptName: 'Broken', target: 'typescript', sourceHash: 'broken-hash', simulateError: 'compilationError' },
          { conceptName: 'User', target: 'typescript', sourceHash: 'user-hash' },
        ],
      },
      storage,
    );
    expect(result.variant).toBe('partial');
    const completed = result.completed as any[];
    const failed = result.failed as any[];
    expect(completed.length).toBeGreaterThan(0);
    expect(failed.length).toBeGreaterThan(0);
    expect(completed.length + failed.length).toBe(3);

    // Verify failed entry contains error info
    const failedEntry = failed[0];
    expect(failedEntry.conceptName).toBe('Broken');
    expect(failedEntry.error).toBeDefined();
  });

  // --- test: ok ---

  it('should return pass, fail, skipped, and duration on test ok', async () => {
    // Build first so artifact exists
    await builderHandler.build(
      {
        conceptName: 'Password',
        target: 'typescript',
        sourceHash: 'src-abc123',
      },
      storage,
    );

    const result = await builderHandler.test(
      {
        conceptName: 'Password',
        target: 'typescript',
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(typeof result.passed).toBe('number');
    expect(typeof result.failed).toBe('number');
    expect(typeof result.skipped).toBe('number');
    expect(typeof result.duration).toBe('number');
    expect(result.passed).toBeGreaterThanOrEqual(0);
    expect(result.failed).toBe(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  // --- test: notBuilt ---

  it('should return notBuilt when no build artifact exists', async () => {
    const result = await builderHandler.test(
      {
        conceptName: 'NeverBuilt',
        target: 'typescript',
      },
      storage,
    );
    expect(result.variant).toBe('notBuilt');
  });

  // --- status: ok ---

  it('should return status with state and duration after build', async () => {
    await builderHandler.build(
      {
        conceptName: 'Password',
        target: 'typescript',
        sourceHash: 'src-abc123',
      },
      storage,
    );

    const result = await builderHandler.status(
      {
        conceptName: 'Password',
        target: 'typescript',
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.status).toBeDefined();
    expect(result.duration).toBeDefined();
    expect(typeof result.duration).toBe('number');
  });

  // --- history: ok ---

  it('should return build list from history', async () => {
    await builderHandler.build(
      {
        conceptName: 'Password',
        target: 'typescript',
        sourceHash: 'src-v1',
      },
      storage,
    );
    await builderHandler.build(
      {
        conceptName: 'Password',
        target: 'typescript',
        sourceHash: 'src-v2',
      },
      storage,
    );

    const result = await builderHandler.history(
      { conceptName: 'Password' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const builds = result.builds as any[];
    expect(builds).toHaveLength(2);
  });

  it('should filter history by language', async () => {
    await builderHandler.build(
      {
        conceptName: 'Password',
        target: 'typescript',
        sourceHash: 'ts-hash',
      },
      storage,
    );
    await builderHandler.build(
      {
        conceptName: 'Password',
        target: 'rust',
        sourceHash: 'rs-hash',
      },
      storage,
    );

    const result = await builderHandler.history(
      { conceptName: 'Password', language: 'typescript' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const builds = result.builds as any[];
    expect(builds).toHaveLength(1);
    expect(builds[0].target).toBe('typescript');
  });

  // --- invariant: after build -> ok, status -> ok with "done" ---

  it('should report status "done" after a successful build', async () => {
    const buildResult = await builderHandler.build(
      {
        conceptName: 'Password',
        target: 'typescript',
        sourceHash: 'src-final',
      },
      storage,
    );
    expect(buildResult.variant).toBe('ok');

    const statusResult = await builderHandler.status(
      {
        conceptName: 'Password',
        target: 'typescript',
      },
      storage,
    );
    expect(statusResult.variant).toBe('ok');
    expect(statusResult.status).toBe('done');
  });

  // --- invariant: after build -> ok, history returns the build ---

  it('should include the build in history after a successful build', async () => {
    const buildResult = await builderHandler.build(
      {
        conceptName: 'User',
        target: 'typescript',
        sourceHash: 'src-user-v1',
      },
      storage,
    );
    expect(buildResult.variant).toBe('ok');
    const expectedHash = buildResult.artifactHash as string;

    const historyResult = await builderHandler.history(
      { conceptName: 'User' },
      storage,
    );
    expect(historyResult.variant).toBe('ok');
    const builds = historyResult.builds as any[];
    expect(builds.length).toBeGreaterThanOrEqual(1);

    const matchingBuild = builds.find(
      (b: any) => b.artifactHash === expectedHash,
    );
    expect(matchingBuild).toBeDefined();
    expect(matchingBuild.conceptName).toBe('User');
    expect(matchingBuild.target).toBe('typescript');
  });
});
