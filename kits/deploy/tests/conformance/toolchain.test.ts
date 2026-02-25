// ============================================================
// Toolchain Conformance Tests
//
// Validates toolchain resolution, validation, listing, and
// capability discovery: resolve installed/missing/mismatched
// tools, validate consistency, list with language filtering,
// query detailed capabilities, and select tools by name.
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

  it('should return tool, version, path, capabilities, and invocation on resolve ok', async () => {
    const result = await toolchainHandler.resolve(
      {
        language: 'typescript',
        platform: 'node',
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.tool).toBeDefined();
    expect(typeof result.tool).toBe('string');
    expect(result.version).toBeDefined();
    expect(typeof result.version).toBe('string');
    expect(result.path).toBeDefined();
    expect(typeof result.path).toBe('string');
    expect(result.capabilities).toBeDefined();
    expect(Array.isArray(result.capabilities)).toBe(true);
    expect(result.invocation).toBeDefined();
    const invocation = result.invocation as any;
    expect(invocation.command).toBeDefined();
    expect(Array.isArray(invocation.args)).toBe(true);
    expect(invocation.outputFormat).toBeDefined();
  });

  it('should resolve different languages independently', async () => {
    const tsResult = await toolchainHandler.resolve(
      { language: 'typescript', platform: 'node' },
      storage,
    );

    const rustResult = await toolchainHandler.resolve(
      { language: 'rust', platform: 'x86_64-linux' },
      storage,
    );

    expect(tsResult.variant).toBe('ok');
    expect(rustResult.variant).toBe('ok');
    expect(tsResult.path).not.toBe(rustResult.path);
  });

  // --- resolve: with category ---

  it('should resolve unit-runner category with invocation profile', async () => {
    const result = await toolchainHandler.resolve(
      {
        language: 'typescript',
        platform: 'node',
        category: 'unit-runner',
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    const invocation = result.invocation as any;
    expect(invocation.command).toContain('vitest');
    expect(invocation.outputFormat).toBe('vitest-json');
  });

  it('should resolve e2e-runner category', async () => {
    const result = await toolchainHandler.resolve(
      {
        language: 'typescript',
        platform: 'node',
        category: 'e2e-runner',
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    const invocation = result.invocation as any;
    expect(invocation.command).toContain('playwright');
    expect(invocation.outputFormat).toBe('playwright-json');
  });

  // --- resolve: with toolName ---

  it('should select jest when toolName is specified for unit-runner', async () => {
    const result = await toolchainHandler.resolve(
      {
        language: 'typescript',
        platform: 'node',
        category: 'unit-runner',
        toolName: 'jest',
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    const invocation = result.invocation as any;
    expect(invocation.command).toContain('jest');
    expect(invocation.outputFormat).toBe('jest-json');
  });

  it('should select cypress when toolName is specified for e2e-runner', async () => {
    const result = await toolchainHandler.resolve(
      {
        language: 'typescript',
        platform: 'node',
        category: 'e2e-runner',
        toolName: 'cypress',
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    const invocation = result.invocation as any;
    expect(invocation.command).toContain('cypress');
    expect(invocation.outputFormat).toBe('cypress-json');
  });

  it('should select hardhat when toolName is specified for solidity compiler', async () => {
    const result = await toolchainHandler.resolve(
      {
        language: 'solidity',
        platform: 'shanghai',
        category: 'compiler',
        toolName: 'hardhat',
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    const invocation = result.invocation as any;
    expect(invocation.command).toContain('hardhat');
  });

  it('should select nextest when toolName is specified for rust unit-runner', async () => {
    const result = await toolchainHandler.resolve(
      {
        language: 'rust',
        platform: 'x86_64-linux',
        category: 'unit-runner',
        toolName: 'nextest',
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    const invocation = result.invocation as any;
    expect(invocation.command).toContain('nextest');
    expect(invocation.outputFormat).toBe('nextest-json');
  });

  // --- resolve: notInstalled for unknown toolName ---

  it('should return notInstalled with available alternatives for unknown toolName', async () => {
    const result = await toolchainHandler.resolve(
      {
        language: 'typescript',
        platform: 'node',
        category: 'unit-runner',
        toolName: 'mocha',
      },
      storage,
    );
    expect(result.variant).toBe('notInstalled');
    expect(result.installHint).toBeDefined();
    const hint = result.installHint as string;
    expect(hint).toContain('mocha');
    expect(hint).toContain('Available');
    expect(hint).toContain('vitest');
    expect(hint).toContain('jest');
  });

  // --- resolve: notInstalled for missing language ---

  it('should return platformUnsupported for unknown language', async () => {
    const result = await toolchainHandler.resolve(
      {
        language: 'cobol',
        platform: 'mainframe',
      },
      storage,
    );
    expect(result.variant).toBe('platformUnsupported');
  });

  // --- resolve: notInstalled for missing category ---

  it('should return notInstalled for unavailable category', async () => {
    const result = await toolchainHandler.resolve(
      {
        language: 'swift',
        platform: 'macos',
        category: 'benchmark-runner',
      },
      storage,
    );
    expect(result.variant).toBe('notInstalled');
    expect(result.installHint).toBeDefined();
  });

  // --- validate: ok ---

  it('should validate ok for a previously resolved tool', async () => {
    const resolveResult = await toolchainHandler.resolve(
      { language: 'typescript', platform: 'node' },
      storage,
    );
    expect(resolveResult.variant).toBe('ok');
    const toolId = resolveResult.tool as string;

    const validateResult = await toolchainHandler.validate(
      { tool: toolId },
      storage,
    );
    expect(validateResult.variant).toBe('ok');
    expect(validateResult.version).toBeDefined();
  });

  // --- validate: invalid ---

  it('should return invalid for a tool never resolved', async () => {
    const result = await toolchainHandler.validate(
      { tool: 'never-resolved' },
      storage,
    );
    expect(result.variant).toBe('invalid');
  });

  // --- list: ok ---

  it('should return all resolved toolchains', async () => {
    await toolchainHandler.resolve(
      { language: 'typescript', platform: 'node' },
      storage,
    );
    await toolchainHandler.resolve(
      { language: 'rust', platform: 'x86_64-linux' },
      storage,
    );

    const result = await toolchainHandler.list({}, storage);
    expect(result.variant).toBe('ok');
    const tools = result.tools as any[];
    expect(tools).toHaveLength(2);
    const languages = tools.map((t: any) => t.language).sort();
    expect(languages).toEqual(['rust', 'typescript']);
  });

  // --- list: filtered by language ---

  it('should filter list by language', async () => {
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

    const result = await toolchainHandler.list(
      { language: 'typescript' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const tools = result.tools as any[];
    expect(tools).toHaveLength(2);
    for (const t of tools) {
      expect(t.language).toBe('typescript');
    }
  });

  it('should return empty list when no toolchains match language filter', async () => {
    await toolchainHandler.resolve(
      { language: 'typescript', platform: 'node' },
      storage,
    );

    const result = await toolchainHandler.list(
      { language: 'go' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const tools = result.tools as any[];
    expect(tools).toHaveLength(0);
  });

  // --- list: includes toolName ---

  it('should include toolName in list results', async () => {
    await toolchainHandler.resolve(
      { language: 'typescript', platform: 'node', category: 'unit-runner', toolName: 'jest' },
      storage,
    );

    const result = await toolchainHandler.list({}, storage);
    expect(result.variant).toBe('ok');
    const tools = result.tools as any[];
    expect(tools).toHaveLength(1);
    expect(tools[0].toolName).toBe('jest');
  });

  // --- capabilities ---

  it('should return detailed capability list for a resolved tool', async () => {
    const resolveResult = await toolchainHandler.resolve(
      { language: 'typescript', platform: 'node' },
      storage,
    );
    expect(resolveResult.variant).toBe('ok');
    const toolId = resolveResult.tool as string;

    const result = await toolchainHandler.capabilities(
      { tool: toolId },
      storage,
    );
    expect(result.variant).toBe('ok');
    const caps = result.capabilities as string[];
    expect(caps.length).toBeGreaterThan(0);
  });

  it('should return invalid for capabilities of unresolved tool', async () => {
    const result = await toolchainHandler.capabilities(
      { tool: 'unknown-tool' },
      storage,
    );
    expect(result.variant).toBe('invalid');
  });

  // --- invariant: after resolve -> ok, validate -> ok with same version ---

  it('should validate ok with same version after successful resolve', async () => {
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

  // --- invariant: after resolve -> ok, list returns the tool ---

  it('should include tool in list after successful resolve', async () => {
    await toolchainHandler.resolve(
      { language: 'solidity', platform: 'shanghai' },
      storage,
    );

    const listResult = await toolchainHandler.list({}, storage);
    expect(listResult.variant).toBe('ok');
    const tools = listResult.tools as any[];
    expect(tools.length).toBeGreaterThanOrEqual(1);

    const solTool = tools.find((t: any) => t.language === 'solidity');
    expect(solTool).toBeDefined();
    expect(solTool.version).toBeDefined();
    expect(solTool.path).toBeDefined();
  });

  // --- Multi-tool: default vs named resolution ---

  it('should resolve default tool when no toolName specified', async () => {
    const defaultResult = await toolchainHandler.resolve(
      { language: 'solidity', platform: 'shanghai', category: 'unit-runner' },
      storage,
    );
    expect(defaultResult.variant).toBe('ok');
    const invocation = defaultResult.invocation as any;
    expect(invocation.command).toContain('forge');
  });

  it('should resolve hardhat when toolName specified for solidity unit-runner', async () => {
    const result = await toolchainHandler.resolve(
      { language: 'solidity', platform: 'shanghai', category: 'unit-runner', toolName: 'hardhat' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const invocation = result.invocation as any;
    expect(invocation.command).toContain('hardhat');
    expect(invocation.outputFormat).toBe('hardhat-test-json');
  });
});
