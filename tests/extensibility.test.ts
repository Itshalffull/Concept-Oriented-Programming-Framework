// ============================================================
// Extensibility Tests
//
// Validates the key extensibility property: adding a new
// language target requires only a new concept + one sync,
// no existing code changes.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  createInMemoryStorage,
} from '../kernel/src/index.js';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler.js';
import { schemaGenHandler } from '../handlers/ts/framework/schema-gen.handler.js';
import { typescriptGenHandler } from '../handlers/ts/framework/typescript-gen.handler.js';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.handler.js';
import { syncCompilerHandler } from '../handlers/ts/framework/sync-compiler.handler.js';
import type { ConceptHandler, ConceptAST, ConceptManifest } from '../kernel/src/types.js';

const SPECS_DIR = resolve(__dirname, '..', 'specs');

function readSpec(category: string, name: string): string {
  return readFileSync(resolve(SPECS_DIR, category, `${name}.concept`), 'utf-8');
}

// Helper: run SchemaGen on an AST and return the manifest
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
// 1. Extensibility
// ============================================================

describe('Extensibility', () => {
  it('a mock RustGen concept can consume the same manifest as TypeScriptGen', async () => {
    // The key extensibility property: the ConceptManifest is language-neutral.
    // Any new generator concept receives the same manifest and produces files.
    // Adding a new target language requires only a new concept + one sync.

    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);

    // Mock RustGen: receives a manifest, produces Rust skeleton files
    const rustGenHandler: ConceptHandler = {
      async generate(input, storage) {
        const m = input.manifest as ConceptManifest;
        const files = [];
        for (const action of m.actions) {
          files.push({
            path: `${m.name.toLowerCase()}/src/${action.name}.rs`,
            content: `// Rust handler for ${m.name}::${action.name}`,
          });
        }
        return { variant: 'ok', files };
      },
    };

    // TypeScriptGen produces TypeScript files from the manifest
    const tsStorage = createInMemoryStorage();
    const tsResult = await typescriptGenHandler.generate(
      { spec: 'pwd-1', manifest },
      tsStorage,
    );
    expect(tsResult.variant).toBe('ok');
    const tsFiles = tsResult.files as { path: string; content: string }[];
    expect(tsFiles.length).toBeGreaterThanOrEqual(3);

    // RustGen produces Rust files from the SAME manifest — no changes needed
    const rustStorage = createInMemoryStorage();
    const rustResult = await rustGenHandler.generate!(
      { spec: 'pwd-1', manifest },
      rustStorage,
    );
    expect(rustResult.variant).toBe('ok');
    const rustFiles = rustResult.files as { path: string; content: string }[];
    // One file per action: set, check, validate
    expect(rustFiles).toHaveLength(3);
    expect(rustFiles[0].path).toContain('password/src/');
    expect(rustFiles[0].content).toContain('Rust handler for Password');
  });

  it('new language sync can be parsed and compiled without modifying existing syncs', async () => {
    // Verify the sync for a new language target can be parsed and compiled
    const rustSyncSource = `
      sync GenerateRust [eager]
      when {
        SchemaGen/generate: [ spec: ?spec ] => [ manifest: ?manifest ]
      }
      then {
        RustGen/generate: [ spec: ?spec; manifest: ?manifest ]
      }
    `;

    const syncs = parseSyncFile(rustSyncSource);
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('GenerateRust');

    // Compile it
    const storage = createInMemoryStorage();
    const result = await syncCompilerHandler.compile(
      { sync: 'gen-rust', ast: syncs[0] },
      storage,
    );
    expect(result.variant).toBe('ok');

    // Verify structure matches the GenerateTypeScript sync pattern
    const compiled = result.compiled as any;
    expect(compiled.when[0].concept).toBe('urn:copf/SchemaGen');
    expect(compiled.then[0].concept).toBe('urn:copf/RustGen');
  });

  it('manifest ResolvedType tree is sufficient for any language mapping', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);

    // Verify all types in the manifest use ResolvedType (not TypeExpr)
    for (const action of manifest.actions) {
      for (const param of action.params) {
        expect(param.type.kind).toBeDefined();
        expect(['primitive', 'param', 'set', 'list', 'option', 'map', 'record'])
          .toContain(param.type.kind);
      }
      for (const variant of action.variants) {
        for (const field of variant.fields) {
          expect(field.type.kind).toBeDefined();
        }
      }
    }

    // Verify relation fields also use ResolvedType
    for (const rel of manifest.relations) {
      for (const field of rel.fields) {
        expect(field.type.kind).toBeDefined();
      }
    }
  });
});

// ============================================================
// 2. Extensibility Validation
// ============================================================

describe('Extensibility Validation', () => {
  it('RustGen was added without modifying TypeScriptGen', async () => {
    // Verify that TypeScriptGen output is unchanged after adding RustGen
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'pwd-1', manifest },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    // Same 4 files as before
    expect(files).toHaveLength(4);
    expect(files.find(f => f.path === 'password.types.ts')).toBeDefined();
    expect(files.find(f => f.path === 'password.handler.ts')).toBeDefined();
    expect(files.find(f => f.path === 'password.adapter.ts')).toBeDefined();
    expect(files.find(f => f.path === 'password.conformance.test.ts')).toBeDefined();
  });

  it('RustGen was added without modifying SchemaGen', async () => {
    // SchemaGen still produces the same manifest structure
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);

    // Same fields as before
    expect(manifest.uri).toBe('urn:copf/Password');
    expect(manifest.name).toBe('Password');
    expect(manifest.typeParams).toHaveLength(1);
    expect(manifest.relations).toHaveLength(1);
    expect(manifest.actions).toHaveLength(3);
    expect(manifest.invariants).toHaveLength(1);
    expect(manifest.graphqlSchema).toBeDefined();
    expect(manifest.jsonSchemas).toBeDefined();
  });

  it('adding a hypothetical SwiftGen requires only concept + sync', async () => {
    // To prove extensibility, we add a mock SwiftGen with zero changes
    // to any existing concept, handler, or sync

    const swiftGenHandler: ConceptHandler = {
      async generate(input, storage) {
        const m = input.manifest as ConceptManifest;
        const files = m.actions.map(a => ({
          path: `${m.name}/${a.name}.swift`,
          content: `// Swift handler for ${m.name}.${a.name}`,
        }));
        await storage.put('outputs', input.spec as string, { spec: input.spec, files });
        return { variant: 'ok', files };
      },
    };

    // The sync for SwiftGen
    const swiftSyncSource = `
      sync GenerateSwift [eager]
      when {
        SchemaGen/generate: [ spec: ?spec ] => [ manifest: ?manifest ]
      }
      then {
        SwiftGen/generate: [ spec: ?spec; manifest: ?manifest ]
      }
    `;

    const syncs = parseSyncFile(swiftSyncSource);
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('GenerateSwift');

    // The mock SwiftGen produces output from the same manifest
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await swiftGenHandler.generate!(
      { spec: 'pwd-1', manifest },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    expect(files).toHaveLength(3); // set, check, validate
    expect(files[0].path).toContain('.swift');
  });
});
