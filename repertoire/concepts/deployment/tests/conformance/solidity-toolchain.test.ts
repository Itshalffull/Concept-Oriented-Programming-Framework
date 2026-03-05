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
import { solidityToolchainHandler } from '../../../../handlers/ts/deploy/solidity-toolchain.handler.js';
import type { ConceptStorage } from '@clef/runtime';

/**
 * Probe whether the Solidity toolchain handler resolves successfully
 * for a known-good platform. Returns false when the handler
 * returns a non-ok variant (e.g., on systems without Solidity).
 */
async function isSolidityToolchainAvailable(): Promise<boolean> {
  const storage = createInMemoryStorage();
  const result = await solidityToolchainHandler.resolve(
    { platform: 'shanghai' },
    storage,
  );
  return result.variant === 'ok';
}

const solidityAvailable = await isSolidityToolchainAvailable();

describe('SolidityToolchain conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- resolve ---

  it.skipIf(!solidityAvailable)('should resolve an installed toolchain with path, version, and capabilities', async () => {
    const result = await solidityToolchainHandler.resolve(
      { platform: 'shanghai' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.tool).toBeDefined();
    expect(result.path).toBeDefined();
    expect(result.version).toBeDefined();
    expect(result.capabilities).toBeDefined();
    expect(Array.isArray(result.capabilities)).toBe(true);
  });

  it.skipIf(!solidityAvailable)('should include optimizer capability when available', async () => {
    const result = await solidityToolchainHandler.resolve(
      { platform: 'shanghai' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const capabilities = result.capabilities as string[];
    expect(capabilities).toContain('optimizer');
  });

  it.skipIf(!solidityAvailable)('should include via-ir capability when available', async () => {
    const result = await solidityToolchainHandler.resolve(
      { platform: 'shanghai' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const capabilities = result.capabilities as string[];
    expect(capabilities).toContain('via-ir');
  });

  it.skipIf(!solidityAvailable)('should include foundry-tests capability when available', async () => {
    const result = await solidityToolchainHandler.resolve(
      { platform: 'shanghai' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const capabilities = result.capabilities as string[];
    expect(capabilities).toContain('foundry-tests');
  });

  it('should return notInstalled with installHint for unknown platform', async () => {
    const result = await solidityToolchainHandler.resolve(
      { platform: 'unknown-platform-xyz' },
      storage,
    );
    expect(result.variant).toBe('notInstalled');
    expect(result.installHint).toBeDefined();
    expect(typeof result.installHint).toBe('string');
  });

  it('should return evmVersionUnsupported when EVM target is not supported', async () => {
    const result = await solidityToolchainHandler.resolve(
      { platform: 'prague' },
      storage,
    );
    expect(result.variant).toBe('evmVersionUnsupported');
    expect(result.requested).toBeDefined();
  });

  it.skipIf(!solidityAvailable)('should return a toolchain identifier string on successful resolve', async () => {
    const result = await solidityToolchainHandler.resolve(
      { platform: 'shanghai' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(typeof result.tool).toBe('string');
    expect((result.tool as string).length).toBeGreaterThan(0);
  });

  it.skipIf(!solidityAvailable)('should return a version string matching semver-like format', async () => {
    const result = await solidityToolchainHandler.resolve(
      { platform: 'shanghai' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(typeof result.version).toBe('string');
    expect((result.version as string)).toMatch(/^\d+\.\d+/);
  });

  it('should provide a non-empty installHint when not installed', async () => {
    const result = await solidityToolchainHandler.resolve(
      { platform: 'unknown-platform-xyz' },
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
  });
});
