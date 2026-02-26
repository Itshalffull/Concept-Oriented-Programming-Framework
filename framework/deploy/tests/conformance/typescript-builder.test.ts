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
import { typescriptBuilderHandler } from '../../../../implementations/typescript/deploy/typescript-builder.impl.js';
import type { ConceptStorage } from '@clef/runtime';

describe('TypeScriptBuilder conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- build ---

  it('should build successfully and return artifact path and hash', async () => {
    const result = await typescriptBuilderHandler.build(
      { sourcePath: './src/index.ts', target: 'es2022' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.artifactPath).toBeDefined();
    expect(result.artifactHash).toBeDefined();
  });

  it('should return typeError with file, line, and message', async () => {
    const result = await typescriptBuilderHandler.build(
      { sourcePath: './src/broken.ts', target: 'es2022', simulateError: 'typeError' },
      storage,
    );
    expect(result.variant).toBe('typeError');
    expect(result.file).toBeDefined();
    expect(result.line).toBeDefined();
    expect(result.message).toBeDefined();
  });

  it('should return bundleError on bundling failure', async () => {
    const result = await typescriptBuilderHandler.build(
      { sourcePath: './src/index.ts', target: 'es2022', simulateError: 'bundleError' },
      storage,
    );
    expect(result.variant).toBe('bundleError');
    expect(result.message).toBeDefined();
  });

  // --- test ---

  it('should run tests and return pass/fail/skipped/duration', async () => {
    const result = await typescriptBuilderHandler.test(
      { sourcePath: './src/index.ts', testTarget: 'vitest' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(typeof result.pass).toBe('number');
    expect(typeof result.fail).toBe('number');
    expect(typeof result.skipped).toBe('number');
    expect(typeof result.duration).toBe('number');
  });

  it('should return testFailure with failure details', async () => {
    const result = await typescriptBuilderHandler.test(
      { sourcePath: './src/index.ts', testTarget: 'vitest', simulateError: 'testFailure' },
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

  it('should package as npm format', async () => {
    const result = await typescriptBuilderHandler.package(
      { sourcePath: './src/index.ts', format: 'npm' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.format).toBe('npm');
    expect(result.outputPath).toBeDefined();
  });

  it('should package as bundle format', async () => {
    const result = await typescriptBuilderHandler.package(
      { sourcePath: './src/index.ts', format: 'bundle' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.format).toBe('bundle');
  });

  it('should package as docker format', async () => {
    const result = await typescriptBuilderHandler.package(
      { sourcePath: './src/index.ts', format: 'docker' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.format).toBe('docker');
  });

  it('should return formatUnsupported for unknown format', async () => {
    const result = await typescriptBuilderHandler.package(
      { sourcePath: './src/index.ts', format: 'rpm' },
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
      { sourcePath: './src/app.ts', target: 'es2022' },
      storage,
    );
    expect(buildResult.variant).toBe('ok');
    expect((buildResult.artifactPath as string)).toMatch(/\.js|dist|\.tsbuildinfo/);

    const testResult = await typescriptBuilderHandler.test(
      { sourcePath: './src/app.ts', testTarget: 'vitest' },
      storage,
    );
    expect(testResult.variant).toBe('ok');
  });
});
