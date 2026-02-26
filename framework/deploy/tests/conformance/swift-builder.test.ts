// ============================================================
// SwiftBuilder Conformance Tests
//
// Validates Swift build, test, package, and register actions
// including compilation errors, linker errors, and framework
// packaging formats.
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/kernel';
import { swiftBuilderHandler } from '../../../../implementations/typescript/deploy/swift-builder.impl.js';
import type { ConceptStorage } from '@clef/kernel';

describe('SwiftBuilder conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- build ---

  it('should build successfully and return artifact path and hash', async () => {
    const result = await swiftBuilderHandler.build(
      { sourcePath: './src/Main.swift', target: 'debug' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.artifactPath).toBeDefined();
    expect(result.artifactHash).toBeDefined();
  });

  it('should return compilationError with file, line, and message', async () => {
    const result = await swiftBuilderHandler.build(
      { sourcePath: './src/Invalid.swift', target: 'debug', simulateError: 'compilationError' },
      storage,
    );
    expect(result.variant).toBe('compilationError');
    expect(result.file).toBeDefined();
    expect(result.line).toBeDefined();
    expect(result.message).toBeDefined();
  });

  it('should return linkerError on linking failure', async () => {
    const result = await swiftBuilderHandler.build(
      { sourcePath: './src/Main.swift', target: 'release', simulateError: 'linkerError' },
      storage,
    );
    expect(result.variant).toBe('linkerError');
    expect(result.message).toBeDefined();
  });

  // --- test ---

  it('should run tests and return pass/fail/skipped/duration', async () => {
    const result = await swiftBuilderHandler.test(
      { sourcePath: './src/Main.swift', testTarget: 'MainTests' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(typeof result.pass).toBe('number');
    expect(typeof result.fail).toBe('number');
    expect(typeof result.skipped).toBe('number');
    expect(typeof result.duration).toBe('number');
  });

  it('should return testFailure with failure details', async () => {
    const result = await swiftBuilderHandler.test(
      { sourcePath: './src/Main.swift', testTarget: 'MainTests', simulateError: 'testFailure' },
      storage,
    );
    expect(result.variant).toBe('testFailure');
    expect(result.failures).toBeDefined();
    expect(Array.isArray(result.failures)).toBe(true);
    const failures = result.failures as any[];
    expect(failures.length).toBeGreaterThan(0);
    expect(failures[0].testName).toBeDefined();
    expect(failures[0].message).toBeDefined();
  });

  // --- package ---

  it('should package as framework format', async () => {
    const result = await swiftBuilderHandler.package(
      { sourcePath: './src/Main.swift', format: 'framework' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.format).toBe('framework');
    expect(result.outputPath).toBeDefined();
  });

  it('should package as xcframework format', async () => {
    const result = await swiftBuilderHandler.package(
      { sourcePath: './src/Main.swift', format: 'xcframework' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.format).toBe('xcframework');
  });

  it('should package as binary format', async () => {
    const result = await swiftBuilderHandler.package(
      { sourcePath: './src/Main.swift', format: 'binary' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.format).toBe('binary');
  });

  it('should package as library format', async () => {
    const result = await swiftBuilderHandler.package(
      { sourcePath: './src/Main.swift', format: 'library' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.format).toBe('library');
  });

  it('should return formatUnsupported for unknown format', async () => {
    const result = await swiftBuilderHandler.package(
      { sourcePath: './src/Main.swift', format: 'deb' },
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
      { sourcePath: './src/App.swift', target: 'debug' },
      storage,
    );
    expect(buildResult.variant).toBe('ok');
    expect((buildResult.artifactPath as string)).toMatch(/\.swift|\.build|\.o/);

    const testResult = await swiftBuilderHandler.test(
      { sourcePath: './src/App.swift', testTarget: 'AppTests' },
      storage,
    );
    expect(testResult.variant).toBe('ok');
  });
});
