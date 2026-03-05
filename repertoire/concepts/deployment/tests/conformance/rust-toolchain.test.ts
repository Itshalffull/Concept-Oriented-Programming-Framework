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

/**
 * Probe whether the Rust toolchain handler resolves successfully
 * for a known-good platform. Returns false when the handler
 * returns a non-ok variant (e.g., on systems without Rust).
 */
async function isRustToolchainAvailable(): Promise<boolean> {
  const storage = createInMemoryStorage();
  const result = await rustToolchainHandler.resolve(
    { platform: 'x86_64-linux' },
    storage,
  );
  return result.variant === 'ok';
}

const rustAvailable = await isRustToolchainAvailable();

describe('RustToolchain conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- resolve ---

  it.skipIf(!rustAvailable)('should resolve an installed toolchain with path, version, and capabilities', async () => {
    const result = await rustToolchainHandler.resolve(
      { platform: 'x86_64-linux' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.tool).toBeDefined();
    expect(result.path).toBeDefined();
    expect(result.version).toBeDefined();
    expect(result.capabilities).toBeDefined();
    expect(Array.isArray(result.capabilities)).toBe(true);
  });

  it.skipIf(!rustAvailable)('should include wasm-target capability when available', async () => {
    const result = await rustToolchainHandler.resolve(
      { platform: 'x86_64-linux' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const capabilities = result.capabilities as string[];
    expect(capabilities).toContain('wasm-target');
  });

  it.skipIf(!rustAvailable)('should include proc-macros capability when available', async () => {
    const result = await rustToolchainHandler.resolve(
      { platform: 'x86_64-linux' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const capabilities = result.capabilities as string[];
    expect(capabilities).toContain('proc-macros');
  });

  it.skipIf(!rustAvailable)('should include incremental capability when available', async () => {
    const result = await rustToolchainHandler.resolve(
      { platform: 'x86_64-linux' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const capabilities = result.capabilities as string[];
    expect(capabilities).toContain('incremental');
  });

  it('should return notInstalled with installHint for unknown platform', async () => {
    const result = await rustToolchainHandler.resolve(
      { platform: 'unknown-platform-xyz' },
      storage,
    );
    expect(result.variant).toBe('notInstalled');
    expect(result.installHint).toBeDefined();
    expect(typeof result.installHint).toBe('string');
  });

  it('should return targetMissing when platform is empty', async () => {
    const result = await rustToolchainHandler.resolve(
      { platform: '' },
      storage,
    );
    expect(result.variant).toBe('targetMissing');
    expect(result.installHint).toBeDefined();
  });

  it.skipIf(!rustAvailable)('should return a toolchain identifier string on successful resolve', async () => {
    const result = await rustToolchainHandler.resolve(
      { platform: 'x86_64-linux' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(typeof result.tool).toBe('string');
    expect((result.tool as string).length).toBeGreaterThan(0);
  });

  it.skipIf(!rustAvailable)('should return a version string matching semver-like format', async () => {
    const result = await rustToolchainHandler.resolve(
      { platform: 'x86_64-linux' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(typeof result.version).toBe('string');
    expect((result.version as string)).toMatch(/^\d+\.\d+/);
  });

  it('should provide a non-empty installHint when not installed', async () => {
    const result = await rustToolchainHandler.resolve(
      { platform: 'unknown-platform-xyz' },
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
  });
});
