// ============================================================
// Stage 4 — CodeGen Refactor Tests
//
// From Section 10.1:
// "Stage 4: CodeGen Refactor — Split the single CodeGen concept
//  into SchemaGen (producing ConceptManifest) + per-language
//  generators (TypeScriptGen, RustGen, etc.)."
//
// These tests verify that:
// 1. SchemaGen produces well-formed ConceptManifest structures
// 2. The manifest contains relation schemas, action schemas,
//    invariant schemas, GraphQL/JSON schemas
// 3. TypeScriptGen produces identical output from manifests
//    as the pre-refactor CodeGen did from raw ASTs
// 4. The refactored pipeline (SpecParser → SchemaGen → TypeScriptGen)
//    works end-to-end through the self-hosted kernel
// 5. Adding a new language target requires only a new concept + sync
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  createKernel,
  createSelfHostedKernel,
  createInMemoryStorage,
  createConceptRegistry,
  parseConceptFile,
  parseSyncFile,
} from '../kernel/src/index.js';
import type {
  ConceptHandler,
  ConceptAST,
  ConceptManifest,
  ResolvedType,
} from '../kernel/src/types.js';

// Stage 1 concept handlers
import { specParserHandler } from '../implementations/typescript/framework/spec-parser.impl.js';
import { schemaGenHandler } from '../implementations/typescript/framework/schema-gen.impl.js';
import { typescriptGenHandler } from '../implementations/typescript/framework/typescript-gen.impl.js';
import { actionLogHandler } from '../implementations/typescript/framework/action-log.impl.js';
import { registryHandler } from '../implementations/typescript/framework/registry.impl.js';
import { syncParserHandler } from '../implementations/typescript/framework/sync-parser.impl.js';
import { syncCompilerHandler } from '../implementations/typescript/framework/sync-compiler.impl.js';

// Stage 3: SyncEngine concept handler
import { createSyncEngineHandler } from '../implementations/typescript/framework/sync-engine.impl.js';

const SPECS_DIR = resolve(__dirname, '..', 'specs');
const SYNCS_DIR = resolve(__dirname, '..', 'syncs');

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
// 1. ConceptManifest Structure Validation
//
// Verify that SchemaGen produces well-formed ConceptManifest
// structures with all required fields.
// ============================================================

describe('Stage 4 — ConceptManifest Structure', () => {
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

// ============================================================
// 2. TypeScriptGen Output Identity
//
// Verify that TypeScriptGen produces identical output from
// manifests as the pre-refactor CodeGen did from raw ASTs.
// ============================================================

describe('Stage 4 — TypeScriptGen Output Identity', () => {
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

// ============================================================
// 3. New Pipeline Syncs
//
// Verify that the refactored pipeline syncs correctly wire
// SchemaGen → TypeScriptGen.
// ============================================================

describe('Stage 4 — Pipeline Syncs', () => {
  it('GenerateManifest sync replaces GenerateSchemas', async () => {
    const source = readFileSync(
      resolve(SYNCS_DIR, 'framework', 'compiler-pipeline.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(source);

    const genManifest = syncs.find(s => s.name === 'GenerateManifest');
    expect(genManifest).toBeDefined();

    // Should NOT have the old names
    expect(syncs.find(s => s.name === 'GenerateSchemas')).toBeUndefined();
    expect(syncs.find(s => s.name === 'GenerateCode')).toBeUndefined();
  });

  it('GenerateTypeScript sync replaces GenerateCode', async () => {
    const source = readFileSync(
      resolve(SYNCS_DIR, 'framework', 'compiler-pipeline.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(source);

    const genTS = syncs.find(s => s.name === 'GenerateTypeScript');
    expect(genTS).toBeDefined();

    // GenerateTypeScript has only ONE when pattern (simpler than old GenerateCode)
    expect(genTS!.when).toHaveLength(1);
    expect(genTS!.when[0].concept).toBe('urn:copf/SchemaGen');
    expect(genTS!.when[0].action).toBe('generate');
  });

  it('TypeScriptGen spec exists and replaces CodeGen spec', async () => {
    const tsGenSource = readSpec('framework', 'typescript-gen');
    const ast = parseConceptFile(tsGenSource);

    expect(ast.name).toBe('TypeScriptGen');
    expect(ast.actions).toHaveLength(1);
    expect(ast.actions[0].name).toBe('generate');
    // Takes manifest instead of ast + language
    expect(ast.actions[0].params.map(p => p.name)).toContain('manifest');
    expect(ast.actions[0].params.map(p => p.name)).not.toContain('language');
  });

  it('SchemaGen spec updated to produce ConceptManifest', async () => {
    const sgSource = readSpec('framework', 'schema-gen');
    const ast = parseConceptFile(sgSource);

    expect(ast.name).toBe('SchemaGen');
    expect(ast.actions[0].name).toBe('generate');
    // Returns manifest variant
    expect(ast.actions[0].variants[0].name).toBe('ok');
    expect(ast.actions[0].variants[0].params[0].name).toBe('manifest');
  });
});

// ============================================================
// 4. Self-Hosted Kernel — Full Pipeline
//
// The Stage 4 refactored pipeline running on the self-hosted
// kernel from Stage 3.
// ============================================================

describe('Stage 4 — Self-Hosted Kernel: Refactored Pipeline', () => {
  it('compiler pipeline works through the self-hosted kernel', async () => {
    const registry = createConceptRegistry();
    const { handler, log } = createSyncEngineHandler(registry);
    const kernel = createSelfHostedKernel(handler, log, registry);

    // Register Stage 1 concepts (with TypeScriptGen replacing CodeGen)
    kernel.registerConcept('urn:copf/SpecParser', specParserHandler);
    kernel.registerConcept('urn:copf/SchemaGen', schemaGenHandler);
    kernel.registerConcept('urn:copf/TypeScriptGen', typescriptGenHandler);
    kernel.registerConcept('urn:copf/ActionLog', actionLogHandler);
    kernel.registerConcept('urn:copf/Registry', registryHandler);

    // Load the refactored compiler pipeline syncs
    const syncSource = readFileSync(
      resolve(SYNCS_DIR, 'framework', 'compiler-pipeline.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(syncSource);
    for (const sync of syncs) {
      kernel.registerSync(sync);
    }

    // Parse a spec through the new pipeline
    const passwordSpec = readSpec('app', 'password');
    const result = await kernel.invokeConcept(
      'urn:copf/SpecParser',
      'parse',
      { source: passwordSpec },
    );

    expect(result.variant).toBe('ok');
    expect((result.ast as ConceptAST).name).toBe('Password');
  });

  it('full pipeline produces manifest for framework spec', async () => {
    const storage = createInMemoryStorage();

    // SpecParser → SchemaGen → TypeScriptGen (manual pipeline)
    const source = readSpec('framework', 'schema-gen');
    const parseResult = await specParserHandler.parse({ source }, storage);
    expect(parseResult.variant).toBe('ok');

    const manifest = await generateManifest(parseResult.ast as ConceptAST);

    // Verify the SchemaGen manifest describes itself
    expect(manifest.name).toBe('SchemaGen');
    expect(manifest.actions).toHaveLength(1);
    expect(manifest.actions[0].name).toBe('generate');
    expect(manifest.actions[0].variants[0].tag).toBe('ok');
    expect(manifest.actions[0].variants[0].fields[0].name).toBe('manifest');

    // Generate TypeScript from the manifest
    const genResult = await typescriptGenHandler.generate(
      { spec: 'sg-1', manifest },
      storage,
    );
    expect(genResult.variant).toBe('ok');

    const files = genResult.files as { path: string; content: string }[];
    expect(files.find(f => f.path === 'schemagen.handler.ts')).toBeDefined();
    expect(files.find(f => f.path === 'schemagen.types.ts')).toBeDefined();
    expect(files.find(f => f.path === 'schemagen.adapter.ts')).toBeDefined();
  });
});

// ============================================================
// 5. Extensibility Validation
//
// Verify the key property: adding a new language target requires
// only a new generator concept + one sync, no existing code changes.
// ============================================================

describe('Stage 4 — Extensibility', () => {
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
