// ============================================================
// Conformance Test Generation Tests
//
// Validates that TypeScriptGen produces correct conformance test
// code for app concepts that have invariants (Section 7.4).
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
// Conformance Test Generation (Section 7.4)
// ============================================================

describe('Conformance Test Generation (Section 7.4)', () => {
  it('generates conformance test for Password concept', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'pwd-1', manifest },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];

    // Should include a conformance test file
    const testFile = files.find(f => f.path === 'password.conformance.test.ts');
    expect(testFile).toBeDefined();

    const content = testFile!.content;

    // Section 7.4: imports
    expect(content).toContain('import { describe, it, expect } from "vitest"');
    expect(content).toContain('import { createInMemoryStorage } from "@copf/runtime"');
    expect(content).toContain('passwordHandler');

    // Section 7.4 Rule 1: free variables get deterministic IDs
    expect(content).toContain('u-test-invariant-001');

    // Section 7.4 Rule 2: after clause becomes action calls
    expect(content).toContain('passwordHandler.set(');
    expect(content).toContain('expect(step1.variant).toBe("ok")');

    // Section 7.4 Rule 3: then clause becomes assertion calls
    expect(content).toContain('passwordHandler.check(');
    expect(content).toContain('expect(step2.variant).toBe("ok")');
    expect(content).toContain('.valid).toBe(true)');

    // Section 7.4 Rule 4: literal values asserted exactly
    expect(content).toContain('"secret123"');
    expect(content).toContain('"wrongpass"');
    expect(content).toContain('.valid).toBe(false)');
  });

  it('generates conformance test for Echo concept', async () => {
    const ast = parseConceptFile(readSpec('app', 'echo'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'echo-1', manifest },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const testFile = files.find(f => f.path === 'echo.conformance.test.ts');
    expect(testFile).toBeDefined();
    expect(testFile!.content).toContain('echoHandler.send(');
    expect(testFile!.content).toContain('"hello"');
  });

  it('generates conformance test for JWT concept', async () => {
    const ast = parseConceptFile(readSpec('app', 'jwt'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'jwt-1', manifest },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const testFile = files.find(f => f.path === 'jwt.conformance.test.ts');
    expect(testFile).toBeDefined();

    const content = testFile!.content;
    // after generate(user: x) -> ok(token: t)
    expect(content).toContain('jwtHandler.generate(');
    // then verify(token: t) -> ok(user: x)
    expect(content).toContain('jwtHandler.verify(');
    // Variable t should be used consistently
    expect(content).toContain('u-test-invariant-001');
    expect(content).toContain('u-test-invariant-002');
  });

  it('generates conformance test for User concept', async () => {
    const ast = parseConceptFile(readSpec('app', 'user'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'u-1', manifest },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const testFile = files.find(f => f.path === 'user.conformance.test.ts');
    expect(testFile).toBeDefined();

    const content = testFile!.content;
    // after register(user: x, name: "alice", email: "a@b.com") -> ok(user: x)
    expect(content).toContain('userHandler.register(');
    expect(content).toContain('"alice"');
    expect(content).toContain('"a@b.com"');
    // then register(user: y, name: "alice", email: "c@d.com") -> error(...)
    expect(content).toContain('.toBe("error")');
  });

  it('does not generate conformance test for specs without invariants', async () => {
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
    const result = await typescriptGenHandler.generate(
      { spec: 'sp-1', manifest },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const testFile = files.find(f => f.path.includes('conformance'));
    expect(testFile).toBeUndefined();
  });
});
