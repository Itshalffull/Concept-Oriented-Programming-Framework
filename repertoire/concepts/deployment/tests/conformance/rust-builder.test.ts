// ============================================================
// RustBuilder Conformance Tests
//
// Validates Rust build, test, package, and register actions
// including compilation errors, feature conflicts, and crate/wasm
// packaging formats.
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/runtime';
import { rustBuilderHandler } from '../../../../handlers/ts/deploy/rust-builder.handler.js';
import type { ConceptStorage } from '@clef/runtime';

describe('RustBuilder conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- build ---

  it('should build successfully and return artifact path and hash', async () => {
    const result = await rustBuilderHandler.build(
      { source: './src/lib.rs', toolchainPath: '/usr/local/bin/rustc', platform: 'x86_64-linux', config: { mode: 'debug', features: [] } },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.artifactPath).toBeDefined();
    expect(result.artifactHash).toBeDefined();
  });

  it('should return compilationError when source is missing', async () => {
    const result = await rustBuilderHandler.build(
      { source: '', toolchainPath: '', platform: 'x86_64-linux', config: { mode: 'debug', features: [] } },
      storage,
    );
    expect(result.variant).toBe('compilationError');
    expect(result.errors).toBeDefined();
  });

  it('should return featureConflict on duplicate feature flags', async () => {
    const result = await rustBuilderHandler.build(
      { source: './src/lib.rs', toolchainPath: '/usr/local/bin/rustc', platform: 'x86_64-linux', config: { mode: 'release', features: ['serde', 'serde'] } },
      storage,
    );
    expect(result.variant).toBe('featureConflict');
    expect(result.conflicting).toBeDefined();
  });

  // --- test ---

  it('should run tests and return pass/fail/skipped/duration', async () => {
    // Build first to get a build ID
    const buildResult = await rustBuilderHandler.build(
      { source: './src/lib.rs', toolchainPath: '/usr/local/bin/rustc', platform: 'x86_64-linux', config: { mode: 'debug', features: [] } },
      storage,
    );
    expect(buildResult.variant).toBe('ok');

    const result = await rustBuilderHandler.test(
      { build: buildResult.build as string, toolchainPath: '/usr/local/bin/rustc' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(typeof result.passed).toBe('number');
    expect(typeof result.failed).toBe('number');
    expect(typeof result.skipped).toBe('number');
    expect(typeof result.duration).toBe('number');
  });

  it('should return testFailure when build is not found', async () => {
    const result = await rustBuilderHandler.test(
      { build: 'nonexistent-build-id', toolchainPath: '/usr/local/bin/rustc' },
      storage,
    );
    expect(result.variant).toBe('testFailure');
    expect(result.failures).toBeDefined();
    expect(Array.isArray(result.failures)).toBe(true);
  });

  // --- package ---

  it('should package as crate format', async () => {
    const buildResult = await rustBuilderHandler.build(
      { source: './src/lib.rs', toolchainPath: '/usr/local/bin/rustc', platform: 'x86_64-linux', config: { mode: 'release', features: [] } },
      storage,
    );
    expect(buildResult.variant).toBe('ok');

    const result = await rustBuilderHandler.package(
      { build: buildResult.build as string, format: 'crate' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.artifactPath).toBeDefined();
  });

  it('should package as binary format', async () => {
    const buildResult = await rustBuilderHandler.build(
      { source: './src/main.rs', toolchainPath: '/usr/local/bin/rustc', platform: 'x86_64-linux', config: { mode: 'release', features: [] } },
      storage,
    );
    expect(buildResult.variant).toBe('ok');

    const result = await rustBuilderHandler.package(
      { build: buildResult.build as string, format: 'binary' },
      storage,
    );
    expect(result.variant).toBe('ok');
  });

  it('should package as wasm-pack format', async () => {
    const buildResult = await rustBuilderHandler.build(
      { source: './src/lib.rs', toolchainPath: '/usr/local/bin/rustc', platform: 'wasm32', config: { mode: 'release', features: [] } },
      storage,
    );
    expect(buildResult.variant).toBe('ok');

    const result = await rustBuilderHandler.package(
      { build: buildResult.build as string, format: 'wasm-pack' },
      storage,
    );
    expect(result.variant).toBe('ok');
  });

  it('should package as docker format', async () => {
    const buildResult = await rustBuilderHandler.build(
      { source: './src/main.rs', toolchainPath: '/usr/local/bin/rustc', platform: 'x86_64-linux', config: { mode: 'release', features: [] } },
      storage,
    );
    expect(buildResult.variant).toBe('ok');

    const result = await rustBuilderHandler.package(
      { build: buildResult.build as string, format: 'docker' },
      storage,
    );
    expect(result.variant).toBe('ok');
  });

  it('should return formatUnsupported for unknown format', async () => {
    const buildResult = await rustBuilderHandler.build(
      { source: './src/lib.rs', toolchainPath: '/usr/local/bin/rustc', platform: 'x86_64-linux', config: { mode: 'release', features: [] } },
      storage,
    );
    expect(buildResult.variant).toBe('ok');

    const result = await rustBuilderHandler.package(
      { build: buildResult.build as string, format: 'msi' },
      storage,
    );
    expect(result.variant).toBe('formatUnsupported');
    expect(result.format).toBe('msi');
  });

  // --- register ---

  it('should return correct name, language, and capabilities', async () => {
    const result = await rustBuilderHandler.register({}, storage);
    expect(result.variant).toBe('ok');
    expect(result.name).toBe('RustBuilder');
    expect(result.language).toBe('rust');
    expect(result.capabilities).toBeDefined();
    expect(Array.isArray(result.capabilities)).toBe(true);
  });

  // --- invariant: build then test with cargo paths ---

  it('should build then test using cargo artifact paths', async () => {
    const buildResult = await rustBuilderHandler.build(
      { source: './src/lib.rs', toolchainPath: '/usr/local/bin/rustc', platform: 'x86_64-linux', config: { mode: 'debug', features: [] } },
      storage,
    );
    expect(buildResult.variant).toBe('ok');
    expect((buildResult.artifactPath as string)).toMatch(/build\/rust/);

    const testResult = await rustBuilderHandler.test(
      { build: buildResult.build as string, toolchainPath: '/usr/local/bin/rustc' },
      storage,
    );
    expect(testResult.variant).toBe('ok');
  });
});
