// ============================================================
// E2E Tests — Full Language Generation Pipeline
//
// End-to-end pipeline tests that verify the complete flow from
// raw .concept source text through parsing, schema generation,
// and multi-target code generation for all language targets.
// Tests use the kernel to wire concepts via syncs exactly as
// the real compiler pipeline operates.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createInMemoryStorage } from '../kernel/src/index.js';
import { createKernel } from '../implementations/typescript/framework/kernel-factory.js';
import { parseConceptFile } from '../implementations/typescript/framework/spec-parser.impl.js';
import { parseSyncFile } from '../implementations/typescript/framework/sync-parser.impl.js';
import { specParserHandler } from '../implementations/typescript/framework/spec-parser.impl.js';
import { schemaGenHandler } from '../implementations/typescript/framework/schema-gen.impl.js';
import { typescriptGenHandler } from '../implementations/typescript/framework/typescript-gen.impl.js';
import { rustGenHandler } from '../implementations/typescript/framework/rust-gen.impl.js';
import { solidityGenHandler } from '../implementations/typescript/framework/solidity-gen.impl.js';
import { swiftGenHandler } from '../implementations/typescript/framework/swift-gen.impl.js';
import { syncParserHandler } from '../implementations/typescript/framework/sync-parser.impl.js';
import { syncCompilerHandler } from '../implementations/typescript/framework/sync-compiler.impl.js';
import { actionLogHandler } from '../implementations/typescript/framework/action-log.impl.js';
import { registryHandler } from '../implementations/typescript/framework/registry.impl.js';
import type { ConceptAST, ConceptManifest } from '../kernel/src/types.js';

const SPECS_DIR = resolve(__dirname, '..', 'specs');
const SYNCS_DIR = resolve(__dirname, '..', 'syncs');

function readSpec(category: string, name: string): string {
  return readFileSync(resolve(SPECS_DIR, category, `${name}.concept`), 'utf-8');
}

async function generateManifest(ast: ConceptAST): Promise<ConceptManifest> {
  const storage = createInMemoryStorage();
  const result = await schemaGenHandler.generate(
    { spec: 'test', ast },
    storage,
  );
  expect(result.variant).toBe('ok');
  return result.manifest as ConceptManifest;
}

// ============================================================
// 1. Full Pipeline: Source → Parse → Schema → Multi-Target Gen
// ============================================================

describe('E2E Language Pipeline — Source to Multi-Target', () => {
  it('Password concept: full pipeline produces all four language outputs', async () => {
    const source = readSpec('app', 'password');
    const storage = createInMemoryStorage();

    // Step 1: Parse concept source
    const parseResult = await specParserHandler.parse({ source }, storage);
    expect(parseResult.variant).toBe('ok');
    const ast = parseResult.ast as ConceptAST;
    expect(ast.name).toBe('Password');
    expect(ast.actions).toHaveLength(3);
    expect(ast.invariants).toHaveLength(1);

    // Step 2: Generate manifest
    const manifest = await generateManifest(ast);
    expect(manifest.name).toBe('Password');
    expect(manifest.actions).toHaveLength(3);
    expect(manifest.invariants).toHaveLength(1);
    expect(manifest.jsonSchemas).toBeDefined();
    expect(manifest.graphqlSchema).toBeTruthy();

    // Step 3a: TypeScript generation
    const tsStorage = createInMemoryStorage();
    const tsResult = await typescriptGenHandler.generate(
      { spec: 'pwd-e2e', manifest },
      tsStorage,
    );
    expect(tsResult.variant).toBe('ok');
    const tsFiles = tsResult.files as { path: string; content: string }[];
    expect(tsFiles).toHaveLength(4);
    expect(tsFiles.find(f => f.path.endsWith('.types.ts'))!.content).toContain('PasswordSetInput');
    expect(tsFiles.find(f => f.path.endsWith('.handler.ts'))!.content).toContain('PasswordHandler');
    expect(tsFiles.find(f => f.path.endsWith('.adapter.ts'))!.content).toContain('createPasswordLiteAdapter');
    expect(tsFiles.find(f => f.path.endsWith('.conformance.test.ts'))!.content).toContain('u-test-invariant-001');

    // Step 3b: Rust generation
    const rsStorage = createInMemoryStorage();
    const rsResult = await rustGenHandler.generate(
      { spec: 'pwd-e2e', manifest },
      rsStorage,
    );
    expect(rsResult.variant).toBe('ok');
    const rsFiles = rsResult.files as { path: string; content: string }[];
    expect(rsFiles).toHaveLength(4);
    expect(rsFiles.find(f => f.path.endsWith('types.rs'))!.content).toContain('pub struct PasswordSetInput');
    expect(rsFiles.find(f => f.path.endsWith('handler.rs'))!.content).toContain('pub trait PasswordHandler');
    expect(rsFiles.find(f => f.path.endsWith('adapter.rs'))!.content).toContain('pub struct PasswordAdapter');
    expect(rsFiles.find(f => f.path.endsWith('conformance.rs'))!.content).toContain('#[tokio::test]');

    // Step 3c: Solidity generation
    const solStorage = createInMemoryStorage();
    const solResult = await solidityGenHandler.generate(
      { spec: 'pwd-e2e', manifest },
      solStorage,
    );
    expect(solResult.variant).toBe('ok');
    const solFiles = solResult.files as { path: string; content: string }[];
    const contract = solFiles.find(f => f.path.endsWith('.sol') && !f.path.endsWith('.t.sol'))!;
    expect(contract.content).toContain('contract Password');
    const testHarness = solFiles.find(f => f.path.endsWith('.t.sol'))!;
    expect(testHarness.content).toContain('forge-std/Test.sol');

    // Step 3d: Swift generation
    const swiftStorage = createInMemoryStorage();
    const swiftResult = await swiftGenHandler.generate(
      { spec: 'pwd-e2e', manifest },
      swiftStorage,
    );
    expect(swiftResult.variant).toBe('ok');
    const swiftFiles = swiftResult.files as { path: string; content: string }[];
    expect(swiftFiles.find(f => f.path.endsWith('Types.swift'))!.content).toContain('Codable');
    expect(swiftFiles.find(f => f.path.endsWith('Handler.swift'))!.content).toContain('protocol PasswordHandler');
    expect(swiftFiles.find(f => f.path.endsWith('Adapter.swift'))!.content).toContain('class PasswordAdapter');
    expect(swiftFiles.find(f => f.path.endsWith('ConformanceTests.swift'))!.content).toContain('XCTestCase');
  });

  it('User concept: full pipeline for concept with type parameters', async () => {
    const source = readSpec('app', 'user');
    const storage = createInMemoryStorage();

    const parseResult = await specParserHandler.parse({ source }, storage);
    expect(parseResult.variant).toBe('ok');
    const ast = parseResult.ast as ConceptAST;

    const manifest = await generateManifest(ast);
    expect(manifest.typeParams.length).toBeGreaterThanOrEqual(1);

    // All four generators should succeed
    const generators = [
      { name: 'TypeScript', handler: typescriptGenHandler },
      { name: 'Rust', handler: rustGenHandler },
      { name: 'Solidity', handler: solidityGenHandler },
      { name: 'Swift', handler: swiftGenHandler },
    ];

    for (const gen of generators) {
      const genStorage = createInMemoryStorage();
      const result = await gen.handler.generate(
        { spec: 'user-e2e', manifest },
        genStorage,
      );
      expect(result.variant, `${gen.name} should succeed for User`).toBe('ok');
    }
  });
});

// ============================================================
// 2. Kernel-Driven Pipeline via Compiler Syncs
// ============================================================

describe('E2E Language Pipeline — Kernel-Driven via Syncs', () => {
  it('SpecParser → SchemaGen fires via compiler-pipeline sync', async () => {
    const kernel = createKernel();

    kernel.registerConcept('urn:copf/SpecParser', specParserHandler);
    kernel.registerConcept('urn:copf/SchemaGen', schemaGenHandler);
    kernel.registerConcept('urn:copf/TypeScriptGen', typescriptGenHandler);
    kernel.registerConcept('urn:copf/ActionLog', actionLogHandler);
    kernel.registerConcept('urn:copf/Registry', registryHandler);

    const syncSource = readFileSync(
      resolve(SYNCS_DIR, 'framework', 'compiler-pipeline.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(syncSource);
    for (const sync of syncs) {
      kernel.registerSync(sync);
    }

    const passwordSpec = readSpec('app', 'password');
    const parseResult = await kernel.invokeConcept(
      'urn:copf/SpecParser',
      'parse',
      { source: passwordSpec },
    );

    expect(parseResult.variant).toBe('ok');
    expect((parseResult.ast as ConceptAST).name).toBe('Password');
  });

  it('full self-compilation: SpecParser spec through the kernel pipeline', async () => {
    const kernel = createKernel();

    kernel.registerConcept('urn:copf/SpecParser', specParserHandler);
    kernel.registerConcept('urn:copf/SchemaGen', schemaGenHandler);
    kernel.registerConcept('urn:copf/TypeScriptGen', typescriptGenHandler);
    kernel.registerConcept('urn:copf/RustGen', rustGenHandler);
    kernel.registerConcept('urn:copf/SyncParser', syncParserHandler);
    kernel.registerConcept('urn:copf/SyncCompiler', syncCompilerHandler);
    kernel.registerConcept('urn:copf/ActionLog', actionLogHandler);
    kernel.registerConcept('urn:copf/Registry', registryHandler);

    const syncSource = readFileSync(
      resolve(SYNCS_DIR, 'framework', 'compiler-pipeline.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(syncSource);
    for (const sync of syncs) {
      kernel.registerSync(sync);
    }

    const specParserSpec = readSpec('framework', 'spec-parser');
    const result = await kernel.invokeConcept(
      'urn:copf/SpecParser',
      'parse',
      { source: specParserSpec },
    );

    expect(result.variant).toBe('ok');
    expect((result.ast as ConceptAST).name).toBe('SpecParser');
  });

  it('pipeline processes multiple concepts sequentially', async () => {
    const kernel = createKernel();

    kernel.registerConcept('urn:copf/SpecParser', specParserHandler);
    kernel.registerConcept('urn:copf/SchemaGen', schemaGenHandler);
    kernel.registerConcept('urn:copf/TypeScriptGen', typescriptGenHandler);
    kernel.registerConcept('urn:copf/ActionLog', actionLogHandler);
    kernel.registerConcept('urn:copf/Registry', registryHandler);

    const syncSource = readFileSync(
      resolve(SYNCS_DIR, 'framework', 'compiler-pipeline.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(syncSource);
    for (const sync of syncs) {
      kernel.registerSync(sync);
    }

    const concepts = ['password', 'user', 'article', 'echo'];
    for (const conceptName of concepts) {
      const source = readSpec('app', conceptName);
      const result = await kernel.invokeConcept(
        'urn:copf/SpecParser',
        'parse',
        { source },
      );
      expect(result.variant, `Parse of ${conceptName} should succeed`).toBe('ok');
    }
  });
});

// ============================================================
// 3. All App Concepts Through All Generators
// ============================================================

describe('E2E Language Pipeline — All App Concepts x All Generators', () => {
  const appConcepts = ['password', 'user', 'article', 'comment', 'echo', 'favorite', 'follow', 'profile', 'tag'];
  const generators = [
    { name: 'TypeScript', handler: typescriptGenHandler },
    { name: 'Rust', handler: rustGenHandler },
    { name: 'Solidity', handler: solidityGenHandler },
    { name: 'Swift', handler: swiftGenHandler },
  ];

  for (const conceptName of appConcepts) {
    it(`all generators produce valid output for ${conceptName}`, async () => {
      const source = readSpec('app', conceptName);
      const storage = createInMemoryStorage();

      // Parse
      const parseResult = await specParserHandler.parse({ source }, storage);
      expect(parseResult.variant).toBe('ok');

      // Schema
      const manifest = await generateManifest(parseResult.ast as ConceptAST);
      expect(manifest.name).toBeTruthy();

      // Generate for all targets
      for (const gen of generators) {
        const genStorage = createInMemoryStorage();
        const result = await gen.handler.generate(
          { spec: `${conceptName}-e2e`, manifest },
          genStorage,
        );
        expect(
          result.variant,
          `${gen.name} generation for ${conceptName} should succeed`,
        ).toBe('ok');

        const files = result.files as { path: string; content: string }[];
        expect(
          files.length,
          `${gen.name} should produce files for ${conceptName}`,
        ).toBeGreaterThanOrEqual(1);

        // All files should have non-empty content
        for (const file of files) {
          expect(
            file.content.length,
            `${gen.name} file ${file.path} should have content`,
          ).toBeGreaterThan(0);
        }
      }
    });
  }
});

// ============================================================
// 4. Framework Concepts Self-Compilation E2E
// ============================================================

describe('E2E Language Pipeline — Framework Self-Compilation', () => {
  const frameworkConcepts = [
    'spec-parser',
    'schema-gen',
    'typescript-gen',
    'rust-gen',
    'solidity-gen',
    'swift-gen',
    'sync-parser',
    'sync-engine',
    'sync-compiler',
    'action-log',
    'registry',
    'telemetry',
    'flow-trace',
    'deployment-validator',
    'migration',
  ];

  for (const conceptName of frameworkConcepts) {
    it(`framework concept ${conceptName} compiles through full pipeline`, async () => {
      const source = readSpec('framework', conceptName);
      const storage = createInMemoryStorage();

      // Parse
      const parseResult = await specParserHandler.parse({ source }, storage);
      expect(parseResult.variant).toBe('ok');
      const ast = parseResult.ast as ConceptAST;
      expect(ast.name).toBeTruthy();

      // Schema
      const manifest = await generateManifest(ast);
      expect(manifest.uri).toContain('urn:copf/');

      // TypeScript gen (the primary target)
      const tsStorage = createInMemoryStorage();
      const tsResult = await typescriptGenHandler.generate(
        { spec: `${conceptName}-e2e`, manifest },
        tsStorage,
      );
      expect(tsResult.variant).toBe('ok');
      const tsFiles = tsResult.files as { path: string; content: string }[];
      expect(tsFiles.length).toBeGreaterThanOrEqual(3);
    });
  }
});

// ============================================================
// 5. Compiler Pipeline Sync Structure E2E
// ============================================================

describe('E2E Language Pipeline — Pipeline Sync Structure', () => {
  it('compiler-pipeline.sync has all expected generator syncs', () => {
    const source = readFileSync(
      resolve(SYNCS_DIR, 'framework', 'compiler-pipeline.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(source);
    const syncNames = syncs.map(s => s.name);

    expect(syncNames).toContain('GenerateManifest');
    expect(syncNames).toContain('GenerateTypeScript');
    expect(syncNames).toContain('GenerateRust');
  });

  it('GenerateTypeScript and GenerateRust both trigger on SchemaGen/generate', () => {
    const source = readFileSync(
      resolve(SYNCS_DIR, 'framework', 'compiler-pipeline.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(source);

    const genTS = syncs.find(s => s.name === 'GenerateTypeScript')!;
    const genRust = syncs.find(s => s.name === 'GenerateRust')!;

    expect(genTS.when[0].concept).toBe('urn:copf/SchemaGen');
    expect(genTS.when[0].action).toBe('generate');
    expect(genRust.when[0].concept).toBe('urn:copf/SchemaGen');
    expect(genRust.when[0].action).toBe('generate');
  });

  it('both TypeScript and Rust outputs from same manifest are independently valid', async () => {
    const source = readSpec('app', 'password');
    const parseStorage = createInMemoryStorage();
    const parseResult = await specParserHandler.parse({ source }, parseStorage);
    const manifest = await generateManifest(parseResult.ast as ConceptAST);

    const [tsResult, rsResult] = await Promise.all([
      typescriptGenHandler.generate({ spec: 'e2e-parallel', manifest }, createInMemoryStorage()),
      rustGenHandler.generate({ spec: 'e2e-parallel', manifest }, createInMemoryStorage()),
    ]);

    expect(tsResult.variant).toBe('ok');
    expect(rsResult.variant).toBe('ok');

    const tsFiles = tsResult.files as { path: string; content: string }[];
    const rsFiles = rsResult.files as { path: string; content: string }[];

    // Both should have matching structure
    expect(tsFiles.find(f => f.path.includes('types'))).toBeDefined();
    expect(rsFiles.find(f => f.path.includes('types'))).toBeDefined();
    expect(tsFiles.find(f => f.path.includes('handler'))).toBeDefined();
    expect(rsFiles.find(f => f.path.includes('handler'))).toBeDefined();
    expect(tsFiles.find(f => f.path.includes('adapter'))).toBeDefined();
    expect(rsFiles.find(f => f.path.includes('adapter'))).toBeDefined();
    expect(tsFiles.find(f => f.path.includes('conformance'))).toBeDefined();
    expect(rsFiles.find(f => f.path.includes('conformance'))).toBeDefined();
  });
});

// ============================================================
// 6. Invariant Preservation E2E
// ============================================================

describe('E2E Language Pipeline — Invariant Preservation', () => {
  it('invariant test values are preserved through full pipeline', async () => {
    const source = readSpec('app', 'password');
    const storage = createInMemoryStorage();
    const parseResult = await specParserHandler.parse({ source }, storage);
    const ast = parseResult.ast as ConceptAST;
    const manifest = await generateManifest(ast);

    // All generators should use the same test value
    const testValue = manifest.invariants[0].freeVariables[0].testValue;
    expect(testValue).toBe('u-test-invariant-001');

    const generators = [
      { name: 'TypeScript', handler: typescriptGenHandler },
      { name: 'Rust', handler: rustGenHandler },
      { name: 'Swift', handler: swiftGenHandler },
    ];

    for (const gen of generators) {
      const genStorage = createInMemoryStorage();
      const result = await gen.handler.generate(
        { spec: 'invariant-e2e', manifest },
        genStorage,
      );
      const files = result.files as { path: string; content: string }[];
      const conformanceFile = files.find(f =>
        f.path.includes('conformance') || f.path.includes('Conformance'),
      )!;
      expect(
        conformanceFile.content,
        `${gen.name} conformance should contain test value`,
      ).toContain('u-test-invariant-001');
    }
  });
});
