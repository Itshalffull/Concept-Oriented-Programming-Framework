// ============================================================
// SwiftGen Tests
//
// Validates SwiftGen concept handler — Swift type mapping,
// handler protocols, transport adapters, and conformance tests.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  createInMemoryStorage,
} from '../kernel/src/index.js';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler.js';
import { schemaGenHandler } from '../handlers/ts/framework/schema-gen.handler.js';
import { swiftGenHandler } from '../handlers/ts/framework/swift-gen.handler.js';
import type { ConceptAST, ConceptManifest } from '../kernel/src/types.js';

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
// SwiftGen Concept — Type Mapping
// ============================================================

describe('SwiftGen Type Mapping', () => {
  it('SwiftGen concept spec exists and matches TypeScriptGen pattern', () => {
    const source = readSpec('framework', 'swift-gen');
    const ast = parseConceptFile(source);

    expect(ast.name).toBe('SwiftGen');
    expect(ast.actions).toHaveLength(2);
    expect(ast.actions.map(a => a.name)).toContain('generate');
    expect(ast.actions.map(a => a.name)).toContain('register');
    const generateAction = ast.actions.find(a => a.name === 'generate')!;
    expect(generateAction.params.map(p => p.name)).toContain('manifest');
    expect(generateAction.params.map(p => p.name)).toContain('spec');
    expect(generateAction.variants.map(v => v.name)).toContain('ok');
    expect(generateAction.variants.map(v => v.name)).toContain('error');
  });

  it('generates Swift types for Password concept', async () => {
    const source = readSpec('app', 'password');
    const ast = parseConceptFile(source);
    const manifest = await generateManifest(ast);

    const storage = createInMemoryStorage();
    const result = await swiftGenHandler.generate(
      { spec: 'test', manifest },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    expect(files.length).toBeGreaterThanOrEqual(3); // Types, Handler, Adapter

    // Check Types.swift exists and contains struct definitions
    const typesFile = files.find(f => f.path.endsWith('Types.swift'));
    expect(typesFile).toBeDefined();
    expect(typesFile!.content).toContain('struct Password');
    expect(typesFile!.content).toContain('Codable');
    expect(typesFile!.content).toContain('String'); // password fields are strings

    // Check Handler.swift exists with protocol
    const handlerFile = files.find(f => f.path.endsWith('Handler.swift'));
    expect(handlerFile).toBeDefined();
    expect(handlerFile!.content).toContain('protocol PasswordHandler');
    expect(handlerFile!.content).toContain('async throws');

    // Check Adapter.swift exists
    const adapterFile = files.find(f => f.path.endsWith('Adapter.swift'));
    expect(adapterFile).toBeDefined();
    expect(adapterFile!.content).toContain('class PasswordAdapter');
    expect(adapterFile!.content).toContain('ConceptTransport');
  });

  it('generates conformance tests when invariants exist', async () => {
    const source = readSpec('app', 'password');
    const ast = parseConceptFile(source);
    const manifest = await generateManifest(ast);

    const storage = createInMemoryStorage();
    const result = await swiftGenHandler.generate(
      { spec: 'test', manifest },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];

    if (manifest.invariants.length > 0) {
      const testFile = files.find(f => f.path.endsWith('ConformanceTests.swift'));
      expect(testFile).toBeDefined();
      expect(testFile!.content).toContain('XCTestCase');
      expect(testFile!.content).toContain('func test');
    }
  });

  it('handles concepts without invariants (no test file)', async () => {
    const source = readSpec('framework', 'schema-gen');
    const ast = parseConceptFile(source);
    const manifest = await generateManifest(ast);

    const storage = createInMemoryStorage();
    const result = await swiftGenHandler.generate(
      { spec: 'test', manifest },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    const testFile = files.find(f => f.path.endsWith('ConformanceTests.swift'));

    if (manifest.invariants.length === 0) {
      expect(testFile).toBeUndefined();
    }
  });

  it('returns error for invalid manifest', async () => {
    const storage = createInMemoryStorage();
    const result = await swiftGenHandler.generate(
      { spec: 'test', manifest: {} },
      storage,
    );

    expect(result.variant).toBe('error');
  });
});
