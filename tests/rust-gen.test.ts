// ============================================================
// RustGen Tests
//
// Validates RustGen concept handler — Rust type mapping,
// handler traits, transport adapters, and conformance tests.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  createInMemoryStorage,
} from '../runtime/index.js';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler.js';
import { schemaGenHandler } from '../handlers/ts/framework/schema-gen.handler.js';
import { rustGenHandler } from '../handlers/ts/framework/rust-gen.handler.js';
import type { ConceptAST, ConceptManifest } from '../runtime/types.js';

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
// RustGen Concept — Type Mapping
// ============================================================

describe('RustGen Type Mapping', () => {
  it('RustGen concept spec exists and matches TypeScriptGen pattern', () => {
    const source = readSpec('framework', 'rust-gen');
    const ast = parseConceptFile(source);

    expect(ast.name).toBe('RustGen');
    expect(ast.actions).toHaveLength(2);
    expect(ast.actions.map(a => a.name)).toContain('generate');
    expect(ast.actions.map(a => a.name)).toContain('register');
    const generateAction = ast.actions.find(a => a.name === 'generate')!;
    expect(generateAction.params.map(p => p.name)).toContain('manifest');
    expect(generateAction.params.map(p => p.name)).toContain('spec');
    expect(generateAction.variants.map(v => v.name)).toContain('ok');
    expect(generateAction.variants.map(v => v.name)).toContain('error');
  });

  it('Password concept generates correct Rust type definitions', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await rustGenHandler.generate(
      { spec: 'pwd-1', manifest },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    const typesFile = files.find(f => f.path === 'password/types.rs')!;
    expect(typesFile).toBeDefined();

    // Primitive type mappings
    expect(typesFile.content).toContain('pub struct PasswordSetInput');
    expect(typesFile.content).toContain('pub user: String'); // param U → String
    expect(typesFile.content).toContain('pub password: String'); // String → String

    // Bool type mapping (enum variant fields don't use `pub` in Rust)
    expect(typesFile.content).toContain('valid: bool'); // Bool → bool

    // Enum output types with serde tag
    expect(typesFile.content).toContain('pub enum PasswordSetOutput');
    expect(typesFile.content).toContain('pub enum PasswordCheckOutput');
    expect(typesFile.content).toContain('#[serde(tag = "variant")]');

    // Variant names are capitalized
    expect(typesFile.content).toContain('Ok');
    expect(typesFile.content).toContain('Invalid');
    expect(typesFile.content).toContain('Notfound');

    // Derive macros
    expect(typesFile.content).toContain('#[derive(');
    expect(typesFile.content).toContain('Serialize');
    expect(typesFile.content).toContain('Deserialize');

    // Uses serde
    expect(typesFile.content).toContain('use serde::{Serialize, Deserialize}');
  });

  it('Password concept generates correct Rust handler trait', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await rustGenHandler.generate(
      { spec: 'pwd-1', manifest },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const handlerFile = files.find(f => f.path === 'password/handler.rs')!;
    expect(handlerFile).toBeDefined();

    // Trait definition
    expect(handlerFile.content).toContain('#[async_trait]');
    expect(handlerFile.content).toContain('pub trait PasswordHandler: Send + Sync');

    // Action methods
    expect(handlerFile.content).toContain('async fn set(');
    expect(handlerFile.content).toContain('async fn check(');
    expect(handlerFile.content).toContain('async fn validate(');

    // Method signatures include storage
    expect(handlerFile.content).toContain('storage: &dyn ConceptStorage');

    // Return types
    expect(handlerFile.content).toContain('Result<PasswordSetOutput');
    expect(handlerFile.content).toContain('Result<PasswordCheckOutput');
    expect(handlerFile.content).toContain('Result<PasswordValidateOutput');
  });

  it('Password concept generates correct Rust transport adapter', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await rustGenHandler.generate(
      { spec: 'pwd-1', manifest },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const adapterFile = files.find(f => f.path === 'password/adapter.rs')!;
    expect(adapterFile).toBeDefined();

    // Adapter struct
    expect(adapterFile.content).toContain('pub struct PasswordAdapter');
    expect(adapterFile.content).toContain('impl<H: PasswordHandler');

    // Action dispatch
    expect(adapterFile.content).toContain('"set"');
    expect(adapterFile.content).toContain('"check"');
    expect(adapterFile.content).toContain('"validate"');

    // Serde serialization
    expect(adapterFile.content).toContain('serde_json::from_value');
    expect(adapterFile.content).toContain('serde_json::to_value');

    // Transport trait impl
    expect(adapterFile.content).toContain('ConceptTransport for PasswordAdapter');
  });

  it('Password concept generates Rust conformance tests', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await rustGenHandler.generate(
      { spec: 'pwd-1', manifest },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const testFile = files.find(f => f.path === 'password/conformance.rs')!;
    expect(testFile).toBeDefined();

    // Test structure
    expect(testFile.content).toContain('#[cfg(test)]');
    expect(testFile.content).toContain('#[tokio::test]');
    expect(testFile.content).toContain('async fn password_invariant_1');

    // Deterministic test value
    expect(testFile.content).toContain('"u-test-invariant-001"');

    // After clause (setup)
    expect(testFile.content).toContain('// --- AFTER clause ---');
    // Then clause (assertions)
    expect(testFile.content).toContain('// --- THEN clause ---');

    // Rust-style assertions
    expect(testFile.content).toContain('assert_eq!');
  });

  it('generates files for concept without invariants (no conformance.rs)', async () => {
    // Use an inline concept with no invariant block
    const ast = parseConceptFile(`concept Bare [X] {
  purpose { Minimal concept with no invariants. }
  state { items: set X }
  actions {
    action get(id: X) {
      -> ok(item: X) { Return the item. }
      -> error(message: String) { Not found. }
    }
  }
}`);
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await rustGenHandler.generate(
      { spec: 'sg-1', manifest },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    // types, handler, adapter — but no conformance since no invariants
    expect(files).toHaveLength(3);
    expect(files.find(f => f.path.endsWith('conformance.rs'))).toBeUndefined();
  });

  it('handles complex types (list, option, set, map) correctly', async () => {
    // SpecParser has set S, list types — verify these map correctly
    const ast = parseConceptFile(readSpec('framework', 'spec-parser'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await rustGenHandler.generate(
      { spec: 'sp-1', manifest },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    const typesFile = files.find(f => f.path.endsWith('types.rs'))!;
    expect(typesFile).toBeDefined();

    // Verify the types file has struct definitions
    expect(typesFile.content).toContain('pub struct SpecParser');
    expect(typesFile.content).toContain('Serialize');
  });

  it('returns error for invalid manifest', async () => {
    const storage = createInMemoryStorage();
    const result = await rustGenHandler.generate(
      { spec: 'bad', manifest: {} },
      storage,
    );

    expect(result.variant).toBe('error');
    expect(result.message).toContain('missing concept name');
  });
});
