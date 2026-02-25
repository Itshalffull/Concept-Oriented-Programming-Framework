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
        concept: 'Password',
        source: './generated/swift/password',
        language: 'swift',
        platform: 'linux-arm64',
        config: { mode: 'release' },
      },
      storage,
    );
    expect(coordinatorResult.variant).toBe('ok');

    // Verify SwiftBuilder produces same-shaped output
    const providerResult = await swiftBuilderHandler.build(
      {
        source: './src/Password.swift',
        toolchainPath: '/usr/bin/swiftc',
        platform: 'linux-arm64',
        config: { mode: 'debug', features: [] },
      },
      storage,
    );
    expect(providerResult.variant).toBe('ok');
    expect(providerResult.artifactPath).toBeDefined();
    expect(providerResult.artifactHash).toBeDefined();
  });

  it('should route typescript build to TypeScriptBuilder', async () => {
    const coordinatorResult = await builderHandler.build(
      {
        concept: 'Password',
        source: './generated/typescript/password',
        language: 'typescript',
        platform: 'node',
        config: { mode: 'release' },
      },
      storage,
    );
    expect(coordinatorResult.variant).toBe('ok');

    // Verify TypeScriptBuilder produces same-shaped output
    const providerResult = await typescriptBuilderHandler.build(
      {
        source: './src/password.ts',
        toolchainPath: '/usr/local/bin/tsc',
        platform: 'node',
        config: { mode: 'release', features: [] },
      },
      storage,
    );
    expect(providerResult.variant).toBe('ok');
    expect(providerResult.artifactPath).toBeDefined();
    expect(providerResult.artifactHash).toBeDefined();
  });

  it('should route rust build to RustBuilder', async () => {
    const coordinatorResult = await builderHandler.build(
      {
        concept: 'Password',
        source: './generated/rust/password',
        language: 'rust',
        platform: 'x86_64-linux',
        config: { mode: 'release' },
      },
      storage,
    );
    expect(coordinatorResult.variant).toBe('ok');

    // Verify RustBuilder produces same-shaped output
    const providerResult = await rustBuilderHandler.build(
      {
        source: './src/password.rs',
        toolchainPath: '/usr/local/bin/rustc',
        platform: 'x86_64-linux',
        config: { mode: 'debug', features: [] },
      },
      storage,
    );
    expect(providerResult.variant).toBe('ok');
    expect(providerResult.artifactPath).toBeDefined();
    expect(providerResult.artifactHash).toBeDefined();
  });

  it('should route solidity build to SolidityBuilder', async () => {
    const coordinatorResult = await builderHandler.build(
      {
        concept: 'Token',
        source: './generated/solidity/token',
        language: 'solidity',
        platform: 'shanghai',
        config: { mode: 'release' },
      },
      storage,
    );
    expect(coordinatorResult.variant).toBe('ok');

    // Verify SolidityBuilder produces same-shaped output
    const providerResult = await solidityBuilderHandler.build(
      {
        source: './contracts/Token.sol',
        toolchainPath: '/usr/local/bin/solc',
        platform: 'shanghai',
        config: { mode: 'release', features: [] },
      },
      storage,
    );
    expect(providerResult.variant).toBe('ok');
    expect(providerResult.artifactPath).toBeDefined();
    expect(providerResult.artifactHash).toBeDefined();
  });

  // --- Language-appropriate artifact formats ---

  it('should produce language-appropriate artifact format for each provider', async () => {
    const swiftResult = await swiftBuilderHandler.build(
      {
        source: './src/Main.swift',
        toolchainPath: '/usr/bin/swiftc',
        platform: 'linux-arm64',
        config: { mode: 'debug', features: [] },
      },
      storage,
    );
    expect(swiftResult.variant).toBe('ok');
    expect((swiftResult.artifactPath as string)).toMatch(/\.swift|\.build|build\/swift/);

    const tsResult = await typescriptBuilderHandler.build(
      {
        source: './src/index.ts',
        toolchainPath: '/usr/local/bin/tsc',
        platform: 'node',
        config: { mode: 'release', features: [] },
      },
      storage,
    );
    expect(tsResult.variant).toBe('ok');
    expect((tsResult.artifactPath as string)).toMatch(/\.js|dist|build\/typescript/);

    const rustResult = await rustBuilderHandler.build(
      {
        source: './src/lib.rs',
        toolchainPath: '/usr/local/bin/rustc',
        platform: 'x86_64-linux',
        config: { mode: 'debug', features: [] },
      },
      storage,
    );
    expect(rustResult.variant).toBe('ok');
    expect((rustResult.artifactPath as string)).toMatch(/target|build\/rust/);

    const solResult = await solidityBuilderHandler.build(
      {
        source: './contracts/Token.sol',
        toolchainPath: '/usr/local/bin/solc',
        platform: 'shanghai',
        config: { mode: 'release', features: [] },
      },
      storage,
    );
    expect(solResult.variant).toBe('ok');
    expect((solResult.artifactPath as string)).toMatch(/\.json|artifacts|build\/solidity/);
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
        concept: 'Password',
        source: './generated/cobol/password',
        language: '',
        platform: '',
      },
      storage,
    );
    expect(result.variant).toBe('toolchainError');
    expect(result.reason).toBeDefined();
    expect(typeof result.reason).toBe('string');
  });

  // --- Cross-language build coordination ---

  it('should build same concept across all four languages independently', async () => {
    const languages = [
      { language: 'swift', platform: 'linux-arm64' },
      { language: 'typescript', platform: 'node' },
      { language: 'rust', platform: 'x86_64-linux' },
      { language: 'solidity', platform: 'shanghai' },
    ];
    const results: Record<string, any> = {};

    for (const { language, platform } of languages) {
      const result = await builderHandler.build(
        {
          concept: 'Password',
          source: `./generated/${language}/password`,
          language,
          platform,
          config: { mode: 'release' },
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      results[language] = result;
    }

    // All artifact hashes should be distinct
    const hashes = Object.values(results).map((r: any) => r.artifactHash);
    const uniqueHashes = new Set(hashes);
    expect(uniqueHashes.size).toBe(4);

    // History should show all four builds
    const historyResult = await builderHandler.history(
      { concept: 'Password' },
      storage,
    );
    expect(historyResult.variant).toBe('ok');
    const builds = historyResult.builds as any[];
    expect(builds).toHaveLength(4);
  });

  it('should filter build history by language after multi-language build', async () => {
    // Build Password for typescript and rust
    await builderHandler.build(
      {
        concept: 'Password',
        source: './generated/typescript/password',
        language: 'typescript',
        platform: 'node',
        config: { mode: 'release' },
      },
      storage,
    );
    await builderHandler.build(
      {
        concept: 'Password',
        source: './generated/rust/password',
        language: 'rust',
        platform: 'x86_64-linux',
        config: { mode: 'release' },
      },
      storage,
    );

    // Filter by typescript
    const tsHistory = await builderHandler.history(
      { concept: 'Password', language: 'typescript' },
      storage,
    );
    expect(tsHistory.variant).toBe('ok');
    const tsBuilds = tsHistory.builds as any[];
    expect(tsBuilds).toHaveLength(1);
    expect(tsBuilds[0].language).toBe('typescript');

    // Filter by rust
    const rustHistory = await builderHandler.history(
      { concept: 'Password', language: 'rust' },
      storage,
    );
    expect(rustHistory.variant).toBe('ok');
    const rustBuilds = rustHistory.builds as any[];
    expect(rustBuilds).toHaveLength(1);
    expect(rustBuilds[0].language).toBe('rust');
  });
});
