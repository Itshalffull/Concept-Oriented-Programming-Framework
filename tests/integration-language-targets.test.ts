// ============================================================
// Integration Tests — All Language Targets
//
// Validates cross-cutting integration across every language
// generator (TypeScript, Rust, Solidity, Swift, Schema) by
// feeding the same concept specs through each generator and
// verifying structural consistency, file counts, and that all
// generators accept the same ConceptManifest.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createInMemoryStorage } from '../kernel/src/index.js';
import { parseConceptFile } from '../implementations/typescript/framework/spec-parser.impl.js';
import { schemaGenHandler } from '../implementations/typescript/framework/schema-gen.impl.js';
import { typescriptGenHandler } from '../implementations/typescript/framework/typescript-gen.impl.js';
import { rustGenHandler } from '../implementations/typescript/framework/rust-gen.impl.js';
import { solidityGenHandler } from '../implementations/typescript/framework/solidity-gen.impl.js';
import { swiftGenHandler } from '../implementations/typescript/framework/swift-gen.impl.js';
import type { ConceptAST, ConceptManifest } from '../kernel/src/types.js';

const SPECS_DIR = resolve(__dirname, '..', 'specs');

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

// All language generators that consume a ConceptManifest
const generators = [
  { name: 'TypeScriptGen', handler: typescriptGenHandler },
  { name: 'RustGen', handler: rustGenHandler },
  { name: 'SolidityGen', handler: solidityGenHandler },
  { name: 'SwiftGen', handler: swiftGenHandler },
];

// App concepts with invariants (should produce conformance tests)
const appConceptsWithInvariants = ['password'];
// App concepts without invariants
const appConceptsWithoutInvariants = ['echo', 'tag'];
// All testable app concepts
const allAppConcepts = ['password', 'user', 'article', 'comment', 'echo', 'favorite', 'follow', 'profile', 'tag'];

// ============================================================
// 1. All generators accept the same manifest (cross-target parity)
// ============================================================

describe('Language Target Integration — Cross-Target Parity', () => {
  it('all generators succeed on the Password concept manifest', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);

    for (const gen of generators) {
      const storage = createInMemoryStorage();
      const result = await gen.handler.generate(
        { spec: 'pwd-integration', manifest },
        storage,
      );

      expect(result.variant, `${gen.name} should succeed`).toBe('ok');
      const files = result.files as { path: string; content: string }[];
      expect(files.length, `${gen.name} should produce files`).toBeGreaterThanOrEqual(1);
    }
  });

  it('all generators succeed on the User concept manifest', async () => {
    const ast = parseConceptFile(readSpec('app', 'user'));
    const manifest = await generateManifest(ast);

    for (const gen of generators) {
      const storage = createInMemoryStorage();
      const result = await gen.handler.generate(
        { spec: 'user-integration', manifest },
        storage,
      );

      expect(result.variant, `${gen.name} should succeed for User`).toBe('ok');
    }
  });

  it('all generators succeed on the Article concept manifest', async () => {
    const ast = parseConceptFile(readSpec('app', 'article'));
    const manifest = await generateManifest(ast);

    for (const gen of generators) {
      const storage = createInMemoryStorage();
      const result = await gen.handler.generate(
        { spec: 'article-integration', manifest },
        storage,
      );

      expect(result.variant, `${gen.name} should succeed for Article`).toBe('ok');
    }
  });

  it('all generators handle an error for invalid manifest consistently', async () => {
    for (const gen of generators) {
      const storage = createInMemoryStorage();
      const result = await gen.handler.generate(
        { spec: 'bad', manifest: {} },
        storage,
      );

      expect(result.variant, `${gen.name} should return error for empty manifest`).toBe('error');
    }
  });
});

// ============================================================
// 2. SchemaGen produces valid manifests for all app concepts
// ============================================================

describe('Language Target Integration — SchemaGen Coverage', () => {
  for (const conceptName of allAppConcepts) {
    it(`SchemaGen produces a valid manifest for ${conceptName}`, async () => {
      const ast = parseConceptFile(readSpec('app', conceptName));
      const manifest = await generateManifest(ast);

      expect(manifest.name).toBeTruthy();
      expect(manifest.uri).toContain('urn:copf/');
      expect(manifest.actions.length).toBeGreaterThanOrEqual(1);
      expect(manifest.relations).toBeDefined();
      expect(manifest.jsonSchemas).toBeDefined();
      expect(manifest.jsonSchemas.invocations).toBeDefined();
      expect(manifest.jsonSchemas.completions).toBeDefined();
      expect(manifest.graphqlSchema).toBeTruthy();
    });
  }
});

// ============================================================
// 3. Conformance test generation consistency
// ============================================================

describe('Language Target Integration — Conformance Test Generation', () => {
  for (const conceptName of appConceptsWithInvariants) {
    it(`all generators produce conformance tests for ${conceptName} (has invariants)`, async () => {
      const ast = parseConceptFile(readSpec('app', conceptName));
      const manifest = await generateManifest(ast);
      expect(manifest.invariants.length).toBeGreaterThan(0);

      for (const gen of generators) {
        const storage = createInMemoryStorage();
        const result = await gen.handler.generate(
          { spec: `${conceptName}-conf`, manifest },
          storage,
        );
        expect(result.variant).toBe('ok');
        const files = result.files as { path: string; content: string }[];

        const hasConformance = files.some(f =>
          f.path.toLowerCase().includes('conformance') || f.path.endsWith('.t.sol'),
        );
        expect(
          hasConformance,
          `${gen.name} should produce conformance test for ${conceptName}`,
        ).toBe(true);
      }
    });
  }

  for (const conceptName of appConceptsWithoutInvariants) {
    it(`generators skip conformance tests for ${conceptName} (no invariants)`, async () => {
      const ast = parseConceptFile(readSpec('app', conceptName));
      const manifest = await generateManifest(ast);

      if (manifest.invariants.length === 0) {
        for (const gen of generators) {
          const storage = createInMemoryStorage();
          const result = await gen.handler.generate(
            { spec: `${conceptName}-no-conf`, manifest },
            storage,
          );
          expect(result.variant).toBe('ok');
          const files = result.files as { path: string; content: string }[];

          const hasConformance = files.some(f =>
            f.path.toLowerCase().includes('conformance') || f.path.endsWith('.t.sol'),
          );
          expect(
            hasConformance,
            `${gen.name} should NOT produce conformance test for ${conceptName}`,
          ).toBe(false);
        }
      }
    });
  }
});

// ============================================================
// 4. File structure consistency across generators
// ============================================================

describe('Language Target Integration — File Structure', () => {
  it('TypeScriptGen produces types, handler, adapter, and conformance for Password', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'pwd-struct', manifest },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    expect(files).toHaveLength(4);
    expect(files.find(f => f.path.endsWith('.types.ts'))).toBeDefined();
    expect(files.find(f => f.path.endsWith('.handler.ts'))).toBeDefined();
    expect(files.find(f => f.path.endsWith('.adapter.ts'))).toBeDefined();
    expect(files.find(f => f.path.endsWith('.conformance.test.ts'))).toBeDefined();
  });

  it('RustGen produces types, handler, adapter, and conformance for Password', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await rustGenHandler.generate(
      { spec: 'pwd-struct', manifest },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    expect(files).toHaveLength(4);
    expect(files.find(f => f.path.endsWith('types.rs'))).toBeDefined();
    expect(files.find(f => f.path.endsWith('handler.rs'))).toBeDefined();
    expect(files.find(f => f.path.endsWith('adapter.rs'))).toBeDefined();
    expect(files.find(f => f.path.endsWith('conformance.rs'))).toBeDefined();
  });

  it('SolidityGen produces contract and test harness for Password', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await solidityGenHandler.generate(
      { spec: 'pwd-struct', manifest },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    expect(files.find(f => f.path.endsWith('.sol') && !f.path.endsWith('.t.sol'))).toBeDefined();
    expect(files.find(f => f.path.endsWith('.t.sol'))).toBeDefined();
  });

  it('SwiftGen produces Types, Handler, Adapter, and ConformanceTests for Password', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await swiftGenHandler.generate(
      { spec: 'pwd-struct', manifest },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    expect(files.find(f => f.path.endsWith('Types.swift'))).toBeDefined();
    expect(files.find(f => f.path.endsWith('Handler.swift'))).toBeDefined();
    expect(files.find(f => f.path.endsWith('Adapter.swift'))).toBeDefined();
    expect(files.find(f => f.path.endsWith('ConformanceTests.swift'))).toBeDefined();
  });
});

// ============================================================
// 5. Generated content includes language-specific idioms
// ============================================================

describe('Language Target Integration — Language Idioms', () => {
  let manifest: ConceptManifest;

  // Generate manifest once for all idiom checks
  beforeAll(async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    manifest = await generateManifest(ast);
  });

  it('TypeScript output uses TypeScript idioms', async () => {
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'idiom-ts', manifest },
      storage,
    );
    const files = result.files as { path: string; content: string }[];
    const types = files.find(f => f.path.endsWith('.types.ts'))!;

    expect(types.content).toContain('export interface');
    expect(types.content).toContain('variant:');
    expect(types.content).toContain('string');
  });

  it('Rust output uses Rust idioms', async () => {
    const storage = createInMemoryStorage();
    const result = await rustGenHandler.generate(
      { spec: 'idiom-rs', manifest },
      storage,
    );
    const files = result.files as { path: string; content: string }[];
    const types = files.find(f => f.path.endsWith('types.rs'))!;

    expect(types.content).toContain('pub struct');
    expect(types.content).toContain('pub enum');
    expect(types.content).toContain('#[derive(');
    expect(types.content).toContain('Serialize');
    expect(types.content).toContain('use serde::');
  });

  it('Solidity output uses Solidity idioms', async () => {
    const storage = createInMemoryStorage();
    const result = await solidityGenHandler.generate(
      { spec: 'idiom-sol', manifest },
      storage,
    );
    const files = result.files as { path: string; content: string }[];
    const contract = files.find(f => f.path.endsWith('.sol') && !f.path.endsWith('.t.sol'))!;

    expect(contract.content).toContain('pragma solidity');
    expect(contract.content).toContain('contract');
    expect(contract.content).toContain('function');
    expect(contract.content).toContain('SPDX-License-Identifier');
  });

  it('Swift output uses Swift idioms', async () => {
    const storage = createInMemoryStorage();
    const result = await swiftGenHandler.generate(
      { spec: 'idiom-swift', manifest },
      storage,
    );
    const files = result.files as { path: string; content: string }[];
    const types = files.find(f => f.path.endsWith('Types.swift'))!;

    expect(types.content).toContain('struct');
    expect(types.content).toContain('Codable');
    expect(types.content).toContain('String');
  });
});

// ============================================================
// 6. Storage persistence across generators
// ============================================================

describe('Language Target Integration — Storage Persistence', () => {
  it('each generator returns files without side-effecting storage', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);

    for (const gen of generators) {
      const storage = createInMemoryStorage();
      const result = await gen.handler.generate(
        { spec: 'pwd-store', manifest },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(
        (result.files as { path: string; content: string }[]).length,
        `${gen.name} should return generated files`,
      ).toBeGreaterThanOrEqual(1);

      // Generators should not store outputs directly — BuildCache handles this
      const stored = await storage.find('outputs');
      expect(
        stored.length,
        `${gen.name} should not write to storage.outputs (BuildCache handles caching)`,
      ).toBe(0);
    }
  });

  it('SchemaGen stores manifest in storage', async () => {
    const storage = createInMemoryStorage();
    const ast = parseConceptFile(readSpec('app', 'password'));
    await schemaGenHandler.generate({ spec: 'persist-test', ast }, storage);

    const stored = await storage.get('manifests', 'persist-test');
    expect(stored).not.toBeNull();
    expect((stored!.manifest as ConceptManifest).name).toBe('Password');
  });
});

// ============================================================
// 7. Framework concept self-compilation
// ============================================================

describe('Language Target Integration — Framework Self-Compilation', () => {
  const frameworkConcepts = [
    'typescript-gen',
    'rust-gen',
    'solidity-gen',
    'swift-gen',
    'schema-gen',
    'spec-parser',
    'sync-parser',
    'sync-engine',
  ];

  for (const conceptName of frameworkConcepts) {
    it(`SchemaGen produces a valid manifest for framework concept: ${conceptName}`, async () => {
      const ast = parseConceptFile(readSpec('framework', conceptName));
      const manifest = await generateManifest(ast);

      expect(manifest.name).toBeTruthy();
      expect(manifest.uri).toContain('urn:copf/');
      expect(manifest.actions.length).toBeGreaterThanOrEqual(1);
    });
  }

  it('TypeScriptGen can generate code for its own spec (self-compilation)', async () => {
    const ast = parseConceptFile(readSpec('framework', 'typescript-gen'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'self-compile', manifest },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    expect(files.length).toBeGreaterThanOrEqual(3);
  });

  it('RustGen can generate code for TypeScriptGen spec', async () => {
    const ast = parseConceptFile(readSpec('framework', 'typescript-gen'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await rustGenHandler.generate(
      { spec: 'cross-compile', manifest },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    expect(files.length).toBeGreaterThanOrEqual(3);
  });
});
