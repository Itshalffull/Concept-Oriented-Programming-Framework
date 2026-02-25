// ============================================================
// Toolchain Resolution Integration Test
//
// Tests toolchain resolution behavior:
// - Resolve, validate, list lifecycle
// - Version constraint matching
// - Platform support detection
// - Resolution caching (resolve once, use many times)
// - Drift detection via validate
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@copf/kernel';
import { toolchainHandler } from '../../../../implementations/typescript/deploy/toolchain.impl.js';
import type { ConceptStorage } from '@copf/kernel';

describe('Toolchain resolution integration', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- Resolve returns tool with version and capabilities ---

  it('should resolve and return tool with version and capabilities', async () => {
    const result = await toolchainHandler.resolve(
      {
        tool: 'tsc',
        language: 'typescript',
        requiredVersion: '>=5.0.0',
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.tool).toBe('tsc');
    expect(result.version).toBeDefined();
    expect(typeof result.version).toBe('string');
    expect(result.path).toBeDefined();
    expect(typeof result.path).toBe('string');
    expect(result.capabilities).toBeDefined();
    expect(Array.isArray(result.capabilities)).toBe(true);
    expect((result.capabilities as string[]).length).toBeGreaterThan(0);
  });

  // --- Resolved tool passes validation ---

  it('should pass validation for a previously resolved tool', async () => {
    const resolveResult = await toolchainHandler.resolve(
      {
        tool: 'rustc',
        language: 'rust',
        requiredVersion: '>=1.70.0',
      },
      storage,
    );
    expect(resolveResult.variant).toBe('ok');
    const resolvedVersion = resolveResult.version as string;

    const validateResult = await toolchainHandler.validate(
      {
        tool: 'rustc',
        language: 'rust',
      },
      storage,
    );
    expect(validateResult.variant).toBe('ok');
    expect(validateResult.tool).toBe('rustc');
    expect(validateResult.version).toBe(resolvedVersion);
  });

  // --- List returns all resolved toolchains ---

  it('should list all resolved toolchains', async () => {
    await toolchainHandler.resolve(
      { tool: 'tsc', language: 'typescript', requiredVersion: '>=5.0.0' },
      storage,
    );
    await toolchainHandler.resolve(
      { tool: 'rustc', language: 'rust', requiredVersion: '>=1.70.0' },
      storage,
    );
    await toolchainHandler.resolve(
      { tool: 'swiftc', language: 'swift', requiredVersion: '>=5.9.0' },
      storage,
    );

    const listResult = await toolchainHandler.list({}, storage);
    expect(listResult.variant).toBe('ok');
    const toolchains = listResult.toolchains as any[];
    expect(toolchains).toHaveLength(3);

    const tools = toolchains.map((t: any) => t.tool).sort();
    expect(tools).toEqual(['rustc', 'swiftc', 'tsc']);
  });

  // --- List filtered by language returns subset ---

  it('should filter list by language and return only matching toolchains', async () => {
    await toolchainHandler.resolve(
      { tool: 'tsc', language: 'typescript', requiredVersion: '>=5.0.0' },
      storage,
    );
    await toolchainHandler.resolve(
      { tool: 'esbuild', language: 'typescript', requiredVersion: '>=0.18.0' },
      storage,
    );
    await toolchainHandler.resolve(
      { tool: 'rustc', language: 'rust', requiredVersion: '>=1.70.0' },
      storage,
    );
    await toolchainHandler.resolve(
      { tool: 'solc', language: 'solidity', requiredVersion: '>=0.8.0' },
      storage,
    );

    const tsResult = await toolchainHandler.list(
      { language: 'typescript' },
      storage,
    );
    expect(tsResult.variant).toBe('ok');
    const tsToolchains = tsResult.toolchains as any[];
    expect(tsToolchains).toHaveLength(2);
    for (const tc of tsToolchains) {
      expect(tc.language).toBe('typescript');
    }

    const rustResult = await toolchainHandler.list(
      { language: 'rust' },
      storage,
    );
    expect(rustResult.variant).toBe('ok');
    const rustToolchains = rustResult.toolchains as any[];
    expect(rustToolchains).toHaveLength(1);
    expect(rustToolchains[0].tool).toBe('rustc');
  });

  // --- Version constraint too high -> versionMismatch ---

  it('should return versionMismatch when version constraint is too high', async () => {
    const result = await toolchainHandler.resolve(
      {
        tool: 'tsc',
        language: 'typescript',
        requiredVersion: '>=99.0.0',
        simulateError: 'versionMismatch',
      },
      storage,
    );
    expect(result.variant).toBe('versionMismatch');
    expect(result.installed).toBeDefined();
    expect(result.required).toBeDefined();
    expect(typeof result.installed).toBe('string');
    expect(typeof result.required).toBe('string');
    expect(result.installed).not.toBe(result.required);
  });

  // --- Unsupported platform -> platformUnsupported ---

  it('should return platformUnsupported for incompatible target platform', async () => {
    const result = await toolchainHandler.resolve(
      {
        tool: 'swift',
        language: 'swift',
        requiredVersion: '>=5.0.0',
        platform: 'windows-x86_64',
        simulateError: 'platformUnsupported',
      },
      storage,
    );
    expect(result.variant).toBe('platformUnsupported');
    expect(result.platform).toBeDefined();
    expect(result.supportedPlatforms).toBeDefined();
    expect(Array.isArray(result.supportedPlatforms)).toBe(true);
  });

  // --- Validate after environment drift -> invalid ---

  it('should detect environment drift via validate', async () => {
    // Resolve the tool first
    await toolchainHandler.resolve(
      {
        tool: 'tsc',
        language: 'typescript',
        requiredVersion: '>=5.0.0',
      },
      storage,
    );

    // Simulate environment drift (tool moved, version changed, etc.)
    const driftResult = await toolchainHandler.validate(
      {
        tool: 'tsc',
        language: 'typescript',
        simulateDrift: true,
      },
      storage,
    );
    expect(driftResult.variant).toBe('invalid');
    expect(driftResult.reason).toBeDefined();
    expect(typeof driftResult.reason).toBe('string');
  });

  // --- Re-resolve after invalidation succeeds ---

  it('should re-resolve successfully after invalidation', async () => {
    // Initial resolve
    const firstResolve = await toolchainHandler.resolve(
      {
        tool: 'rustc',
        language: 'rust',
        requiredVersion: '>=1.70.0',
      },
      storage,
    );
    expect(firstResolve.variant).toBe('ok');

    // Simulate drift — tool becomes invalid
    const invalidResult = await toolchainHandler.validate(
      {
        tool: 'rustc',
        language: 'rust',
        simulateDrift: true,
      },
      storage,
    );
    expect(invalidResult.variant).toBe('invalid');

    // Re-resolve after invalidation
    const secondResolve = await toolchainHandler.resolve(
      {
        tool: 'rustc',
        language: 'rust',
        requiredVersion: '>=1.70.0',
      },
      storage,
    );
    expect(secondResolve.variant).toBe('ok');
    expect(secondResolve.tool).toBe('rustc');
    expect(secondResolve.version).toBeDefined();

    // Validate should pass again after re-resolve
    const revalidate = await toolchainHandler.validate(
      {
        tool: 'rustc',
        language: 'rust',
      },
      storage,
    );
    expect(revalidate.variant).toBe('ok');
  });

  // --- Multiple languages resolve independently ---

  it('should resolve multiple languages independently', async () => {
    const tsResult = await toolchainHandler.resolve(
      { tool: 'tsc', language: 'typescript', requiredVersion: '>=5.0.0' },
      storage,
    );
    const rustResult = await toolchainHandler.resolve(
      { tool: 'rustc', language: 'rust', requiredVersion: '>=1.70.0' },
      storage,
    );
    const swiftResult = await toolchainHandler.resolve(
      { tool: 'swiftc', language: 'swift', requiredVersion: '>=5.9.0' },
      storage,
    );
    const solResult = await toolchainHandler.resolve(
      { tool: 'solc', language: 'solidity', requiredVersion: '>=0.8.0' },
      storage,
    );

    expect(tsResult.variant).toBe('ok');
    expect(rustResult.variant).toBe('ok');
    expect(swiftResult.variant).toBe('ok');
    expect(solResult.variant).toBe('ok');

    // Each should have distinct paths
    const paths = [
      tsResult.path as string,
      rustResult.path as string,
      swiftResult.path as string,
      solResult.path as string,
    ];
    const uniquePaths = new Set(paths);
    expect(uniquePaths.size).toBe(4);

    // List should return all four
    const listResult = await toolchainHandler.list({}, storage);
    expect(listResult.variant).toBe('ok');
    const toolchains = listResult.toolchains as any[];
    expect(toolchains).toHaveLength(4);

    // Validate each independently
    for (const { tool, language } of [
      { tool: 'tsc', language: 'typescript' },
      { tool: 'rustc', language: 'rust' },
      { tool: 'swiftc', language: 'swift' },
      { tool: 'solc', language: 'solidity' },
    ]) {
      const validateResult = await toolchainHandler.validate(
        { tool, language },
        storage,
      );
      expect(validateResult.variant).toBe('ok');
    }
  });

  // --- Validate for a never-resolved tool -> invalid ---

  it('should return invalid when validating a tool never resolved', async () => {
    const result = await toolchainHandler.validate(
      {
        tool: 'never-resolved-tool',
        language: 'fantasy',
      },
      storage,
    );
    expect(result.variant).toBe('invalid');
  });

  // --- Resolution caching: resolve once, reuse many times ---

  it('should reuse cached resolution across multiple validate calls', async () => {
    // Resolve once
    const resolveResult = await toolchainHandler.resolve(
      { tool: 'tsc', language: 'typescript', requiredVersion: '>=5.0.0' },
      storage,
    );
    expect(resolveResult.variant).toBe('ok');
    const resolvedVersion = resolveResult.version as string;

    // Validate multiple times — all should return same version
    for (let i = 0; i < 3; i++) {
      const validateResult = await toolchainHandler.validate(
        { tool: 'tsc', language: 'typescript' },
        storage,
      );
      expect(validateResult.variant).toBe('ok');
      expect(validateResult.version).toBe(resolvedVersion);
    }
  });
});
