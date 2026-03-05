// ============================================================
// Toolchain Resolution Integration Test
//
// Tests toolchain resolution behavior:
// - Resolve, validate, list lifecycle
// - Category-based resolution with invocation profiles
// - toolName selection for multi-tool categories
// - Resolution caching (resolve once, use many times)
// - Cross-language independent resolution
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/runtime';
import { toolchainHandler } from '../../../../handlers/ts/deploy/toolchain.handler.js';
import type { ConceptStorage } from '@clef/runtime';

describe('Toolchain resolution integration', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- Resolve returns tool with version, capabilities, and invocation ---

  it('should resolve and return tool with version, capabilities, and invocation', async () => {
    const result = await toolchainHandler.resolve(
      { language: 'typescript', platform: 'node' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.tool).toBeDefined();
    expect(result.version).toBeDefined();
    expect(typeof result.version).toBe('string');
    expect(result.path).toBeDefined();
    expect(typeof result.path).toBe('string');
    expect(result.capabilities).toBeDefined();
    expect(Array.isArray(result.capabilities)).toBe(true);
    expect((result.capabilities as string[]).length).toBeGreaterThan(0);
    const invocation = result.invocation as any;
    expect(invocation).toBeDefined();
    expect(invocation.command).toBeDefined();
    expect(invocation.outputFormat).toBeDefined();
  });

  // --- Resolved tool passes validation ---

  it('should pass validation for a previously resolved tool', async () => {
    const resolveResult = await toolchainHandler.resolve(
      { language: 'rust', platform: 'x86_64-linux' },
      storage,
    );
    expect(resolveResult.variant).toBe('ok');
    const resolvedVersion = resolveResult.version as string;
    const toolId = resolveResult.tool as string;

    const validateResult = await toolchainHandler.validate(
      { tool: toolId },
      storage,
    );
    expect(validateResult.variant).toBe('ok');
    expect(validateResult.version).toBe(resolvedVersion);
  });

  // --- List returns all resolved toolchains ---

  it('should list all resolved toolchains', async () => {
    await toolchainHandler.resolve(
      { language: 'typescript', platform: 'node' },
      storage,
    );
    await toolchainHandler.resolve(
      { language: 'rust', platform: 'x86_64-linux' },
      storage,
    );
    await toolchainHandler.resolve(
      { language: 'swift', platform: 'macos' },
      storage,
    );

    const listResult = await toolchainHandler.list({}, storage);
    expect(listResult.variant).toBe('ok');
    const tools = listResult.tools as any[];
    expect(tools).toHaveLength(3);

    const languages = tools.map((t: any) => t.language).sort();
    expect(languages).toEqual(['rust', 'swift', 'typescript']);
  });

  // --- List filtered by language returns subset ---

  it('should filter list by language and return only matching toolchains', async () => {
    await toolchainHandler.resolve(
      { language: 'typescript', platform: 'node' },
      storage,
    );
    await toolchainHandler.resolve(
      { language: 'typescript', platform: 'node', category: 'unit-runner' },
      storage,
    );
    await toolchainHandler.resolve(
      { language: 'rust', platform: 'x86_64-linux' },
      storage,
    );
    await toolchainHandler.resolve(
      { language: 'solidity', platform: 'shanghai' },
      storage,
    );

    const tsResult = await toolchainHandler.list(
      { language: 'typescript' },
      storage,
    );
    expect(tsResult.variant).toBe('ok');
    const tsTools = tsResult.tools as any[];
    expect(tsTools).toHaveLength(2);
    for (const tc of tsTools) {
      expect(tc.language).toBe('typescript');
    }

    const rustResult = await toolchainHandler.list(
      { language: 'rust' },
      storage,
    );
    expect(rustResult.variant).toBe('ok');
    const rustTools = rustResult.tools as any[];
    expect(rustTools).toHaveLength(1);
    expect(rustTools[0].language).toBe('rust');
  });

  // --- Version constraint too high -> notInstalled ---

  it('should return notInstalled when version constraint does not match', async () => {
    const result = await toolchainHandler.resolve(
      {
        language: 'typescript',
        platform: 'node',
        versionConstraint: '99.0.0',
      },
      storage,
    );
    expect(result.variant).toBe('notInstalled');
    expect(result.installHint).toBeDefined();
    expect(typeof result.installHint).toBe('string');
  });

  // --- Unsupported language -> platformUnsupported ---

  it('should return platformUnsupported for unknown language', async () => {
    const result = await toolchainHandler.resolve(
      { language: 'haskell', platform: 'linux' },
      storage,
    );
    expect(result.variant).toBe('platformUnsupported');
  });

  // --- Validate for a never-resolved tool -> invalid ---

  it('should return invalid when validating a tool never resolved', async () => {
    const result = await toolchainHandler.validate(
      { tool: 'never-resolved-tool' },
      storage,
    );
    expect(result.variant).toBe('invalid');
  });

  // --- Resolution caching: resolve once, reuse many times ---

  it('should reuse cached resolution across multiple validate calls', async () => {
    const resolveResult = await toolchainHandler.resolve(
      { language: 'typescript', platform: 'node' },
      storage,
    );
    expect(resolveResult.variant).toBe('ok');
    const toolId = resolveResult.tool as string;
    const resolvedVersion = resolveResult.version as string;

    // Validate multiple times — all should return same version
    for (let i = 0; i < 3; i++) {
      const validateResult = await toolchainHandler.validate(
        { tool: toolId },
        storage,
      );
      expect(validateResult.variant).toBe('ok');
      expect(validateResult.version).toBe(resolvedVersion);
    }
  });

  // --- Multiple languages resolve independently ---

  it('should resolve multiple languages independently', async () => {
    const tsResult = await toolchainHandler.resolve(
      { language: 'typescript', platform: 'node' },
      storage,
    );
    const rustResult = await toolchainHandler.resolve(
      { language: 'rust', platform: 'x86_64-linux' },
      storage,
    );
    const swiftResult = await toolchainHandler.resolve(
      { language: 'swift', platform: 'macos' },
      storage,
    );
    const solResult = await toolchainHandler.resolve(
      { language: 'solidity', platform: 'shanghai' },
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
    const tools = listResult.tools as any[];
    expect(tools).toHaveLength(4);
  });

  // --- Category-based resolution with invocation profiles ---

  it('should resolve different categories with different invocation profiles', async () => {
    const compiler = await toolchainHandler.resolve(
      { language: 'typescript', platform: 'node', category: 'compiler' },
      storage,
    );
    const unitRunner = await toolchainHandler.resolve(
      { language: 'typescript', platform: 'node', category: 'unit-runner' },
      storage,
    );
    const e2eRunner = await toolchainHandler.resolve(
      { language: 'typescript', platform: 'node', category: 'e2e-runner' },
      storage,
    );

    expect(compiler.variant).toBe('ok');
    expect(unitRunner.variant).toBe('ok');
    expect(e2eRunner.variant).toBe('ok');

    // Each category should have a different invocation command
    const compilerCmd = (compiler.invocation as any).command;
    const unitCmd = (unitRunner.invocation as any).command;
    const e2eCmd = (e2eRunner.invocation as any).command;

    expect(compilerCmd).toContain('tsc');
    expect(unitCmd).toContain('vitest');
    expect(e2eCmd).toContain('playwright');
  });

  // --- toolName selection across languages ---

  it('should select specific tools by name across different languages', async () => {
    // TypeScript: jest instead of vitest
    const tsJest = await toolchainHandler.resolve(
      { language: 'typescript', platform: 'node', category: 'unit-runner', toolName: 'jest' },
      storage,
    );
    expect(tsJest.variant).toBe('ok');
    expect((tsJest.invocation as any).command).toContain('jest');

    // Solidity: hardhat instead of foundry
    const solHardhat = await toolchainHandler.resolve(
      { language: 'solidity', platform: 'shanghai', category: 'unit-runner', toolName: 'hardhat' },
      storage,
    );
    expect(solHardhat.variant).toBe('ok');
    expect((solHardhat.invocation as any).command).toContain('hardhat');

    // Rust: nextest instead of cargo-test
    const rustNextest = await toolchainHandler.resolve(
      { language: 'rust', platform: 'x86_64-linux', category: 'unit-runner', toolName: 'nextest' },
      storage,
    );
    expect(rustNextest.variant).toBe('ok');
    expect((rustNextest.invocation as any).command).toContain('nextest');
  });

  // --- Unknown toolName returns notInstalled with alternatives ---

  it('should list available alternatives when requested toolName is unknown', async () => {
    const result = await toolchainHandler.resolve(
      { language: 'typescript', platform: 'node', category: 'e2e-runner', toolName: 'selenium' },
      storage,
    );
    expect(result.variant).toBe('notInstalled');
    const hint = result.installHint as string;
    expect(hint).toContain('selenium');
    expect(hint).toContain('playwright');
    expect(hint).toContain('cypress');
  });
});
