// ============================================================
// SolidityBuilder Conformance Tests
//
// Validates Solidity build, test, package, and register actions
// including compilation errors, pragma mismatches, and ABI/artifact
// packaging formats.
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/runtime';
import { solidityBuilderHandler } from '../../../../implementations/typescript/deploy/solidity-builder.impl.js';
import type { ConceptStorage } from '@clef/runtime';

describe('SolidityBuilder conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- build ---

  it('should build successfully and return artifact path and hash', async () => {
    const result = await solidityBuilderHandler.build(
      { sourcePath: './contracts/Token.sol', target: 'paris' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.artifactPath).toBeDefined();
    expect(result.artifactHash).toBeDefined();
  });

  it('should return compilationError with file, line, and message', async () => {
    const result = await solidityBuilderHandler.build(
      { sourcePath: './contracts/Invalid.sol', target: 'paris', simulateError: 'compilationError' },
      storage,
    );
    expect(result.variant).toBe('compilationError');
    expect(result.file).toBeDefined();
    expect(result.line).toBeDefined();
    expect(result.message).toBeDefined();
  });

  it('should return pragmaMismatch on solidity version conflict', async () => {
    const result = await solidityBuilderHandler.build(
      { sourcePath: './contracts/Token.sol', target: 'paris', simulateError: 'pragmaMismatch' },
      storage,
    );
    expect(result.variant).toBe('pragmaMismatch');
    expect(result.message).toBeDefined();
  });

  // --- test ---

  it('should run tests and return pass/fail/skipped/duration', async () => {
    const result = await solidityBuilderHandler.test(
      { sourcePath: './contracts/Token.sol', testTarget: 'forge-test' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(typeof result.pass).toBe('number');
    expect(typeof result.fail).toBe('number');
    expect(typeof result.skipped).toBe('number');
    expect(typeof result.duration).toBe('number');
  });

  it('should return testFailure with failure details', async () => {
    const result = await solidityBuilderHandler.test(
      { sourcePath: './contracts/Token.sol', testTarget: 'forge-test', simulateError: 'testFailure' },
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

  it('should package as abi-bundle format', async () => {
    const result = await solidityBuilderHandler.package(
      { sourcePath: './contracts/Token.sol', format: 'abi-bundle' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.format).toBe('abi-bundle');
    expect(result.outputPath).toBeDefined();
  });

  it('should package as hardhat-artifacts format', async () => {
    const result = await solidityBuilderHandler.package(
      { sourcePath: './contracts/Token.sol', format: 'hardhat-artifacts' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.format).toBe('hardhat-artifacts');
  });

  it('should package as foundry-out format', async () => {
    const result = await solidityBuilderHandler.package(
      { sourcePath: './contracts/Token.sol', format: 'foundry-out' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.format).toBe('foundry-out');
  });

  it('should return formatUnsupported for unknown format', async () => {
    const result = await solidityBuilderHandler.package(
      { sourcePath: './contracts/Token.sol', format: 'tar' },
      storage,
    );
    expect(result.variant).toBe('formatUnsupported');
    expect(result.format).toBe('tar');
  });

  // --- register ---

  it('should return correct name, language, and capabilities', async () => {
    const result = await solidityBuilderHandler.register({}, storage);
    expect(result.variant).toBe('ok');
    expect(result.name).toBe('SolidityBuilder');
    expect(result.language).toBe('solidity');
    expect(result.capabilities).toBeDefined();
    expect(Array.isArray(result.capabilities)).toBe(true);
  });

  // --- invariant: build then test with solc paths ---

  it('should build then test using solc artifact paths', async () => {
    const buildResult = await solidityBuilderHandler.build(
      { sourcePath: './contracts/Token.sol', target: 'paris' },
      storage,
    );
    expect(buildResult.variant).toBe('ok');
    expect((buildResult.artifactPath as string)).toMatch(/\.json|artifacts|out/);

    const testResult = await solidityBuilderHandler.test(
      { sourcePath: './contracts/Token.sol', testTarget: 'forge-test' },
      storage,
    );
    expect(testResult.variant).toBe('ok');
  });
});
