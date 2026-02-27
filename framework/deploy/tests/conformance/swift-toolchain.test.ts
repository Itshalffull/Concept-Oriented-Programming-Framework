// ============================================================
// SwiftToolchain Conformance Tests
//
// Validates Swift toolchain resolution including version detection,
// Xcode requirement checks, and capability reporting for macros,
// swift-testing, and typed-throws.
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/runtime';
import { swiftToolchainHandler } from '../../../../handlers/ts/deploy/swift-toolchain.handler.js';
import type { ConceptStorage } from '@clef/runtime';

/**
 * Probe whether the Swift toolchain handler resolves successfully
 * for a known-good platform. Returns false when the handler
 * returns a non-ok variant (e.g., on systems without Swift).
 */
async function isSwiftToolchainAvailable(): Promise<boolean> {
  const storage = createInMemoryStorage();
  const result = await swiftToolchainHandler.resolve(
    { platform: 'macos' },
    storage,
  );
  return result.variant === 'ok';
}

const swiftAvailable = await isSwiftToolchainAvailable();

describe('SwiftToolchain conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- resolve ---

  it.skipIf(!swiftAvailable)('should resolve an installed toolchain with path, version, and capabilities', async () => {
    const result = await swiftToolchainHandler.resolve(
      { platform: 'macos' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.tool).toBeDefined();
    expect(result.path).toBeDefined();
    expect(result.version).toBeDefined();
    expect(result.capabilities).toBeDefined();
    expect(Array.isArray(result.capabilities)).toBe(true);
  });

  it.skipIf(!swiftAvailable)('should include macros capability when available', async () => {
    const result = await swiftToolchainHandler.resolve(
      { platform: 'macos' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const capabilities = result.capabilities as string[];
    expect(capabilities).toContain('macros');
  });

  it.skipIf(!swiftAvailable)('should include swift-testing capability when available', async () => {
    const result = await swiftToolchainHandler.resolve(
      { platform: 'macos' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const capabilities = result.capabilities as string[];
    expect(capabilities).toContain('swift-testing');
  });

  it.skipIf(!swiftAvailable)('should include cross-compile capability when available', async () => {
    const result = await swiftToolchainHandler.resolve(
      { platform: 'macos' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const capabilities = result.capabilities as string[];
    expect(capabilities).toContain('cross-compile');
  });

  it('should return notInstalled with installHint for unknown platform', async () => {
    const result = await swiftToolchainHandler.resolve(
      { platform: 'unknown-platform-xyz' },
      storage,
    );
    expect(result.variant).toBe('notInstalled');
    expect(result.installHint).toBeDefined();
    expect(typeof result.installHint).toBe('string');
  });

  it('should return xcodeRequired when platform is empty', async () => {
    const result = await swiftToolchainHandler.resolve(
      { platform: '' },
      storage,
    );
    expect(result.variant).toBe('xcodeRequired');
    expect(result.reason).toBeDefined();
  });

  it.skipIf(!swiftAvailable)('should return a toolchain identifier string on successful resolve', async () => {
    const result = await swiftToolchainHandler.resolve(
      { platform: 'macos' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(typeof result.tool).toBe('string');
    expect((result.tool as string).length).toBeGreaterThan(0);
  });

  it.skipIf(!swiftAvailable)('should return a version string matching semver-like format', async () => {
    const result = await swiftToolchainHandler.resolve(
      { platform: 'macos' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(typeof result.version).toBe('string');
    expect((result.version as string)).toMatch(/^\d+\.\d+/);
  });

  it('should provide a non-empty installHint when not installed', async () => {
    const result = await swiftToolchainHandler.resolve(
      { platform: 'unknown-platform-xyz' },
      storage,
    );
    expect(result.variant).toBe('notInstalled');
    expect((result.installHint as string).length).toBeGreaterThan(0);
  });

  // --- register ---

  it('should return correct name, language, and capabilities', async () => {
    const result = await swiftToolchainHandler.register({}, storage);
    expect(result.variant).toBe('ok');
    expect(result.name).toBe('SwiftToolchain');
    expect(result.language).toBe('swift');
    expect(result.capabilities).toBeDefined();
    expect(Array.isArray(result.capabilities)).toBe(true);
  });
});
