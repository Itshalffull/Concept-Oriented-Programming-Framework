// ============================================================
// TypeScriptBuilder Conformance Tests
//
// Validates TypeScript build, test, package, and register actions
// including type errors, bundle errors, and npm/docker packaging
// formats.
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/runtime';
import { typescriptBuilderHandler } from '../../../../handlers/ts/deploy/typescript-builder.handler.js';
import type { ConceptStorage } from '@clef/runtime';

describe('TypeScriptBuilder conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- build ---

  it('should build successfully and return artifact path and hash', async () => {
    const result = await typescriptBuilderHandler.build(
      { source: './src/index.ts', toolchainPath: '/usr/local/bin/tsc', platform: 'node', config: { mode: 'release', features: [] } },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.artifactPath).toBeDefined();
    expect(result.artifactHash).toBeDefined();
  });

  it('should return typeError when source is missing', async () => {
    const result = await typescriptBuilderHandler.build(
      { source: '', toolchainPath: '', platform: 'node', config: { mode: 'release', features: [] } },
      storage,
    );
    expect(result.variant).toBe('typeError');
    expect(result.errors).toBeDefined();
  });

  // --- test ---

  it('should run tests and return pass/fail/skipped/duration', async () => {
    const buildResult = await typescriptBuilderHandler.build(
      { source: './src/index.ts', toolchainPath: '/usr/local/bin/tsc', platform: 'node', config: { mode: 'release', features: [] } },
      storage,
    );
    expect(buildResult.variant).toBe('ok');

    const result = await typescriptBuilderHandler.test(
      { build: buildResult.build as string, toolchainPath: '/usr/local/bin/tsc' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(typeof result.passed).toBe('number');
    expect(typeof result.failed).toBe('number');
    expect(typeof result.skipped).toBe('number');
    expect(typeof result.duration).toBe('number');
  });

  it('should return testFailure when build is not found', async () => {
    const result = await typescriptBuilderHandler.test(
      { build: 'nonexistent-build-id', toolchainPath: '/usr/local/bin/tsc' },
      storage,
    );
    expect(result.variant).toBe('testFailure');
    expect(result.failures).toBeDefined();
    expect(Array.isArray(result.failures)).toBe(true);
  });

  // --- package ---

  it('should package as npm format', async () => {
    const buildResult = await typescriptBuilderHandler.build(
      { source: './src/index.ts', toolchainPath: '/usr/local/bin/tsc', platform: 'node', config: { mode: 'release', features: [] } },
      storage,
    );
    expect(buildResult.variant).toBe('ok');

    const result = await typescriptBuilderHandler.package(
      { build: buildResult.build as string, format: 'npm' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.artifactPath).toBeDefined();
  });

  it('should package as bundle format', async () => {
    const buildResult = await typescriptBuilderHandler.build(
      { source: './src/index.ts', toolchainPath: '/usr/local/bin/tsc', platform: 'node', config: { mode: 'release', features: [] } },
      storage,
    );
    expect(buildResult.variant).toBe('ok');

    const result = await typescriptBuilderHandler.package(
      { build: buildResult.build as string, format: 'bundle' },
      storage,
    );
    expect(result.variant).toBe('ok');
  });

  it('should package as docker format', async () => {
    const buildResult = await typescriptBuilderHandler.build(
      { source: './src/index.ts', toolchainPath: '/usr/local/bin/tsc', platform: 'node', config: { mode: 'release', features: [] } },
      storage,
    );
    expect(buildResult.variant).toBe('ok');

    const result = await typescriptBuilderHandler.package(
      { build: buildResult.build as string, format: 'docker' },
      storage,
    );
    expect(result.variant).toBe('ok');
  });

  it('should return formatUnsupported for unknown format', async () => {
    const buildResult = await typescriptBuilderHandler.build(
      { source: './src/index.ts', toolchainPath: '/usr/local/bin/tsc', platform: 'node', config: { mode: 'release', features: [] } },
      storage,
    );
    expect(buildResult.variant).toBe('ok');

    const result = await typescriptBuilderHandler.package(
      { build: buildResult.build as string, format: 'rpm' },
      storage,
    );
    expect(result.variant).toBe('formatUnsupported');
    expect(result.format).toBe('rpm');
  });

  // --- register ---

  it('should return correct name, language, and capabilities', async () => {
    const result = await typescriptBuilderHandler.register({}, storage);
    expect(result.variant).toBe('ok');
    expect(result.name).toBe('TypeScriptBuilder');
    expect(result.language).toBe('typescript');
    expect(result.capabilities).toBeDefined();
    expect(Array.isArray(result.capabilities)).toBe(true);
  });

  // --- invariant: build then test with tsc paths ---

  it('should build then test using tsc artifact paths', async () => {
    const buildResult = await typescriptBuilderHandler.build(
      { source: './src/app.ts', toolchainPath: '/usr/local/bin/tsc', platform: 'node', config: { mode: 'release', features: [] } },
      storage,
    );
    expect(buildResult.variant).toBe('ok');
    expect((buildResult.artifactPath as string)).toMatch(/build\/typescript/);

    const testResult = await typescriptBuilderHandler.test(
      { build: buildResult.build as string, toolchainPath: '/usr/local/bin/tsc' },
      storage,
    );
    expect(testResult.variant).toBe('ok');
  });
});
