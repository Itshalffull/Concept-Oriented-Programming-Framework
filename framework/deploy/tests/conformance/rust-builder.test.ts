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
      { sourcePath: './src/lib.rs', target: 'debug' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.artifactPath).toBeDefined();
    expect(result.artifactHash).toBeDefined();
  });

  it('should return compilationError with file, line, and message', async () => {
    const result = await rustBuilderHandler.build(
      { sourcePath: './src/invalid.rs', target: 'debug', simulateError: 'compilationError' },
      storage,
    );
    expect(result.variant).toBe('compilationError');
    expect(result.file).toBeDefined();
    expect(result.line).toBeDefined();
    expect(result.message).toBeDefined();
  });

  it('should return featureConflict on incompatible feature flags', async () => {
    const result = await rustBuilderHandler.build(
      { sourcePath: './src/lib.rs', target: 'release', simulateError: 'featureConflict' },
      storage,
    );
    expect(result.variant).toBe('featureConflict');
    expect(result.message).toBeDefined();
  });

  // --- test ---

  it('should run tests and return pass/fail/skipped/duration', async () => {
    const result = await rustBuilderHandler.test(
      { sourcePath: './src/lib.rs', testTarget: 'cargo-test' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(typeof result.pass).toBe('number');
    expect(typeof result.fail).toBe('number');
    expect(typeof result.skipped).toBe('number');
    expect(typeof result.duration).toBe('number');
  });

  it('should return testFailure with failure details', async () => {
    const result = await rustBuilderHandler.test(
      { sourcePath: './src/lib.rs', testTarget: 'cargo-test', simulateError: 'testFailure' },
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

  it('should package as crate format', async () => {
    const result = await rustBuilderHandler.package(
      { sourcePath: './src/lib.rs', format: 'crate' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.format).toBe('crate');
    expect(result.outputPath).toBeDefined();
  });

  it('should package as binary format', async () => {
    const result = await rustBuilderHandler.package(
      { sourcePath: './src/main.rs', format: 'binary' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.format).toBe('binary');
  });

  it('should package as wasm-pack format', async () => {
    const result = await rustBuilderHandler.package(
      { sourcePath: './src/lib.rs', format: 'wasm-pack' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.format).toBe('wasm-pack');
  });

  it('should package as docker format', async () => {
    const result = await rustBuilderHandler.package(
      { sourcePath: './src/main.rs', format: 'docker' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.format).toBe('docker');
  });

  it('should return formatUnsupported for unknown format', async () => {
    const result = await rustBuilderHandler.package(
      { sourcePath: './src/lib.rs', format: 'msi' },
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
      { sourcePath: './src/lib.rs', target: 'debug' },
      storage,
    );
    expect(buildResult.variant).toBe('ok');
    expect((buildResult.artifactPath as string)).toMatch(/target|\.rlib|\.so|\.d/);

    const testResult = await rustBuilderHandler.test(
      { sourcePath: './src/lib.rs', testTarget: 'cargo-test' },
      storage,
    );
    expect(testResult.variant).toBe('ok');
  });
});
