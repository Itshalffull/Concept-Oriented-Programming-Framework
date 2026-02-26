// ============================================================
// Builder Conformance Tests
//
// Validates build coordination: single-concept builds, multi-
// concept buildAll, test execution with testType and toolName,
// status queries, and history tracking with per-language filtering.
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/kernel';
import { builderHandler } from '../../../../implementations/typescript/deploy/builder.impl.js';
import type { ConceptStorage } from '@clef/kernel';

describe('Builder conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- build: ok ---

  it('should return build, artifactHash, artifactLocation, and duration on successful build', async () => {
    const result = await builderHandler.build(
      {
        concept: 'Password',
        source: './generated/typescript/password',
        language: 'typescript',
        platform: 'node',
        config: { mode: 'release' },
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.build).toBeDefined();
    expect(typeof result.build).toBe('string');
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
        concept: 'Password',
        source: './generated/typescript/password-v1',
        language: 'typescript',
        platform: 'node',
        config: { mode: 'release' },
      },
      storage,
    );

    const second = await builderHandler.build(
      {
        concept: 'Password',
        source: './generated/typescript/password-v2',
        language: 'typescript',
        platform: 'node',
        config: { mode: 'release' },
      },
      storage,
    );

    expect(first.variant).toBe('ok');
    expect(second.variant).toBe('ok');
    expect(first.artifactHash).not.toBe(second.artifactHash);
  });

  // --- build: toolchainError ---

  it('should return toolchainError when required fields are missing', async () => {
    const result = await builderHandler.build(
      {
        concept: '',
        source: '',
        language: '',
        platform: '',
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
        concepts: ['Password', 'User'],
        source: './generated',
        targets: [
          { language: 'typescript', platform: 'node' },
          { language: 'rust', platform: 'x86_64-linux' },
        ],
        config: { mode: 'release' },
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    const results = result.results as any[];
    expect(results).toHaveLength(4); // 2 concepts x 2 targets
    for (const r of results) {
      expect(r.concept).toBeDefined();
      expect(r.language).toBeDefined();
      expect(r.artifactHash).toBeDefined();
    }
  });

  // --- test: ok ---

  it('should return pass, fail, skipped, duration, and testType on test ok', async () => {
    // Build first so artifact exists
    await builderHandler.build(
      {
        concept: 'Password',
        source: './generated/typescript/password',
        language: 'typescript',
        platform: 'node',
        config: { mode: 'release' },
      },
      storage,
    );

    const result = await builderHandler.test(
      {
        concept: 'Password',
        language: 'typescript',
        platform: 'node',
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(typeof result.passed).toBe('number');
    expect(typeof result.failed).toBe('number');
    expect(typeof result.skipped).toBe('number');
    expect(typeof result.duration).toBe('number');
    expect(result.testType).toBe('unit');
    expect(result.passed).toBeGreaterThanOrEqual(0);
    expect(result.failed).toBe(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  // --- test: with testType ---

  it('should accept testType parameter and return it in result', async () => {
    await builderHandler.build(
      {
        concept: 'Password',
        source: './generated/typescript/password',
        language: 'typescript',
        platform: 'node',
        config: { mode: 'release' },
      },
      storage,
    );

    const result = await builderHandler.test(
      {
        concept: 'Password',
        language: 'typescript',
        platform: 'node',
        testType: 'e2e',
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.testType).toBe('e2e');
  });

  // --- test: with toolName ---

  it('should accept toolName parameter for tool selection', async () => {
    await builderHandler.build(
      {
        concept: 'Password',
        source: './generated/typescript/password',
        language: 'typescript',
        platform: 'node',
        config: { mode: 'release' },
      },
      storage,
    );

    const result = await builderHandler.test(
      {
        concept: 'Password',
        language: 'typescript',
        platform: 'node',
        testType: 'unit',
        toolName: 'jest',
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.testType).toBe('unit');
  });

  // --- test: with invocation ---

  it('should accept invocation profile for direct tool configuration', async () => {
    await builderHandler.build(
      {
        concept: 'Password',
        source: './generated/typescript/password',
        language: 'typescript',
        platform: 'node',
        config: { mode: 'release' },
      },
      storage,
    );

    const result = await builderHandler.test(
      {
        concept: 'Password',
        language: 'typescript',
        platform: 'node',
        testType: 'unit',
        invocation: {
          command: 'npx jest',
          args: ['--json'],
          outputFormat: 'jest-json',
        },
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.testType).toBe('unit');
  });

  // --- test: notBuilt ---

  it('should return notBuilt when no build artifact exists', async () => {
    const result = await builderHandler.test(
      {
        concept: 'NeverBuilt',
        language: 'typescript',
        platform: 'node',
      },
      storage,
    );
    expect(result.variant).toBe('notBuilt');
  });

  // --- status: ok ---

  it('should return status with state and duration after build', async () => {
    const buildResult = await builderHandler.build(
      {
        concept: 'Password',
        source: './generated/typescript/password',
        language: 'typescript',
        platform: 'node',
        config: { mode: 'release' },
      },
      storage,
    );
    expect(buildResult.variant).toBe('ok');
    const buildId = buildResult.build as string;

    const result = await builderHandler.status(
      { build: buildId },
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
        concept: 'Password',
        source: './generated/typescript/password-v1',
        language: 'typescript',
        platform: 'node',
        config: { mode: 'release' },
      },
      storage,
    );
    await builderHandler.build(
      {
        concept: 'Password',
        source: './generated/typescript/password-v2',
        language: 'typescript',
        platform: 'node',
        config: { mode: 'release' },
      },
      storage,
    );

    const result = await builderHandler.history(
      { concept: 'Password' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const builds = result.builds as any[];
    expect(builds).toHaveLength(2);
  });

  it('should filter history by language', async () => {
    await builderHandler.build(
      {
        concept: 'Password',
        source: './generated/typescript/password',
        language: 'typescript',
        platform: 'node',
        config: { mode: 'release' },
      },
      storage,
    );
    await builderHandler.build(
      {
        concept: 'Password',
        source: './generated/rust/password',
        language: 'rust',
        platform: 'x86_64-linux',
        config: { mode: 'release' },
      },
      storage,
    );

    const result = await builderHandler.history(
      { concept: 'Password', language: 'typescript' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const builds = result.builds as any[];
    expect(builds).toHaveLength(1);
    expect(builds[0].language).toBe('typescript');
  });

  // --- invariant: after build -> ok, status -> completed ---

  it('should report status "completed" after a successful build', async () => {
    const buildResult = await builderHandler.build(
      {
        concept: 'Password',
        source: './generated/typescript/password',
        language: 'typescript',
        platform: 'node',
        config: { mode: 'release' },
      },
      storage,
    );
    expect(buildResult.variant).toBe('ok');
    const buildId = buildResult.build as string;

    const statusResult = await builderHandler.status(
      { build: buildId },
      storage,
    );
    expect(statusResult.variant).toBe('ok');
    expect(statusResult.status).toBe('completed');
  });

  // --- invariant: after build -> ok, history returns the build ---

  it('should include the build in history after a successful build', async () => {
    const buildResult = await builderHandler.build(
      {
        concept: 'User',
        source: './generated/typescript/user',
        language: 'typescript',
        platform: 'node',
        config: { mode: 'release' },
      },
      storage,
    );
    expect(buildResult.variant).toBe('ok');
    const expectedHash = buildResult.artifactHash as string;

    const historyResult = await builderHandler.history(
      { concept: 'User' },
      storage,
    );
    expect(historyResult.variant).toBe('ok');
    const builds = historyResult.builds as any[];
    expect(builds.length).toBeGreaterThanOrEqual(1);

    const matchingBuild = builds.find(
      (b: any) => b.artifactHash === expectedHash,
    );
    expect(matchingBuild).toBeDefined();
    expect(matchingBuild.language).toBe('typescript');
  });
});
