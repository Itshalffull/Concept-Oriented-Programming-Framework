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
} from '../runtime/index.js';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler.js';
import type { ConceptAST } from '../runtime/types.js';

// Framework concept handlers
import { specParserHandler } from '../handlers/ts/framework/spec-parser.handler.js';

// Paths to spec files
const SPECS_DIR = resolve(__dirname, '..', 'specs');

// Helper: read a spec file
function readSpec(category: string, name: string): string {
  return readFileSync(resolve(SPECS_DIR, category, `${name}.concept`), 'utf-8');
}

// ============================================================
// 1. Concept Spec Parsing
// ============================================================

describe('Concept Specs', () => {
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

describe('SpecParser Concept', () => {
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

// ============================================================
// 3. Formal Verification Invariant Language Extensions
// ============================================================

describe('Invariant Language Extensions', () => {
  it('parses bare invariant with kind=example and no name', () => {
    const ast = parseConceptFile(`
concept Test [T] {
  purpose { Test }
  state { items: set T }
  actions { action create(item: T) { -> ok(item: T) { Creates. } } action get(item: T) { -> ok(item: T) { Gets. } } }
  invariant {
    after create(item: x) -> ok(item: x)
    then get(item: x) -> ok(item: x)
  }
}
`);
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
    expect(ast.invariants[0].kind).toBe('example');
    expect(ast.invariants[0].name).toBeUndefined();
    expect(ast.invariants[0].afterPatterns).toHaveLength(1);
    expect(ast.invariants[0].thenPatterns).toHaveLength(1);
  });

  it('parses named example at top level', () => {
    const ast = parseConceptFile(`
concept Test [T] {
  purpose { Test }
  state { items: set T }
  actions { action create(item: T) { -> ok(item: T) { Creates. } } action get(item: T) { -> ok(item: T) { Gets. } } }
  example "happy path": {
    after create(item: x) -> ok(item: x)
    then get(item: x) -> ok(item: x)
  }
}
`);
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
    expect(ast.invariants[0].kind).toBe('example');
    expect(ast.invariants[0].name).toBe('happy path');
    expect(ast.invariants[0].afterPatterns).toHaveLength(1);
  });

  it('parses forall with given/in binding', () => {
    const ast = parseConceptFile(`
concept Test [T] {
  purpose { Test }
  state { items: set T; kind: T -> String }
  actions { action define(kind: String) { -> ok(item: T) { Defines. } } }
  forall "valid kinds accepted": {
    given kind in {"invariant", "precondition", "postcondition"}
    after define(kind: kind) -> ok(item: _)
  }
}
`);
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
    expect(ast.invariants[0].kind).toBe('forall');
    expect(ast.invariants[0].name).toBe('valid kinds accepted');
    expect(ast.invariants[0].quantifiers).toHaveLength(1);
    expect(ast.invariants[0].quantifiers![0].variable).toBe('kind');
    expect(ast.invariants[0].quantifiers![0].domain.type).toBe('set_literal');
    if (ast.invariants[0].quantifiers![0].domain.type === 'set_literal') {
      expect(ast.invariants[0].quantifiers![0].domain.values).toEqual(['invariant', 'precondition', 'postcondition']);
    }
  });

  it('parses always with forall/in quantifier and predicate', () => {
    const ast = parseConceptFile(`
concept Test [T] {
  purpose { Test }
  state { items: set T; status: T -> String }
  actions { action check(item: T) { -> ok() { Checks. } } }
  always "status consistency": {
    forall p in items:
      p.status in ["active", "inactive"]
  }
}
`);
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
    expect(ast.invariants[0].kind).toBe('always');
    expect(ast.invariants[0].name).toBe('status consistency');
    expect(ast.invariants[0].quantifiers).toHaveLength(1);
    expect(ast.invariants[0].quantifiers![0].variable).toBe('p');
    expect(ast.invariants[0].quantifiers![0].domain).toEqual({ type: 'state_field', name: 'items' });
    expect(ast.invariants[0].thenPatterns).toHaveLength(1);
    expect(ast.invariants[0].thenPatterns[0].kind).toBe('assertion');
  });

  it('parses never with exists quantifier', () => {
    const ast = parseConceptFile(`
concept Test [T] {
  purpose { Test }
  state { items: set T; status: T -> String }
  actions { action check(item: T) { -> ok() { Checks. } } }
  never "orphaned items": {
    exists p in items:
      p.status = "deleted"
  }
}
`);
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
    expect(ast.invariants[0].kind).toBe('never');
    expect(ast.invariants[0].name).toBe('orphaned items');
    expect(ast.invariants[0].quantifiers).toHaveLength(1);
    expect(ast.invariants[0].quantifiers![0].variable).toBe('p');
  });

  it('parses eventually with forall/where quantifier', () => {
    const ast = parseConceptFile(`
concept Test [T] {
  purpose { Test }
  state { runs: set T; status: T -> String }
  actions { action start(run: T) { -> ok() { Starts. } } }
  eventually "runs terminate": {
    forall r in runs where r.status = "running":
      r.status in ["completed", "timeout"]
  }
}
`);
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
    expect(ast.invariants[0].kind).toBe('eventually');
    expect(ast.invariants[0].name).toBe('runs terminate');
    expect(ast.invariants[0].quantifiers).toHaveLength(1);
    expect(ast.invariants[0].quantifiers![0].whereCondition).toBeDefined();
  });

  it('parses action requires/ensures contracts', () => {
    const ast = parseConceptFile(`
concept Test [T] {
  purpose { Test }
  state { items: set T; kind: T -> String }
  actions {
    action define(kind: String) {
      -> ok(item: T) { Defines. }
      -> invalid(message: String) { Invalid kind. }
    }
  }
  invariant {
    action define {
      requires: kind in ["invariant", "precondition"]
      ensures ok: result.kind = kind
      ensures invalid: kind != "invariant"
    }
  }
}
`);
    expect(ast.invariants.length).toBeGreaterThanOrEqual(1);
    expect(ast.invariants[0].kind).toBe('requires_ensures');
    expect(ast.invariants[0].targetAction).toBe('define');
    expect(ast.invariants[0].contracts).toHaveLength(3);
    expect(ast.invariants[0].contracts![0].kind).toBe('requires');
    expect(ast.invariants[0].contracts![1].kind).toBe('ensures');
    expect(ast.invariants[0].contracts![1].variant).toBe('ok');
    expect(ast.invariants[0].contracts![2].kind).toBe('ensures');
    expect(ast.invariants[0].contracts![2].variant).toBe('invalid');
  });

  it('parses multiple invariant constructs in one concept', () => {
    const ast = parseConceptFile(`
concept Test [T] {
  purpose { Test }
  state { items: set T; status: T -> String }
  actions {
    action create(item: T) { -> ok(item: T) { Creates. } }
    action get(item: T) { -> ok(item: T) { Gets. } }
  }
  example "happy path": {
    after create(item: x) -> ok(item: x)
    then get(item: x) -> ok(item: x)
  }
  always "status valid": {
    forall p in items:
      p.status in ["active", "inactive"]
  }
  never "ghost items": {
    exists p in items:
      p.status = "ghost"
  }
}
`);
    expect(ast.invariants).toHaveLength(3);
    expect(ast.invariants[0].kind).toBe('example');
    expect(ast.invariants[0].name).toBe('happy path');
    expect(ast.invariants[1].kind).toBe('always');
    expect(ast.invariants[1].name).toBe('status valid');
    expect(ast.invariants[2].kind).toBe('never');
    expect(ast.invariants[2].name).toBe('ghost items');
  });
});
