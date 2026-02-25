// ============================================================
// SolidityGen Tests
//
// Validates SolidityGen concept handler — Solidity type mapping,
// contract skeletons, event declarations, and Foundry test
// harnesses from invariants.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  createInMemoryStorage,
} from '../kernel/src/index.js';
import { parseConceptFile } from '../implementations/typescript/framework/spec-parser.impl.js';
import { schemaGenHandler } from '../implementations/typescript/framework/schema-gen.impl.js';
import { solidityGenHandler } from '../implementations/typescript/framework/solidity-gen.impl.js';
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
// SolidityGen Concept — Type Mapping
// ============================================================

describe('SolidityGen Type Mapping', () => {
  it('SolidityGen concept spec exists and matches generator pattern', () => {
    const source = readSpec('framework', 'solidity-gen');
    const ast = parseConceptFile(source);

    expect(ast.name).toBe('SolidityGen');
    expect(ast.actions).toHaveLength(2);
    expect(ast.actions.map(a => a.name)).toContain('generate');
    expect(ast.actions.map(a => a.name)).toContain('register');
    const generateAction = ast.actions.find(a => a.name === 'generate')!;
    expect(generateAction.params.map(p => p.name)).toContain('manifest');
    expect(generateAction.params.map(p => p.name)).toContain('spec');
    expect(generateAction.variants.map(v => v.name)).toContain('ok');
    expect(generateAction.variants.map(v => v.name)).toContain('error');
  });

  it('generates Solidity contract for Password concept', async () => {
    const source = readSpec('app', 'password');
    const ast = parseConceptFile(source);
    const manifest = await generateManifest(ast);

    const storage = createInMemoryStorage();
    const result = await solidityGenHandler.generate(
      { spec: 'test', manifest },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    expect(files.length).toBeGreaterThanOrEqual(1); // At least the .sol file

    // Check contract file
    const contractFile = files.find(f => f.path.endsWith('.sol') && !f.path.endsWith('.t.sol'));
    expect(contractFile).toBeDefined();
    expect(contractFile!.content).toContain('contract Password');
    expect(contractFile!.content).toContain('pragma solidity');
    expect(contractFile!.content).toContain('SPDX-License-Identifier');
    expect(contractFile!.content).toContain('function');
  });

  it('generates Foundry test harness when invariants exist', async () => {
    const source = readSpec('app', 'password');
    const ast = parseConceptFile(source);
    const manifest = await generateManifest(ast);

    const storage = createInMemoryStorage();
    const result = await solidityGenHandler.generate(
      { spec: 'test', manifest },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];

    if (manifest.invariants.length > 0) {
      const testFile = files.find(f => f.path.endsWith('.t.sol'));
      expect(testFile).toBeDefined();
      expect(testFile!.content).toContain('forge-std/Test.sol');
      expect(testFile!.content).toContain('is Test');
      expect(testFile!.content).toContain('function test_invariant');
    }
  });

  it('uses correct Solidity types', async () => {
    const source = readSpec('app', 'password');
    const ast = parseConceptFile(source);
    const manifest = await generateManifest(ast);

    const storage = createInMemoryStorage();
    const result = await solidityGenHandler.generate(
      { spec: 'test', manifest },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    const contractFile = files.find(f => f.path.endsWith('.sol') && !f.path.endsWith('.t.sol'));
    expect(contractFile).toBeDefined();

    // Solidity-specific type assertions
    const content = contractFile!.content;
    // Should use Solidity types, not TypeScript/Rust types
    expect(content).not.toContain(': String;'); // Rust-style
    expect(content).not.toContain(': string;'); // only in struct fields or function params
    expect(content).toContain('string'); // Solidity string type should appear somewhere
  });

  it('handles concepts without invariants (no test file)', async () => {
    const source = readSpec('framework', 'schema-gen');
    const ast = parseConceptFile(source);
    const manifest = await generateManifest(ast);

    const storage = createInMemoryStorage();
    const result = await solidityGenHandler.generate(
      { spec: 'test', manifest },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    const testFile = files.find(f => f.path.endsWith('.t.sol'));

    if (manifest.invariants.length === 0) {
      expect(testFile).toBeUndefined();
    }
  });

  it('returns error for invalid manifest', async () => {
    const storage = createInMemoryStorage();
    const result = await solidityGenHandler.generate(
      { spec: 'test', manifest: {} },
      storage,
    );

    expect(result.variant).toBe('error');
  });
});
