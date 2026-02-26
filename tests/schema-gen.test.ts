// ============================================================
// SchemaGen Tests
//
// Validates SchemaGen concept handler and ConceptManifest
// structure, including relation schemas, action schemas,
// invariant schemas, GraphQL/JSON schemas.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  createInMemoryStorage,
} from '../kernel/src/index.js';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler.js';
import { schemaGenHandler } from '../handlers/ts/framework/schema-gen.handler.js';
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
// 1. SchemaGen Concept (produces ConceptManifest)
// ============================================================

describe('SchemaGen Concept', () => {
  it('generates ConceptManifest from Password concept', async () => {
    const storage = createInMemoryStorage();
    const ast = parseConceptFile(readSpec('app', 'password'));
    const result = await schemaGenHandler.generate(
      { spec: 'test-spec-1', ast },
      storage,
    );

    expect(result.variant).toBe('ok');
    const manifest = result.manifest as ConceptManifest;
    expect(manifest.graphqlSchema).toContain('type PasswordState');
    expect(manifest.graphqlSchema).toContain('type PasswordEntry');
    expect(manifest.graphqlSchema).toContain('hash:');
    expect(manifest.graphqlSchema).toContain('salt:');
    expect(manifest.graphqlSchema).toContain('extend type Query');
    expect(manifest.graphqlSchema).toContain('password_entry');
    expect(manifest.graphqlSchema).toContain('password_entries');
  });

  it('generates JSON schemas for all actions', async () => {
    const storage = createInMemoryStorage();
    const ast = parseConceptFile(readSpec('app', 'password'));
    const result = await schemaGenHandler.generate(
      { spec: 'test-spec-1', ast },
      storage,
    );

    expect(result.variant).toBe('ok');
    const manifest = result.manifest as ConceptManifest;

    // Password has 3 actions: set, check, validate
    expect(Object.keys(manifest.jsonSchemas.invocations)).toHaveLength(3);

    // set action: ok + invalid completions
    expect(manifest.jsonSchemas.completions['set']['ok']).toBeDefined();
    expect(manifest.jsonSchemas.completions['set']['invalid']).toBeDefined();

    // Validate invocation schema
    const setInvocation = manifest.jsonSchemas.invocations['set'] as any;
    expect(setInvocation.$id).toContain('set/invocation');
    expect(setInvocation.properties.input.properties.user).toBeDefined();
    expect(setInvocation.properties.input.properties.password).toBeDefined();

    // Validate completion schema
    const setOk = manifest.jsonSchemas.completions['set']['ok'] as any;
    expect(setOk.$id).toContain('set/completion/ok');
    expect(setOk.properties.variant.const).toBe('ok');
  });

  it('stores result in storage', async () => {
    const storage = createInMemoryStorage();
    const ast = parseConceptFile(readSpec('app', 'echo'));
    await schemaGenHandler.generate({ spec: 'spec-42', ast }, storage);

    const stored = await storage.get('manifests', 'spec-42');
    expect(stored).not.toBeNull();
    expect((stored!.manifest as ConceptManifest).graphqlSchema).toBeTruthy();
  });
});

// ============================================================
// 2. ConceptManifest Structure Validation
// ============================================================

describe('ConceptManifest Structure', () => {
  it('Password manifest has correct top-level structure', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);

    expect(manifest.uri).toBe('urn:copf/Password');
    expect(manifest.name).toBe('Password');
    expect(manifest.typeParams).toHaveLength(1);
    expect(manifest.typeParams[0].name).toBe('U');
    expect(manifest.typeParams[0].wireType).toBe('string');
    expect(manifest.capabilities).toContain('crypto');
    expect(manifest.purpose).toContain('salted hashing');
  });

  it('Password manifest has correct relation schemas', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);

    // hash: U -> Bytes and salt: U -> Bytes merge into one "entries" relation
    expect(manifest.relations).toHaveLength(1);
    const entries = manifest.relations[0];
    expect(entries.name).toBe('entries');
    expect(entries.source).toBe('merged');
    expect(entries.keyField.name).toBe('u');
    expect(entries.keyField.paramRef).toBe('U');
    expect(entries.fields).toHaveLength(2);

    const hashField = entries.fields.find(f => f.name === 'hash')!;
    expect(hashField.type).toEqual({ kind: 'primitive', primitive: 'Bytes' });
    expect(hashField.optional).toBe(false);

    const saltField = entries.fields.find(f => f.name === 'salt')!;
    expect(saltField.type).toEqual({ kind: 'primitive', primitive: 'Bytes' });
  });

  it('Password manifest has correct action schemas', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);

    expect(manifest.actions).toHaveLength(3);

    // set action
    const setAction = manifest.actions.find(a => a.name === 'set')!;
    expect(setAction.params).toHaveLength(2);
    expect(setAction.params[0].name).toBe('user');
    expect(setAction.params[0].type).toEqual({ kind: 'param', paramRef: 'U' });
    expect(setAction.params[1].name).toBe('password');
    expect(setAction.params[1].type).toEqual({ kind: 'primitive', primitive: 'String' });
    expect(setAction.variants).toHaveLength(2);
    expect(setAction.variants[0].tag).toBe('ok');
    expect(setAction.variants[1].tag).toBe('invalid');

    // check action
    const checkAction = manifest.actions.find(a => a.name === 'check')!;
    expect(checkAction.variants).toHaveLength(2);
    expect(checkAction.variants[0].tag).toBe('ok');
    expect(checkAction.variants[0].fields[0].name).toBe('valid');
    expect(checkAction.variants[0].fields[0].type).toEqual({ kind: 'primitive', primitive: 'Bool' });

    // validate action
    const validateAction = manifest.actions.find(a => a.name === 'validate')!;
    expect(validateAction.params).toHaveLength(1);
    expect(validateAction.variants).toHaveLength(1);
  });

  it('Password manifest has correct invariant schemas', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);

    expect(manifest.invariants).toHaveLength(1);
    const inv = manifest.invariants[0];

    expect(inv.description).toContain('invariant 1');
    expect(inv.description).toContain('set');
    expect(inv.description).toContain('check');

    // Free variable: x with deterministic test value
    expect(inv.freeVariables).toHaveLength(1);
    expect(inv.freeVariables[0].name).toBe('x');
    expect(inv.freeVariables[0].testValue).toBe('u-test-invariant-001');

    // Setup: set(user: x, password: "secret") -> ok(user: x)
    expect(inv.setup).toHaveLength(1);
    expect(inv.setup[0].action).toBe('set');
    expect(inv.setup[0].expectedVariant).toBe('ok');

    // Assertions: two checks
    expect(inv.assertions).toHaveLength(2);
    expect(inv.assertions[0].action).toBe('check');
    expect(inv.assertions[0].expectedVariant).toBe('ok');
    expect(inv.assertions[1].action).toBe('check');
  });

  it('Password manifest has correct JSON schemas', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);

    // Invocation schemas
    expect(manifest.jsonSchemas.invocations['set']).toBeDefined();
    expect(manifest.jsonSchemas.invocations['check']).toBeDefined();
    expect(manifest.jsonSchemas.invocations['validate']).toBeDefined();

    // Completion schemas
    expect(manifest.jsonSchemas.completions['set']['ok']).toBeDefined();
    expect(manifest.jsonSchemas.completions['set']['invalid']).toBeDefined();
    expect(manifest.jsonSchemas.completions['check']['ok']).toBeDefined();
    expect(manifest.jsonSchemas.completions['check']['notfound']).toBeDefined();

    // Verify invocation schema structure
    const setInv = manifest.jsonSchemas.invocations['set'] as any;
    expect(setInv.$id).toBe('urn:copf/Password/set/invocation');
    expect(setInv.properties.input.properties.user.type).toBe('string');
    expect(setInv.properties.input.properties.password.type).toBe('string');
  });

  it('SpecParser manifest has set-valued and merged relations', async () => {
    const ast = parseConceptFile(readSpec('framework', 'spec-parser'));
    const manifest = await generateManifest(ast);

    // SpecParser state: specs: set S, ast: S -> AST
    // 'set S' → set-valued relation; 'S -> AST' → merged entries relation
    const mergedRel = manifest.relations.find(r => r.source === 'merged');
    const setRel = manifest.relations.find(r => r.source === 'set-valued');
    expect(mergedRel).toBeDefined();
    expect(setRel).toBeDefined();
    expect(mergedRel!.fields.find(f => f.name === 'ast')).toBeDefined();
    expect(setRel!.name).toBe('specs');
  });
});
