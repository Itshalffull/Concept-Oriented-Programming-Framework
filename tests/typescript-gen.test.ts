// ============================================================
// TypeScriptGen Tests
//
// Validates TypeScriptGen concept handler — TypeScript skeleton
// generation and output identity through the manifest pipeline.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  createInMemoryStorage,
} from '../kernel/src/index.js';
import { parseConceptFile } from '../implementations/typescript/framework/spec-parser.impl.js';
import { schemaGenHandler } from '../implementations/typescript/framework/schema-gen.impl.js';
import { typescriptGenHandler } from '../implementations/typescript/framework/typescript-gen.impl.js';
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
// 1. TypeScriptGen Concept Handler
// ============================================================

describe('TypeScriptGen Concept', () => {
  it('generates TypeScript skeleton for Password concept', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'test-spec-1', manifest },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    // types + handler + adapter + conformance test (Password has invariants)
    expect(files).toHaveLength(4);

    // Types file
    const typesFile = files.find(f => f.path === 'password.types.ts');
    expect(typesFile).toBeDefined();
    expect(typesFile!.content).toContain('PasswordSetInput');
    expect(typesFile!.content).toContain('PasswordSetOutput');
    expect(typesFile!.content).toContain('PasswordCheckInput');
    expect(typesFile!.content).toContain('PasswordValidateInput');
    expect(typesFile!.content).toContain('variant: "ok"');
    expect(typesFile!.content).toContain('variant: "invalid"');
    expect(typesFile!.content).toContain('variant: "notfound"');

    // Handler file
    const handlerFile = files.find(f => f.path === 'password.handler.ts');
    expect(handlerFile).toBeDefined();
    expect(handlerFile!.content).toContain('PasswordHandler');
    expect(handlerFile!.content).toContain('set(input:');
    expect(handlerFile!.content).toContain('check(input:');
    expect(handlerFile!.content).toContain('validate(input:');

    // Adapter file
    const adapterFile = files.find(f => f.path === 'password.adapter.ts');
    expect(adapterFile).toBeDefined();
    expect(adapterFile!.content).toContain('createPasswordLiteAdapter');
  });

  it('generates types for type parameter fields', async () => {
    const ast = parseConceptFile(readSpec('app', 'user'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'spec-1', manifest },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    const typesFile = files.find(f => f.path === 'user.types.ts');
    expect(typesFile).toBeDefined();
    // Type parameter U should map to string
    expect(typesFile!.content).toContain('user: string');
  });
});

// ============================================================
// 2. TypeScriptGen Output Identity
// ============================================================

describe('TypeScriptGen Output Identity', () => {
  it('Password types file is identical through manifest pipeline', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'pwd-1', manifest },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const typesFile = files.find(f => f.path === 'password.types.ts')!;

    // Exact content checks — these must match the pre-refactor output
    const lines = typesFile.content.split('\n');
    expect(lines[0]).toBe('// generated: password.types.ts');
    expect(typesFile.content).toContain('export interface PasswordSetInput {\n  user: string;\n  password: string;\n}');
    expect(typesFile.content).toContain('variant: "ok"; user: string');
    expect(typesFile.content).toContain('variant: "invalid"; message: string');
    expect(typesFile.content).toContain('variant: "ok"; valid: boolean');
    expect(typesFile.content).toContain('variant: "notfound"; message: string');
  });

  it('Password handler file is identical through manifest pipeline', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'pwd-1', manifest },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const handlerFile = files.find(f => f.path === 'password.handler.ts')!;

    expect(handlerFile.content).toContain('export interface PasswordHandler {');
    expect(handlerFile.content).toContain('set(input: T.PasswordSetInput, storage: ConceptStorage):');
    expect(handlerFile.content).toContain('check(input: T.PasswordCheckInput, storage: ConceptStorage):');
    expect(handlerFile.content).toContain('validate(input: T.PasswordValidateInput, storage: ConceptStorage):');
  });

  it('Password adapter file is identical through manifest pipeline', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'pwd-1', manifest },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const adapterFile = files.find(f => f.path === 'password.adapter.ts')!;

    expect(adapterFile.content).toContain('createPasswordLiteAdapter');
    expect(adapterFile.content).toContain('queryMode: "lite"');
    expect(adapterFile.content).toContain('async invoke(invocation: ActionInvocation)');
  });

  it('Password conformance test is identical through manifest pipeline', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'pwd-1', manifest },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const testFile = files.find(f => f.path === 'password.conformance.test.ts')!;

    // Exact content checks for conformance test structure
    expect(testFile.content).toContain('const x = "u-test-invariant-001"');
    expect(testFile.content).toContain('// --- AFTER clause ---');
    expect(testFile.content).toContain('// set(user: x, password: "secret") -> ok(user: x)');
    expect(testFile.content).toContain('// --- THEN clause ---');
    expect(testFile.content).toContain('// check(user: x, password: "secret") -> ok(valid: true)');
    expect(testFile.content).toContain('// check(user: x, password: "wrong") -> ok(valid: false)');
  });
});
