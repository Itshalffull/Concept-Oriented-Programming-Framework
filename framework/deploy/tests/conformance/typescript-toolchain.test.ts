// ============================================================
// TypeScriptToolchain Conformance Tests
//
// Validates TypeScript toolchain resolution including version
// detection, Node version mismatch handling, and capability
// reporting for esm, cjs, and declaration-maps.
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/runtime';
import { typescriptToolchainHandler } from '../../../../implementations/typescript/deploy/typescript-toolchain.impl.js';
import type { ConceptStorage } from '@clef/runtime';

describe('TypeScriptToolchain conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- resolve ---

  it('should resolve an installed toolchain with path, version, and capabilities', async () => {
    const result = await typescriptToolchainHandler.resolve(
      { language: 'typescript', minimumVersion: '5.0' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.toolchain).toBeDefined();
    expect(result.path).toBeDefined();
    expect(result.version).toBeDefined();
    expect(result.capabilities).toBeDefined();
    expect(Array.isArray(result.capabilities)).toBe(true);
  });

  it('should include esm capability when available', async () => {
    const result = await typescriptToolchainHandler.resolve(
      { language: 'typescript', minimumVersion: '5.0' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const capabilities = result.capabilities as string[];
    expect(capabilities).toContain('esm');
  });

  it('should include cjs capability when available', async () => {
    const result = await typescriptToolchainHandler.resolve(
      { language: 'typescript', minimumVersion: '5.0' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const capabilities = result.capabilities as string[];
    expect(capabilities).toContain('cjs');
  });

  it('should include declaration-maps capability when available', async () => {
    const result = await typescriptToolchainHandler.resolve(
      { language: 'typescript', minimumVersion: '5.0' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const capabilities = result.capabilities as string[];
    expect(capabilities).toContain('declaration-maps');
  });

  it('should return notInstalled with installHint when toolchain is missing', async () => {
    const result = await typescriptToolchainHandler.resolve(
      { language: 'typescript', minimumVersion: '99.0', simulateError: 'notInstalled' },
      storage,
    );
    expect(result.variant).toBe('notInstalled');
    expect(result.installHint).toBeDefined();
    expect(typeof result.installHint).toBe('string');
  });

  it('should return nodeVersionMismatch when Node.js version is incompatible', async () => {
    const result = await typescriptToolchainHandler.resolve(
      { language: 'typescript', minimumVersion: '5.0', simulateError: 'nodeVersionMismatch' },
      storage,
    );
    expect(result.variant).toBe('nodeVersionMismatch');
    expect(result.message).toBeDefined();
  });

  it('should return a toolchain identifier string on successful resolve', async () => {
    const result = await typescriptToolchainHandler.resolve(
      { language: 'typescript', minimumVersion: '5.0' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(typeof result.toolchain).toBe('string');
    expect((result.toolchain as string).length).toBeGreaterThan(0);
  });

  it('should return a version string matching semver-like format', async () => {
    const result = await typescriptToolchainHandler.resolve(
      { language: 'typescript', minimumVersion: '5.0' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(typeof result.version).toBe('string');
    expect((result.version as string)).toMatch(/^\d+\.\d+/);
  });

  it('should provide a non-empty installHint when not installed', async () => {
    const result = await typescriptToolchainHandler.resolve(
      { language: 'typescript', minimumVersion: '99.0', simulateError: 'notInstalled' },
      storage,
    );
    expect(result.variant).toBe('notInstalled');
    expect((result.installHint as string).length).toBeGreaterThan(0);
  });

  // --- register ---

  it('should return correct name, language, and capabilities', async () => {
    const result = await typescriptToolchainHandler.register({}, storage);
    expect(result.variant).toBe('ok');
    expect(result.name).toBe('TypeScriptToolchain');
    expect(result.language).toBe('typescript');
    expect(result.capabilities).toBeDefined();
    expect(Array.isArray(result.capabilities)).toBe(true);
    const capabilities = result.capabilities as string[];
    expect(capabilities).toContain('esm');
    expect(capabilities).toContain('cjs');
    expect(capabilities).toContain('declaration-maps');
  });
});
