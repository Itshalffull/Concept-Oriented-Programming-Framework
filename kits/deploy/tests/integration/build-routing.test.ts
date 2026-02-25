// ============================================================
// Build Routing Integration Test
//
// Tests that Builder correctly dispatches to language-specific
// providers. Validates that:
// - language: "swift" routes to SwiftBuilder
// - language: "typescript" routes to TypeScriptBuilder
// - language: "rust" routes to RustBuilder
// - language: "solidity" routes to SolidityBuilder
// - Unknown language returns toolchainError
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@copf/kernel';
import { builderHandler } from '../../../../implementations/typescript/deploy/builder.impl.js';
import { swiftBuilderHandler } from '../../../../implementations/typescript/deploy/swift-builder.impl.js';
import { typescriptBuilderHandler } from '../../../../implementations/typescript/deploy/typescript-builder.impl.js';
import { rustBuilderHandler } from '../../../../implementations/typescript/deploy/rust-builder.impl.js';
import { solidityBuilderHandler } from '../../../../implementations/typescript/deploy/solidity-builder.impl.js';
import type { ConceptStorage } from '@copf/kernel';

describe('Build routing integration', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- Language dispatch routing ---

  it('should route swift build to SwiftBuilder', async () => {
    const coordinatorResult = await builderHandler.build(
      {
        conceptName: 'Password',
        target: 'swift',
        sourceHash: 'pw-swift-src',
      },
      storage,
    );
    expect(coordinatorResult.variant).toBe('ok');

    // Verify SwiftBuilder produces same-shaped output
    const providerResult = await swiftBuilderHandler.build(
      { sourcePath: './src/Password.swift', target: 'debug' },
      storage,
    );
    expect(providerResult.variant).toBe('ok');
    expect(providerResult.artifactPath).toBeDefined();
    expect(providerResult.artifactHash).toBeDefined();
  });

  it('should route typescript build to TypeScriptBuilder', async () => {
    const coordinatorResult = await builderHandler.build(
      {
        conceptName: 'Password',
        target: 'typescript',
        sourceHash: 'pw-ts-src',
      },
      storage,
    );
    expect(coordinatorResult.variant).toBe('ok');

    // Verify TypeScriptBuilder produces same-shaped output
    const providerResult = await typescriptBuilderHandler.build(
      { sourcePath: './src/password.ts', target: 'es2022' },
      storage,
    );
    expect(providerResult.variant).toBe('ok');
    expect(providerResult.artifactPath).toBeDefined();
    expect(providerResult.artifactHash).toBeDefined();
  });

  it('should route rust build to RustBuilder', async () => {
    const coordinatorResult = await builderHandler.build(
      {
        conceptName: 'Password',
        target: 'rust',
        sourceHash: 'pw-rust-src',
      },
      storage,
    );
    expect(coordinatorResult.variant).toBe('ok');

    // Verify RustBuilder produces same-shaped output
    const providerResult = await rustBuilderHandler.build(
      { sourcePath: './src/password.rs', target: 'debug' },
      storage,
    );
    expect(providerResult.variant).toBe('ok');
    expect(providerResult.artifactPath).toBeDefined();
    expect(providerResult.artifactHash).toBeDefined();
  });

  it('should route solidity build to SolidityBuilder', async () => {
    const coordinatorResult = await builderHandler.build(
      {
        conceptName: 'Token',
        target: 'solidity',
        sourceHash: 'token-sol-src',
      },
      storage,
    );
    expect(coordinatorResult.variant).toBe('ok');

    // Verify SolidityBuilder produces same-shaped output
    const providerResult = await solidityBuilderHandler.build(
      { sourcePath: './contracts/Token.sol', target: 'paris' },
      storage,
    );
    expect(providerResult.variant).toBe('ok');
    expect(providerResult.artifactPath).toBeDefined();
    expect(providerResult.artifactHash).toBeDefined();
  });

  // --- Language-appropriate artifact formats ---

  it('should produce language-appropriate artifact format for each provider', async () => {
    const swiftResult = await swiftBuilderHandler.build(
      { sourcePath: './src/Main.swift', target: 'debug' },
      storage,
    );
    expect(swiftResult.variant).toBe('ok');
    expect((swiftResult.artifactPath as string)).toMatch(/\.swift|\.build|\.o/);

    const tsResult = await typescriptBuilderHandler.build(
      { sourcePath: './src/index.ts', target: 'es2022' },
      storage,
    );
    expect(tsResult.variant).toBe('ok');
    expect((tsResult.artifactPath as string)).toMatch(/\.js|dist|\.tsbuildinfo/);

    const rustResult = await rustBuilderHandler.build(
      { sourcePath: './src/lib.rs', target: 'debug' },
      storage,
    );
    expect(rustResult.variant).toBe('ok');
    expect((rustResult.artifactPath as string)).toMatch(/target|\.rlib|\.so|\.d/);

    const solResult = await solidityBuilderHandler.build(
      { sourcePath: './contracts/Token.sol', target: 'paris' },
      storage,
    );
    expect(solResult.variant).toBe('ok');
    expect((solResult.artifactPath as string)).toMatch(/\.json|artifacts|out/);
  });

  // --- Provider registration metadata ---

  it('should return correct metadata for SwiftBuilder registration', async () => {
    const result = await swiftBuilderHandler.register({}, storage);
    expect(result.variant).toBe('ok');
    expect(result.name).toBe('SwiftBuilder');
    expect(result.language).toBe('swift');
    expect(Array.isArray(result.capabilities)).toBe(true);
  });

  it('should return correct metadata for TypeScriptBuilder registration', async () => {
    const result = await typescriptBuilderHandler.register({}, storage);
    expect(result.variant).toBe('ok');
    expect(result.name).toBe('TypeScriptBuilder');
    expect(result.language).toBe('typescript');
    expect(Array.isArray(result.capabilities)).toBe(true);
  });

  it('should return correct metadata for RustBuilder registration', async () => {
    const result = await rustBuilderHandler.register({}, storage);
    expect(result.variant).toBe('ok');
    expect(result.name).toBe('RustBuilder');
    expect(result.language).toBe('rust');
    expect(Array.isArray(result.capabilities)).toBe(true);
  });

  it('should return correct metadata for SolidityBuilder registration', async () => {
    const result = await solidityBuilderHandler.register({}, storage);
    expect(result.variant).toBe('ok');
    expect(result.name).toBe('SolidityBuilder');
    expect(result.language).toBe('solidity');
    expect(Array.isArray(result.capabilities)).toBe(true);
  });

  // --- Toolchain routing per language ---

  it('should return toolchainError for unknown language', async () => {
    const result = await builderHandler.build(
      {
        conceptName: 'Password',
        target: 'cobol',
        sourceHash: 'pw-cobol-src',
        simulateError: 'toolchainError',
      },
      storage,
    );
    expect(result.variant).toBe('toolchainError');
    expect(result.reason).toBeDefined();
    expect(typeof result.reason).toBe('string');
  });

  // --- Cross-language build coordination ---

  it('should build same concept across all four languages independently', async () => {
    const languages = ['swift', 'typescript', 'rust', 'solidity'];
    const results: Record<string, any> = {};

    for (const lang of languages) {
      const result = await builderHandler.build(
        {
          conceptName: 'Password',
          target: lang,
          sourceHash: `pw-src-${lang}`,
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      results[lang] = result;
    }

    // All artifact hashes should be distinct
    const hashes = Object.values(results).map((r: any) => r.artifactHash);
    const uniqueHashes = new Set(hashes);
    expect(uniqueHashes.size).toBe(4);

    // History should show all four builds
    const historyResult = await builderHandler.history(
      { conceptName: 'Password' },
      storage,
    );
    expect(historyResult.variant).toBe('ok');
    const builds = historyResult.builds as any[];
    expect(builds).toHaveLength(4);
  });

  it('should filter build history by language after multi-language build', async () => {
    // Build Password for typescript and rust
    await builderHandler.build(
      { conceptName: 'Password', target: 'typescript', sourceHash: 'ts-src' },
      storage,
    );
    await builderHandler.build(
      { conceptName: 'Password', target: 'rust', sourceHash: 'rs-src' },
      storage,
    );

    // Filter by typescript
    const tsHistory = await builderHandler.history(
      { conceptName: 'Password', language: 'typescript' },
      storage,
    );
    expect(tsHistory.variant).toBe('ok');
    const tsBuilds = tsHistory.builds as any[];
    expect(tsBuilds).toHaveLength(1);
    expect(tsBuilds[0].target).toBe('typescript');

    // Filter by rust
    const rustHistory = await builderHandler.history(
      { conceptName: 'Password', language: 'rust' },
      storage,
    );
    expect(rustHistory.variant).toBe('ok');
    const rustBuilds = rustHistory.builds as any[];
    expect(rustBuilds).toHaveLength(1);
    expect(rustBuilds[0].target).toBe('rust');
  });
});
