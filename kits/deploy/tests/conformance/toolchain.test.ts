// ============================================================
// Toolchain Conformance Tests
//
// Validates toolchain resolution, validation, listing, and
// capability discovery: resolve installed/missing/mismatched
// tools, validate consistency, list with language filtering,
// and query detailed capabilities.
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@copf/kernel';
import { toolchainHandler } from '../../../../implementations/typescript/deploy/toolchain.impl.js';
import type { ConceptStorage } from '@copf/kernel';

describe('Toolchain conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- resolve: ok ---

  it('should return tool, version, path, and capabilities on resolve ok', async () => {
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
  });

  it('should resolve different tools independently', async () => {
    const tscResult = await toolchainHandler.resolve(
      {
        tool: 'tsc',
        language: 'typescript',
        requiredVersion: '>=5.0.0',
      },
      storage,
    );

    const rustcResult = await toolchainHandler.resolve(
      {
        tool: 'rustc',
        language: 'rust',
        requiredVersion: '>=1.70.0',
      },
      storage,
    );

    expect(tscResult.variant).toBe('ok');
    expect(rustcResult.variant).toBe('ok');
    expect(tscResult.tool).toBe('tsc');
    expect(rustcResult.tool).toBe('rustc');
    expect(tscResult.path).not.toBe(rustcResult.path);
  });

  // --- resolve: notInstalled ---

  it('should return notInstalled with installHint for missing tool', async () => {
    const result = await toolchainHandler.resolve(
      {
        tool: 'nonexistent-compiler',
        language: 'unknown',
        requiredVersion: '>=1.0.0',
      },
      storage,
    );
    expect(result.variant).toBe('notInstalled');
    expect(result.installHint).toBeDefined();
    expect(typeof result.installHint).toBe('string');
    expect(result.installHint.length).toBeGreaterThan(0);
  });

  // --- resolve: versionMismatch ---

  it('should return versionMismatch with installed and required versions', async () => {
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
    expect(typeof result.installed).toBe('string');
    expect(result.required).toBeDefined();
    expect(typeof result.required).toBe('string');
    expect(result.installed).not.toBe(result.required);
  });

  // --- resolve: platformUnsupported ---

  it('should return platformUnsupported for incompatible targets', async () => {
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

  // --- validate: ok ---

  it('should validate ok for a previously resolved tool', async () => {
    // First resolve the tool
    const resolveResult = await toolchainHandler.resolve(
      {
        tool: 'tsc',
        language: 'typescript',
        requiredVersion: '>=5.0.0',
      },
      storage,
    );
    expect(resolveResult.variant).toBe('ok');

    // Then validate it
    const validateResult = await toolchainHandler.validate(
      {
        tool: 'tsc',
        language: 'typescript',
      },
      storage,
    );
    expect(validateResult.variant).toBe('ok');
    expect(validateResult.tool).toBe('tsc');
    expect(validateResult.version).toBeDefined();
  });

  // --- validate: invalid ---

  it('should return invalid when tool has drifted', async () => {
    // Resolve first
    await toolchainHandler.resolve(
      {
        tool: 'tsc',
        language: 'typescript',
        requiredVersion: '>=5.0.0',
      },
      storage,
    );

    // Validate with drift simulation
    const result = await toolchainHandler.validate(
      {
        tool: 'tsc',
        language: 'typescript',
        simulateDrift: true,
      },
      storage,
    );
    expect(result.variant).toBe('invalid');
    expect(result.reason).toBeDefined();
    expect(typeof result.reason).toBe('string');
  });

  it('should return invalid for a tool never resolved', async () => {
    const result = await toolchainHandler.validate(
      {
        tool: 'never-resolved',
        language: 'unknown',
      },
      storage,
    );
    expect(result.variant).toBe('invalid');
  });

  // --- list: ok ---

  it('should return all resolved toolchains', async () => {
    await toolchainHandler.resolve(
      {
        tool: 'tsc',
        language: 'typescript',
        requiredVersion: '>=5.0.0',
      },
      storage,
    );
    await toolchainHandler.resolve(
      {
        tool: 'rustc',
        language: 'rust',
        requiredVersion: '>=1.70.0',
      },
      storage,
    );

    const result = await toolchainHandler.list({}, storage);
    expect(result.variant).toBe('ok');
    const toolchains = result.toolchains as any[];
    expect(toolchains).toHaveLength(2);

    const tools = toolchains.map((t: any) => t.tool).sort();
    expect(tools).toEqual(['rustc', 'tsc']);
  });

  // --- list: filtered by language ---

  it('should filter list by language', async () => {
    await toolchainHandler.resolve(
      {
        tool: 'tsc',
        language: 'typescript',
        requiredVersion: '>=5.0.0',
      },
      storage,
    );
    await toolchainHandler.resolve(
      {
        tool: 'rustc',
        language: 'rust',
        requiredVersion: '>=1.70.0',
      },
      storage,
    );
    await toolchainHandler.resolve(
      {
        tool: 'esbuild',
        language: 'typescript',
        requiredVersion: '>=0.18.0',
      },
      storage,
    );

    const result = await toolchainHandler.list(
      { language: 'typescript' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const toolchains = result.toolchains as any[];
    expect(toolchains).toHaveLength(2);
    for (const tc of toolchains) {
      expect(tc.language).toBe('typescript');
    }
  });

  it('should return empty list when no toolchains match language filter', async () => {
    await toolchainHandler.resolve(
      {
        tool: 'tsc',
        language: 'typescript',
        requiredVersion: '>=5.0.0',
      },
      storage,
    );

    const result = await toolchainHandler.list(
      { language: 'go' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const toolchains = result.toolchains as any[];
    expect(toolchains).toHaveLength(0);
  });

  // --- capabilities ---

  it('should return detailed capability list for a resolved tool', async () => {
    await toolchainHandler.resolve(
      {
        tool: 'tsc',
        language: 'typescript',
        requiredVersion: '>=5.0.0',
      },
      storage,
    );

    const result = await toolchainHandler.capabilities(
      { tool: 'tsc', language: 'typescript' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.capabilities).toBeDefined();
    const caps = result.capabilities as any[];
    expect(caps.length).toBeGreaterThan(0);
    for (const cap of caps) {
      expect(cap.name).toBeDefined();
      expect(typeof cap.name).toBe('string');
    }
  });

  it('should return empty capabilities for unresolved tool', async () => {
    const result = await toolchainHandler.capabilities(
      { tool: 'unknown-tool', language: 'unknown' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const caps = result.capabilities as any[];
    expect(caps).toHaveLength(0);
  });

  // --- invariant: after resolve -> ok, validate -> ok with same version ---

  it('should validate ok with same version after successful resolve', async () => {
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
    expect(validateResult.version).toBe(resolvedVersion);
  });

  // --- invariant: after resolve -> ok, list returns the tool ---

  it('should include tool in list after successful resolve', async () => {
    await toolchainHandler.resolve(
      {
        tool: 'esbuild',
        language: 'typescript',
        requiredVersion: '>=0.18.0',
      },
      storage,
    );

    const listResult = await toolchainHandler.list({}, storage);
    expect(listResult.variant).toBe('ok');
    const toolchains = listResult.toolchains as any[];
    expect(toolchains.length).toBeGreaterThanOrEqual(1);

    const esbuild = toolchains.find((t: any) => t.tool === 'esbuild');
    expect(esbuild).toBeDefined();
    expect(esbuild.language).toBe('typescript');
    expect(esbuild.version).toBeDefined();
    expect(esbuild.path).toBeDefined();
  });
});
