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
import { solidityBuilderHandler } from '../../../../handlers/ts/deploy/solidity-builder.handler.js';
import type { ConceptStorage } from '@clef/runtime';

describe('SolidityBuilder conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- build ---

  it('should build successfully and return artifact path and hash', async () => {
    const result = await solidityBuilderHandler.build(
      { source: './contracts/Token.sol', toolchainPath: '/usr/local/bin/solc', platform: 'paris', config: { mode: 'release', features: [] } },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.artifactPath).toBeDefined();
    expect(result.artifactHash).toBeDefined();
  });

  it('should return compilationError when source is missing', async () => {
    const result = await solidityBuilderHandler.build(
      { source: '', toolchainPath: '', platform: 'paris', config: { mode: 'release', features: [] } },
      storage,
    );
    expect(result.variant).toBe('compilationError');
    expect(result.errors).toBeDefined();
  });

  it('should return pragmaMismatch on solidity version conflict', async () => {
    const result = await solidityBuilderHandler.build(
      { source: './contracts/Token.sol', toolchainPath: '/usr/local/bin/solc', platform: 'paris', config: { mode: 'release', features: ['pragma:0.8.25'] } },
      storage,
    );
    expect(result.variant).toBe('pragmaMismatch');
    expect(result.required).toBeDefined();
    expect(result.installed).toBeDefined();
  });

  // --- test ---

  it('should run tests and return pass/fail/skipped/duration', async () => {
    const buildResult = await solidityBuilderHandler.build(
      { source: './contracts/Token.sol', toolchainPath: '/usr/local/bin/solc', platform: 'paris', config: { mode: 'release', features: [] } },
      storage,
    );
    expect(buildResult.variant).toBe('ok');

    const result = await solidityBuilderHandler.test(
      { build: buildResult.build as string, toolchainPath: '/usr/local/bin/solc' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(typeof result.passed).toBe('number');
    expect(typeof result.failed).toBe('number');
    expect(typeof result.skipped).toBe('number');
    expect(typeof result.duration).toBe('number');
  });

  it('should return testFailure when build is not found', async () => {
    const result = await solidityBuilderHandler.test(
      { build: 'nonexistent-build-id', toolchainPath: '/usr/local/bin/solc' },
      storage,
    );
    expect(result.variant).toBe('testFailure');
    expect(result.failures).toBeDefined();
    expect(Array.isArray(result.failures)).toBe(true);
  });

  // --- package ---

  it('should package as abi-bundle format', async () => {
    const buildResult = await solidityBuilderHandler.build(
      { source: './contracts/Token.sol', toolchainPath: '/usr/local/bin/solc', platform: 'paris', config: { mode: 'release', features: [] } },
      storage,
    );
    expect(buildResult.variant).toBe('ok');

    const result = await solidityBuilderHandler.package(
      { build: buildResult.build as string, format: 'abi-bundle' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.artifactPath).toBeDefined();
  });

  it('should package as hardhat-artifacts format', async () => {
    const buildResult = await solidityBuilderHandler.build(
      { source: './contracts/Token.sol', toolchainPath: '/usr/local/bin/solc', platform: 'paris', config: { mode: 'release', features: [] } },
      storage,
    );
    expect(buildResult.variant).toBe('ok');

    const result = await solidityBuilderHandler.package(
      { build: buildResult.build as string, format: 'hardhat-artifacts' },
      storage,
    );
    expect(result.variant).toBe('ok');
  });

  it('should package as foundry-out format', async () => {
    const buildResult = await solidityBuilderHandler.build(
      { source: './contracts/Token.sol', toolchainPath: '/usr/local/bin/solc', platform: 'paris', config: { mode: 'release', features: [] } },
      storage,
    );
    expect(buildResult.variant).toBe('ok');

    const result = await solidityBuilderHandler.package(
      { build: buildResult.build as string, format: 'foundry-out' },
      storage,
    );
    expect(result.variant).toBe('ok');
  });

  it('should return formatUnsupported for unknown format', async () => {
    const buildResult = await solidityBuilderHandler.build(
      { source: './contracts/Token.sol', toolchainPath: '/usr/local/bin/solc', platform: 'paris', config: { mode: 'release', features: [] } },
      storage,
    );
    expect(buildResult.variant).toBe('ok');

    const result = await solidityBuilderHandler.package(
      { build: buildResult.build as string, format: 'tar' },
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
      { source: './contracts/Token.sol', toolchainPath: '/usr/local/bin/solc', platform: 'paris', config: { mode: 'release', features: [] } },
      storage,
    );
    expect(buildResult.variant).toBe('ok');
    expect((buildResult.artifactPath as string)).toMatch(/build\/solidity/);

    const testResult = await solidityBuilderHandler.test(
      { build: buildResult.build as string, toolchainPath: '/usr/local/bin/solc' },
      storage,
    );
    expect(testResult.variant).toBe('ok');
  });
});
