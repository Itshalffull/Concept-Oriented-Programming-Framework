// ============================================================
// SwiftToolchain Conformance Tests
//
// Validates Swift toolchain resolution including version detection,
// Xcode requirement checks, and capability reporting for macros,
// swift-testing, and typed-throws.
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/kernel';
import { swiftToolchainHandler } from '../../../../implementations/typescript/deploy/swift-toolchain.impl.js';
import type { ConceptStorage } from '@clef/kernel';

describe('SwiftToolchain conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- resolve ---

  it('should resolve an installed toolchain with path, version, and capabilities', async () => {
    const result = await swiftToolchainHandler.resolve(
      { language: 'swift', minimumVersion: '5.9' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.toolchain).toBeDefined();
    expect(result.path).toBeDefined();
    expect(result.version).toBeDefined();
    expect(result.capabilities).toBeDefined();
    expect(Array.isArray(result.capabilities)).toBe(true);
  });

  it('should include macros capability when available', async () => {
    const result = await swiftToolchainHandler.resolve(
      { language: 'swift', minimumVersion: '5.9' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const capabilities = result.capabilities as string[];
    expect(capabilities).toContain('macros');
  });

  it('should include swift-testing capability when available', async () => {
    const result = await swiftToolchainHandler.resolve(
      { language: 'swift', minimumVersion: '6.0' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const capabilities = result.capabilities as string[];
    expect(capabilities).toContain('swift-testing');
  });

  it('should include typed-throws capability when available', async () => {
    const result = await swiftToolchainHandler.resolve(
      { language: 'swift', minimumVersion: '6.0' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const capabilities = result.capabilities as string[];
    expect(capabilities).toContain('typed-throws');
  });

  it('should return notInstalled with installHint when toolchain is missing', async () => {
    const result = await swiftToolchainHandler.resolve(
      { language: 'swift', minimumVersion: '99.0', simulateError: 'notInstalled' },
      storage,
    );
    expect(result.variant).toBe('notInstalled');
    expect(result.installHint).toBeDefined();
    expect(typeof result.installHint).toBe('string');
  });

  it('should return xcodeRequired when Xcode is not available', async () => {
    const result = await swiftToolchainHandler.resolve(
      { language: 'swift', minimumVersion: '5.9', simulateError: 'xcodeRequired' },
      storage,
    );
    expect(result.variant).toBe('xcodeRequired');
    expect(result.message).toBeDefined();
  });

  it('should return a toolchain identifier string on successful resolve', async () => {
    const result = await swiftToolchainHandler.resolve(
      { language: 'swift', minimumVersion: '5.9' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(typeof result.toolchain).toBe('string');
    expect((result.toolchain as string).length).toBeGreaterThan(0);
  });

  it('should return a version string matching semver-like format', async () => {
    const result = await swiftToolchainHandler.resolve(
      { language: 'swift', minimumVersion: '5.9' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(typeof result.version).toBe('string');
    expect((result.version as string)).toMatch(/^\d+\.\d+/);
  });

  it('should provide a non-empty installHint when not installed', async () => {
    const result = await swiftToolchainHandler.resolve(
      { language: 'swift', minimumVersion: '99.0', simulateError: 'notInstalled' },
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
    const capabilities = result.capabilities as string[];
    expect(capabilities).toContain('macros');
    expect(capabilities).toContain('swift-testing');
    expect(capabilities).toContain('typed-throws');
  });
});
