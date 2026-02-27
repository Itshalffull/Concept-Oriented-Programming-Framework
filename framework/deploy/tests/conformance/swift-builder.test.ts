// ============================================================
// SwiftBuilder Conformance Tests
//
// Validates Swift build, test, package, and register actions
// including compilation errors, linker errors, and framework
// packaging formats.
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/runtime';
import { swiftBuilderHandler } from '../../../../handlers/ts/deploy/swift-builder.handler.js';
import type { ConceptStorage } from '@clef/runtime';

describe('SwiftBuilder conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- build ---

  it('should build successfully and return artifact path and hash', async () => {
    const result = await swiftBuilderHandler.build(
      { source: './src/Main.swift', toolchainPath: '/usr/bin/swiftc', platform: 'linux-arm64', config: { mode: 'debug', features: [] } },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.artifactPath).toBeDefined();
    expect(result.artifactHash).toBeDefined();
  });

  it('should return compilationError when source is missing', async () => {
    const result = await swiftBuilderHandler.build(
      { source: '', toolchainPath: '', platform: 'linux-arm64', config: { mode: 'debug', features: [] } },
      storage,
    );
    expect(result.variant).toBe('compilationError');
    expect(result.errors).toBeDefined();
  });

  // --- test ---

  it('should run tests and return pass/fail/skipped/duration', async () => {
    const buildResult = await swiftBuilderHandler.build(
      { source: './src/Main.swift', toolchainPath: '/usr/bin/swiftc', platform: 'linux-arm64', config: { mode: 'debug', features: [] } },
      storage,
    );
    expect(buildResult.variant).toBe('ok');

    const result = await swiftBuilderHandler.test(
      { build: buildResult.build as string, toolchainPath: '/usr/bin/swiftc' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(typeof result.passed).toBe('number');
    expect(typeof result.failed).toBe('number');
    expect(typeof result.skipped).toBe('number');
    expect(typeof result.duration).toBe('number');
  });

  it('should return testFailure when build is not found', async () => {
    const result = await swiftBuilderHandler.test(
      { build: 'nonexistent-build-id', toolchainPath: '/usr/bin/swiftc' },
      storage,
    );
    expect(result.variant).toBe('testFailure');
    expect(result.failures).toBeDefined();
    expect(Array.isArray(result.failures)).toBe(true);
  });

  // --- package ---

  it('should package as framework format', async () => {
    const buildResult = await swiftBuilderHandler.build(
      { source: './src/Main.swift', toolchainPath: '/usr/bin/swiftc', platform: 'linux-arm64', config: { mode: 'release', features: [] } },
      storage,
    );
    expect(buildResult.variant).toBe('ok');

    const result = await swiftBuilderHandler.package(
      { build: buildResult.build as string, format: 'framework' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.artifactPath).toBeDefined();
  });

  it('should package as xcframework format', async () => {
    const buildResult = await swiftBuilderHandler.build(
      { source: './src/Main.swift', toolchainPath: '/usr/bin/swiftc', platform: 'linux-arm64', config: { mode: 'release', features: [] } },
      storage,
    );
    expect(buildResult.variant).toBe('ok');

    const result = await swiftBuilderHandler.package(
      { build: buildResult.build as string, format: 'xcframework' },
      storage,
    );
    expect(result.variant).toBe('ok');
  });

  it('should package as binary format', async () => {
    const buildResult = await swiftBuilderHandler.build(
      { source: './src/Main.swift', toolchainPath: '/usr/bin/swiftc', platform: 'linux-arm64', config: { mode: 'release', features: [] } },
      storage,
    );
    expect(buildResult.variant).toBe('ok');

    const result = await swiftBuilderHandler.package(
      { build: buildResult.build as string, format: 'binary' },
      storage,
    );
    expect(result.variant).toBe('ok');
  });

  it('should package as library format', async () => {
    const buildResult = await swiftBuilderHandler.build(
      { source: './src/Main.swift', toolchainPath: '/usr/bin/swiftc', platform: 'linux-arm64', config: { mode: 'release', features: [] } },
      storage,
    );
    expect(buildResult.variant).toBe('ok');

    const result = await swiftBuilderHandler.package(
      { build: buildResult.build as string, format: 'library' },
      storage,
    );
    expect(result.variant).toBe('ok');
  });

  it('should return formatUnsupported for unknown format', async () => {
    const buildResult = await swiftBuilderHandler.build(
      { source: './src/Main.swift', toolchainPath: '/usr/bin/swiftc', platform: 'linux-arm64', config: { mode: 'release', features: [] } },
      storage,
    );
    expect(buildResult.variant).toBe('ok');

    const result = await swiftBuilderHandler.package(
      { build: buildResult.build as string, format: 'deb' },
      storage,
    );
    expect(result.variant).toBe('formatUnsupported');
    expect(result.format).toBe('deb');
  });

  // --- register ---

  it('should return correct name, language, and capabilities', async () => {
    const result = await swiftBuilderHandler.register({}, storage);
    expect(result.variant).toBe('ok');
    expect(result.name).toBe('SwiftBuilder');
    expect(result.language).toBe('swift');
    expect(result.capabilities).toBeDefined();
    expect(Array.isArray(result.capabilities)).toBe(true);
  });

  // --- invariant: build then test with swift paths ---

  it('should build then test using swift artifact paths', async () => {
    const buildResult = await swiftBuilderHandler.build(
      { source: './src/App.swift', toolchainPath: '/usr/bin/swiftc', platform: 'linux-arm64', config: { mode: 'debug', features: [] } },
      storage,
    );
    expect(buildResult.variant).toBe('ok');
    expect((buildResult.artifactPath as string)).toMatch(/build\/swift/);

    const testResult = await swiftBuilderHandler.test(
      { build: buildResult.build as string, toolchainPath: '/usr/bin/swiftc' },
      storage,
    );
    expect(testResult.variant).toBe('ok');
  });
});
