// ============================================================
// SolidityToolchain Conformance Tests
//
// Validates Solidity toolchain resolution including version
// detection, unsupported EVM version handling, and capability
// reporting for optimizer, via-ir, and foundry-tests.
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/runtime';
import { solidityToolchainHandler } from '../../../../implementations/typescript/deploy/solidity-toolchain.impl.js';
import type { ConceptStorage } from '@clef/runtime';

describe('SolidityToolchain conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- resolve ---

  it('should resolve an installed toolchain with path, version, and capabilities', async () => {
    const result = await solidityToolchainHandler.resolve(
      { language: 'solidity', minimumVersion: '0.8.20' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.toolchain).toBeDefined();
    expect(result.path).toBeDefined();
    expect(result.version).toBeDefined();
    expect(result.capabilities).toBeDefined();
    expect(Array.isArray(result.capabilities)).toBe(true);
  });

  it('should include optimizer capability when available', async () => {
    const result = await solidityToolchainHandler.resolve(
      { language: 'solidity', minimumVersion: '0.8.20' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const capabilities = result.capabilities as string[];
    expect(capabilities).toContain('optimizer');
  });

  it('should include via-ir capability when available', async () => {
    const result = await solidityToolchainHandler.resolve(
      { language: 'solidity', minimumVersion: '0.8.20' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const capabilities = result.capabilities as string[];
    expect(capabilities).toContain('via-ir');
  });

  it('should include foundry-tests capability when available', async () => {
    const result = await solidityToolchainHandler.resolve(
      { language: 'solidity', minimumVersion: '0.8.20' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const capabilities = result.capabilities as string[];
    expect(capabilities).toContain('foundry-tests');
  });

  it('should return notInstalled with installHint when toolchain is missing', async () => {
    const result = await solidityToolchainHandler.resolve(
      { language: 'solidity', minimumVersion: '99.0', simulateError: 'notInstalled' },
      storage,
    );
    expect(result.variant).toBe('notInstalled');
    expect(result.installHint).toBeDefined();
    expect(typeof result.installHint).toBe('string');
  });

  it('should return evmVersionUnsupported when EVM target is not supported', async () => {
    const result = await solidityToolchainHandler.resolve(
      { language: 'solidity', minimumVersion: '0.8.20', simulateError: 'evmVersionUnsupported' },
      storage,
    );
    expect(result.variant).toBe('evmVersionUnsupported');
    expect(result.message).toBeDefined();
  });

  it('should return a toolchain identifier string on successful resolve', async () => {
    const result = await solidityToolchainHandler.resolve(
      { language: 'solidity', minimumVersion: '0.8.20' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(typeof result.toolchain).toBe('string');
    expect((result.toolchain as string).length).toBeGreaterThan(0);
  });

  it('should return a version string matching semver-like format', async () => {
    const result = await solidityToolchainHandler.resolve(
      { language: 'solidity', minimumVersion: '0.8.20' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(typeof result.version).toBe('string');
    expect((result.version as string)).toMatch(/^\d+\.\d+/);
  });

  it('should provide a non-empty installHint when not installed', async () => {
    const result = await solidityToolchainHandler.resolve(
      { language: 'solidity', minimumVersion: '99.0', simulateError: 'notInstalled' },
      storage,
    );
    expect(result.variant).toBe('notInstalled');
    expect((result.installHint as string).length).toBeGreaterThan(0);
  });

  // --- register ---

  it('should return correct name, language, and capabilities', async () => {
    const result = await solidityToolchainHandler.register({}, storage);
    expect(result.variant).toBe('ok');
    expect(result.name).toBe('SolidityToolchain');
    expect(result.language).toBe('solidity');
    expect(result.capabilities).toBeDefined();
    expect(Array.isArray(result.capabilities)).toBe(true);
    const capabilities = result.capabilities as string[];
    expect(capabilities).toContain('optimizer');
    expect(capabilities).toContain('via-ir');
    expect(capabilities).toContain('foundry-tests');
  });
});
