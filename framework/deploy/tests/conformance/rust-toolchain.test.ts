// ============================================================
// RustToolchain Conformance Tests
//
// Validates Rust toolchain resolution including version detection,
// missing target handling, and capability reporting for wasm-target,
// proc-macros, and incremental compilation.
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/runtime';
import { rustToolchainHandler } from '../../../../handlers/ts/deploy/rust-toolchain.handler.js';
import type { ConceptStorage } from '@clef/runtime';

describe('RustToolchain conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- resolve ---

  it('should resolve an installed toolchain with path, version, and capabilities', async () => {
    const result = await rustToolchainHandler.resolve(
      { language: 'rust', minimumVersion: '1.75' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.toolchain).toBeDefined();
    expect(result.path).toBeDefined();
    expect(result.version).toBeDefined();
    expect(result.capabilities).toBeDefined();
    expect(Array.isArray(result.capabilities)).toBe(true);
  });

  it('should include wasm-target capability when available', async () => {
    const result = await rustToolchainHandler.resolve(
      { language: 'rust', minimumVersion: '1.75' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const capabilities = result.capabilities as string[];
    expect(capabilities).toContain('wasm-target');
  });

  it('should include proc-macros capability when available', async () => {
    const result = await rustToolchainHandler.resolve(
      { language: 'rust', minimumVersion: '1.75' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const capabilities = result.capabilities as string[];
    expect(capabilities).toContain('proc-macros');
  });

  it('should include incremental capability when available', async () => {
    const result = await rustToolchainHandler.resolve(
      { language: 'rust', minimumVersion: '1.75' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const capabilities = result.capabilities as string[];
    expect(capabilities).toContain('incremental');
  });

  it('should return notInstalled with installHint when toolchain is missing', async () => {
    const result = await rustToolchainHandler.resolve(
      { language: 'rust', minimumVersion: '99.0', simulateError: 'notInstalled' },
      storage,
    );
    expect(result.variant).toBe('notInstalled');
    expect(result.installHint).toBeDefined();
    expect(typeof result.installHint).toBe('string');
  });

  it('should return targetMissing when required compile target is unavailable', async () => {
    const result = await rustToolchainHandler.resolve(
      { language: 'rust', minimumVersion: '1.75', simulateError: 'targetMissing' },
      storage,
    );
    expect(result.variant).toBe('targetMissing');
    expect(result.message).toBeDefined();
  });

  it('should return a toolchain identifier string on successful resolve', async () => {
    const result = await rustToolchainHandler.resolve(
      { language: 'rust', minimumVersion: '1.75' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(typeof result.toolchain).toBe('string');
    expect((result.toolchain as string).length).toBeGreaterThan(0);
  });

  it('should return a version string matching semver-like format', async () => {
    const result = await rustToolchainHandler.resolve(
      { language: 'rust', minimumVersion: '1.75' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(typeof result.version).toBe('string');
    expect((result.version as string)).toMatch(/^\d+\.\d+/);
  });

  it('should provide a non-empty installHint when not installed', async () => {
    const result = await rustToolchainHandler.resolve(
      { language: 'rust', minimumVersion: '99.0', simulateError: 'notInstalled' },
      storage,
    );
    expect(result.variant).toBe('notInstalled');
    expect((result.installHint as string).length).toBeGreaterThan(0);
  });

  // --- register ---

  it('should return correct name, language, and capabilities', async () => {
    const result = await rustToolchainHandler.register({}, storage);
    expect(result.variant).toBe('ok');
    expect(result.name).toBe('RustToolchain');
    expect(result.language).toBe('rust');
    expect(result.capabilities).toBeDefined();
    expect(Array.isArray(result.capabilities)).toBe(true);
    const capabilities = result.capabilities as string[];
    expect(capabilities).toContain('wasm-target');
    expect(capabilities).toContain('proc-macros');
    expect(capabilities).toContain('incremental');
  });
});
