// ============================================================
// SpecParser Tests
//
// Validates concept spec parsing — both the raw parser function
// and the SpecParser concept handler.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  createInMemoryStorage,
} from '../kernel/src/index.js';
import { parseConceptFile } from '../implementations/typescript/framework/spec-parser.impl.js';
import type { ConceptAST } from '../kernel/src/types.js';

// Stage 1 concept handlers
import { specParserHandler } from '../implementations/typescript/framework/spec-parser.impl.js';

// Paths to spec files
const SPECS_DIR = resolve(__dirname, '..', 'specs');

// Helper: read a spec file
function readSpec(category: string, name: string): string {
  return readFileSync(resolve(SPECS_DIR, category, `${name}.concept`), 'utf-8');
}

// ============================================================
// 1. Concept Spec Parsing
// ============================================================

describe('Stage 1 — Concept Specs', () => {
  it('parses all 7 framework concept specs', () => {
    const specNames = [
      'spec-parser', 'schema-gen', 'typescript-gen',
      'sync-parser', 'sync-compiler',
      'action-log', 'registry',
    ];

    for (const name of specNames) {
      const source = readSpec('framework', name);
      const ast = parseConceptFile(source);
      expect(ast.name).toBeTruthy();
      expect(ast.actions.length).toBeGreaterThan(0);
    }
  });

  it('SpecParser spec has correct structure', () => {
    const ast = parseConceptFile(readSpec('framework', 'spec-parser'));
    expect(ast.name).toBe('SpecParser');
    expect(ast.typeParams).toEqual(['S']);
    expect(ast.state).toHaveLength(2); // specs, ast
    expect(ast.actions).toHaveLength(1); // parse
    expect(ast.actions[0].name).toBe('parse');
    expect(ast.actions[0].variants).toHaveLength(2); // ok, error
  });

  it('Registry spec has correct structure', () => {
    const ast = parseConceptFile(readSpec('framework', 'registry'));
    expect(ast.name).toBe('Registry');
    expect(ast.typeParams).toEqual(['C']);
    expect(ast.state).toHaveLength(4); // concepts, uri, transport, available
    expect(ast.actions).toHaveLength(3); // register, deregister, heartbeat
  });

  it('ActionLog spec has correct structure', () => {
    const ast = parseConceptFile(readSpec('framework', 'action-log'));
    expect(ast.name).toBe('ActionLog');
    expect(ast.typeParams).toEqual(['R']);
    expect(ast.actions).toHaveLength(3); // append, addEdge, query
  });
});

// ============================================================
// 2. SpecParser Concept Handler
// ============================================================

describe('Stage 1 — SpecParser Concept', () => {
  it('parses a valid concept source', async () => {
    const storage = createInMemoryStorage();
    const source = readSpec('app', 'password');
    const result = await specParserHandler.parse({ source }, storage);

    expect(result.variant).toBe('ok');
    expect(result.spec).toBeTruthy();
    expect((result.ast as ConceptAST).name).toBe('Password');
    expect((result.ast as ConceptAST).actions).toHaveLength(3);
  });

  it('stores spec and AST in storage', async () => {
    const storage = createInMemoryStorage();
    const source = readSpec('app', 'echo');
    const result = await specParserHandler.parse({ source }, storage);

    expect(result.variant).toBe('ok');
    const specId = result.spec as string;

    // Check that the spec is stored
    const specs = await storage.find('specs');
    expect(specs).toHaveLength(1);

    // Check that the AST is stored
    const astRecord = await storage.get('ast', specId);
    expect(astRecord).not.toBeNull();
  });

  it('returns error for invalid source', async () => {
    const storage = createInMemoryStorage();
    const result = await specParserHandler.parse({ source: 'not valid {{{ concept' }, storage);

    expect(result.variant).toBe('error');
    expect(result.message).toBeTruthy();
  });

  it('parses all framework specs through the concept handler', async () => {
    const storage = createInMemoryStorage();
    const specNames = [
      'spec-parser', 'schema-gen', 'typescript-gen',
      'sync-parser', 'sync-compiler',
      'action-log', 'registry',
    ];

    for (const name of specNames) {
      const source = readSpec('framework', name);
      const result = await specParserHandler.parse({ source }, storage);
      expect(result.variant).toBe('ok');
    }

    // All 7 specs should be stored
    const allSpecs = await storage.find('specs');
    expect(allSpecs).toHaveLength(7);
  });
});
