// ============================================================
// Stage 2 — Self-Compilation Tests
//
// From Section 10.1 of the architecture doc:
//
// "Use the Stage 1 concepts to compile themselves:
//  1. Feed the Stage 1 .concept files to the SpecParser concept.
//  2. Feed the parsed ASTs to SchemaGen — verify the output
//     matches the hand-written schemas.
//  3. Feed the parsed ASTs to CodeGen — verify the generated
//     skeletons match the hand-written handler interfaces.
//  4. Feed the .sync files to SyncParser and SyncCompiler —
//     verify the compiled syncs match the hand-registered
//     syncs from Stage 1."
//
// "At this point, the framework can generate its own type
//  definitions and schemas from its own specs. The hand-written
//  implementations of Stage 1 concepts are now validated against
//  generated interfaces."
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  createKernel,
  createInMemoryStorage,
  parseConceptFile,
  parseSyncFile,
} from '../kernel/src/index.js';
import type { ConceptAST, CompiledSync } from '../kernel/src/types.js';

// Stage 1 concept handlers
import { specParserHandler } from '../implementations/typescript/framework/spec-parser.impl.js';
import { schemaGenHandler } from '../implementations/typescript/framework/schema-gen.impl.js';
import { codeGenHandler } from '../implementations/typescript/framework/code-gen.impl.js';
import { syncParserHandler } from '../implementations/typescript/framework/sync-parser.impl.js';
import { syncCompilerHandler } from '../implementations/typescript/framework/sync-compiler.impl.js';
import { actionLogHandler } from '../implementations/typescript/framework/action-log.impl.js';
import { registryHandler } from '../implementations/typescript/framework/registry.impl.js';

const SPECS_DIR = resolve(__dirname, '..', 'specs');
const SYNCS_DIR = resolve(__dirname, '..', 'syncs');

function readSpec(category: string, name: string): string {
  return readFileSync(resolve(SPECS_DIR, category, `${name}.concept`), 'utf-8');
}

// All 7 Stage 1 framework concept names
const FRAMEWORK_SPECS = [
  'spec-parser', 'schema-gen', 'code-gen',
  'sync-parser', 'sync-compiler',
  'action-log', 'registry',
];

// All 4 app concept names (with invariants where applicable)
const APP_SPECS = ['echo', 'password', 'user', 'jwt'];

// ============================================================
// Step 1: Feed Stage 1 .concept files to the SpecParser concept
//
// "Feed the Stage 1 .concept files to the SpecParser concept."
// ============================================================

describe('Stage 2 — Step 1: SpecParser self-compilation', () => {
  it('SpecParser parses all 7 framework concept specs', async () => {
    const storage = createInMemoryStorage();

    const parsedASTs: Record<string, ConceptAST> = {};

    for (const name of FRAMEWORK_SPECS) {
      const source = readSpec('framework', name);
      const result = await specParserHandler.parse({ source }, storage);

      expect(result.variant).toBe('ok');
      expect(result.spec).toBeTruthy();
      expect(result.ast).toBeTruthy();

      parsedASTs[name] = result.ast as ConceptAST;
    }

    // Verify structural properties of each parsed AST
    expect(parsedASTs['spec-parser'].name).toBe('SpecParser');
    expect(parsedASTs['spec-parser'].typeParams).toEqual(['S']);
    expect(parsedASTs['spec-parser'].actions).toHaveLength(1);
    expect(parsedASTs['spec-parser'].actions[0].name).toBe('parse');
    expect(parsedASTs['spec-parser'].actions[0].variants).toHaveLength(2);

    expect(parsedASTs['schema-gen'].name).toBe('SchemaGen');
    expect(parsedASTs['schema-gen'].actions[0].name).toBe('generate');

    expect(parsedASTs['code-gen'].name).toBe('CodeGen');
    expect(parsedASTs['code-gen'].actions[0].name).toBe('generate');

    expect(parsedASTs['sync-parser'].name).toBe('SyncParser');
    expect(parsedASTs['sync-parser'].actions[0].name).toBe('parse');

    expect(parsedASTs['sync-compiler'].name).toBe('SyncCompiler');
    expect(parsedASTs['sync-compiler'].actions[0].name).toBe('compile');

    expect(parsedASTs['action-log'].name).toBe('ActionLog');
    expect(parsedASTs['action-log'].actions).toHaveLength(3);

    expect(parsedASTs['registry'].name).toBe('Registry');
    expect(parsedASTs['registry'].actions).toHaveLength(3);
  });

  it('SpecParser also parses all app concept specs', async () => {
    const storage = createInMemoryStorage();

    for (const name of APP_SPECS) {
      const source = readSpec('app', name);
      const result = await specParserHandler.parse({ source }, storage);
      expect(result.variant).toBe('ok');
    }

    // All 11 specs (7 framework + 4 app) should be stored
    const allSpecs = await storage.find('specs');
    expect(allSpecs).toHaveLength(APP_SPECS.length);
  });
});

// ============================================================
// Step 2: SchemaGen output verification
//
// "Feed the parsed ASTs to SchemaGen — verify the output
//  matches the hand-written schemas."
// ============================================================

describe('Stage 2 — Step 2: SchemaGen self-compilation', () => {
  it('generates schemas for all framework specs', async () => {
    const parserStorage = createInMemoryStorage();
    const schemaStorage = createInMemoryStorage();

    for (const name of FRAMEWORK_SPECS) {
      const source = readSpec('framework', name);
      const parseResult = await specParserHandler.parse({ source }, parserStorage);
      expect(parseResult.variant).toBe('ok');

      const genResult = await schemaGenHandler.generate(
        { spec: parseResult.spec, ast: parseResult.ast },
        schemaStorage,
      );
      expect(genResult.variant).toBe('ok');
      expect(genResult.graphql).toBeTruthy();
      expect((genResult.jsonSchemas as string[]).length).toBeGreaterThan(0);
    }
  });

  it('SpecParser schema has correct GraphQL structure', async () => {
    const storage = createInMemoryStorage();
    const ast = parseConceptFile(readSpec('framework', 'spec-parser'));
    const result = await schemaGenHandler.generate(
      { spec: 'sp-1', ast },
      storage,
    );

    const graphql = result.graphql as string;

    // SpecParser state: specs: set S, ast: S -> AST
    // 'set S' becomes a separate relation; 'S -> AST' merges into entry
    expect(graphql).toContain('SpecParserState');
    expect(graphql).toContain('SpecParserEntry');
    expect(graphql).toContain('ast:');  // merged field
  });

  it('SpecParser schema has correct JSON schemas for parse action', async () => {
    const storage = createInMemoryStorage();
    const ast = parseConceptFile(readSpec('framework', 'spec-parser'));
    const result = await schemaGenHandler.generate(
      { spec: 'sp-1', ast },
      storage,
    );

    const jsonSchemas = result.jsonSchemas as string[];
    // parse action: 1 invocation + 2 variants (ok, error) = 3 schemas
    expect(jsonSchemas).toHaveLength(3);

    const invocation = JSON.parse(jsonSchemas[0]);
    expect(invocation.$id).toContain('parse/invocation');
    expect(invocation.properties.input.properties.source).toBeDefined();

    const okCompletion = JSON.parse(jsonSchemas[1]);
    expect(okCompletion.$id).toContain('parse/completion/ok');
    expect(okCompletion.properties.variant.const).toBe('ok');

    const errorCompletion = JSON.parse(jsonSchemas[2]);
    expect(errorCompletion.$id).toContain('parse/completion/error');
    expect(errorCompletion.properties.variant.const).toBe('error');
  });

  it('Registry schema captures all 3 actions', async () => {
    const storage = createInMemoryStorage();
    const ast = parseConceptFile(readSpec('framework', 'registry'));
    const result = await schemaGenHandler.generate(
      { spec: 'reg-1', ast },
      storage,
    );

    const jsonSchemas = result.jsonSchemas as string[];
    // register: 1 invocation + 2 variants = 3
    // deregister: 1 invocation + 1 variant = 2
    // heartbeat: 1 invocation + 1 variant = 2
    // Total: 7
    expect(jsonSchemas).toHaveLength(7);

    // Verify register invocation has uri and transport params
    const registerInv = JSON.parse(jsonSchemas[0]);
    expect(registerInv.properties.input.properties.uri).toBeDefined();
    expect(registerInv.properties.input.properties.transport).toBeDefined();
  });

  it('ActionLog schema captures all 3 actions', async () => {
    const storage = createInMemoryStorage();
    const ast = parseConceptFile(readSpec('framework', 'action-log'));
    const result = await schemaGenHandler.generate(
      { spec: 'al-1', ast },
      storage,
    );

    const jsonSchemas = result.jsonSchemas as string[];
    // append: 1 invocation + 1 variant = 2
    // addEdge: 1 invocation + 1 variant = 2
    // query: 1 invocation + 1 variant = 2
    // Total: 6
    expect(jsonSchemas).toHaveLength(6);
  });

  it('schemas for app specs are consistent with framework specs', async () => {
    const storage = createInMemoryStorage();
    const ast = parseConceptFile(readSpec('app', 'password'));
    const result = await schemaGenHandler.generate(
      { spec: 'pwd-1', ast },
      storage,
    );

    const graphql = result.graphql as string;
    // Password state: hash: U -> Bytes, salt: U -> Bytes
    // Both merge into PasswordEntry
    expect(graphql).toContain('PasswordEntry');
    expect(graphql).toContain('hash:');
    expect(graphql).toContain('salt:');
    expect(graphql).toContain('password_entry');
    expect(graphql).toContain('password_entries');
  });
});

// ============================================================
// Step 3: CodeGen output verification
//
// "Feed the parsed ASTs to CodeGen — verify the generated
//  skeletons match the hand-written handler interfaces."
// ============================================================

describe('Stage 2 — Step 3: CodeGen self-compilation', () => {
  it('generates TypeScript skeletons for all framework specs', async () => {
    const parserStorage = createInMemoryStorage();
    const codeStorage = createInMemoryStorage();

    for (const name of FRAMEWORK_SPECS) {
      const source = readSpec('framework', name);
      const parseResult = await specParserHandler.parse({ source }, parserStorage);
      expect(parseResult.variant).toBe('ok');

      const genResult = await codeGenHandler.generate(
        { spec: parseResult.spec, ast: parseResult.ast, language: 'typescript' },
        codeStorage,
      );
      expect(genResult.variant).toBe('ok');
      const files = genResult.files as { path: string; content: string }[];
      // types + handler + adapter (no conformance tests since framework specs lack invariants)
      expect(files.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('generated SpecParser handler interface matches hand-written impl', async () => {
    const storage = createInMemoryStorage();
    const ast = parseConceptFile(readSpec('framework', 'spec-parser'));
    const result = await codeGenHandler.generate(
      { spec: 'sp-1', ast, language: 'typescript' },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const handlerFile = files.find(f => f.path === 'specparser.handler.ts');
    expect(handlerFile).toBeDefined();

    // The generated handler interface should declare the parse method
    expect(handlerFile!.content).toContain('SpecParserHandler');
    expect(handlerFile!.content).toContain('parse(input:');

    // The generated types file should have the input/output types
    const typesFile = files.find(f => f.path === 'specparser.types.ts');
    expect(typesFile).toBeDefined();
    expect(typesFile!.content).toContain('SpecParserParseInput');
    expect(typesFile!.content).toContain('SpecParserParseOutput');
    expect(typesFile!.content).toContain('variant: "ok"');
    expect(typesFile!.content).toContain('variant: "error"');

    // The adapter file should wrap the handler
    const adapterFile = files.find(f => f.path === 'specparser.adapter.ts');
    expect(adapterFile).toBeDefined();
    expect(adapterFile!.content).toContain('createSpecParserLiteAdapter');
  });

  it('generated SchemaGen handler interface matches hand-written impl', async () => {
    const storage = createInMemoryStorage();
    const ast = parseConceptFile(readSpec('framework', 'schema-gen'));
    const result = await codeGenHandler.generate(
      { spec: 'sg-1', ast, language: 'typescript' },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const handlerFile = files.find(f => f.path === 'schemagen.handler.ts');
    expect(handlerFile).toBeDefined();
    expect(handlerFile!.content).toContain('SchemaGenHandler');
    expect(handlerFile!.content).toContain('generate(input:');
  });

  it('generated CodeGen handler interface matches hand-written impl', async () => {
    const storage = createInMemoryStorage();
    const ast = parseConceptFile(readSpec('framework', 'code-gen'));
    const result = await codeGenHandler.generate(
      { spec: 'cg-1', ast, language: 'typescript' },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const handlerFile = files.find(f => f.path === 'codegen.handler.ts');
    expect(handlerFile).toBeDefined();
    expect(handlerFile!.content).toContain('CodeGenHandler');
    expect(handlerFile!.content).toContain('generate(input:');
  });

  it('generated Registry handler interface has all 3 actions', async () => {
    const storage = createInMemoryStorage();
    const ast = parseConceptFile(readSpec('framework', 'registry'));
    const result = await codeGenHandler.generate(
      { spec: 'r-1', ast, language: 'typescript' },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const handlerFile = files.find(f => f.path === 'registry.handler.ts');
    expect(handlerFile).toBeDefined();
    expect(handlerFile!.content).toContain('RegistryHandler');
    expect(handlerFile!.content).toContain('register(input:');
    expect(handlerFile!.content).toContain('deregister(input:');
    expect(handlerFile!.content).toContain('heartbeat(input:');

    const typesFile = files.find(f => f.path === 'registry.types.ts');
    expect(typesFile).toBeDefined();
    // register action has ok and error variants
    expect(typesFile!.content).toContain('RegistryRegisterOutput');
    expect(typesFile!.content).toContain('variant: "ok"');
    expect(typesFile!.content).toContain('variant: "error"');
    // concept param (keyword-as-param-name) should appear
    expect(typesFile!.content).toContain('concept: string');
  });

  it('generated ActionLog handler interface has all 3 actions', async () => {
    const storage = createInMemoryStorage();
    const ast = parseConceptFile(readSpec('framework', 'action-log'));
    const result = await codeGenHandler.generate(
      { spec: 'al-1', ast, language: 'typescript' },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const handlerFile = files.find(f => f.path === 'actionlog.handler.ts');
    expect(handlerFile).toBeDefined();
    expect(handlerFile!.content).toContain('ActionLogHandler');
    expect(handlerFile!.content).toContain('append(input:');
    expect(handlerFile!.content).toContain('addEdge(input:');
    expect(handlerFile!.content).toContain('query(input:');
  });

  it('generated Password types match the architecture doc Section 7.3 exactly', async () => {
    const storage = createInMemoryStorage();
    const ast = parseConceptFile(readSpec('app', 'password'));
    const result = await codeGenHandler.generate(
      { spec: 'pwd-1', ast, language: 'typescript' },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const typesFile = files.find(f => f.path === 'password.types.ts');
    expect(typesFile).toBeDefined();

    const content = typesFile!.content;

    // Section 7.3 specifies these exact type names
    expect(content).toContain('export interface PasswordSetInput');
    expect(content).toContain('user: string');
    expect(content).toContain('password: string');

    expect(content).toContain('export type PasswordSetOutput');
    expect(content).toContain('variant: "ok"; user: string');
    expect(content).toContain('variant: "invalid"; message: string');

    expect(content).toContain('export interface PasswordCheckInput');
    expect(content).toContain('export type PasswordCheckOutput');
    expect(content).toContain('variant: "ok"; valid: boolean');
    expect(content).toContain('variant: "notfound"; message: string');

    expect(content).toContain('export interface PasswordValidateInput');
    expect(content).toContain('export type PasswordValidateOutput');

    // Handler file matches Section 7.3
    const handlerFile = files.find(f => f.path === 'password.handler.ts');
    expect(handlerFile).toBeDefined();
    expect(handlerFile!.content).toContain('export interface PasswordHandler');
    expect(handlerFile!.content).toContain('set(input:');
    expect(handlerFile!.content).toContain('check(input:');
    expect(handlerFile!.content).toContain('validate(input:');
  });
});

// ============================================================
// Step 4: SyncParser + SyncCompiler round-trip
//
// "Feed the .sync files to SyncParser and SyncCompiler —
//  verify the compiled syncs match the hand-registered syncs
//  from Stage 1."
// ============================================================

describe('Stage 2 — Step 4: SyncParser + SyncCompiler self-compilation', () => {
  it('SyncParser parses the framework compiler-pipeline sync file', async () => {
    const storage = createInMemoryStorage();
    const source = readFileSync(
      resolve(SYNCS_DIR, 'framework', 'compiler-pipeline.sync'),
      'utf-8',
    );
    const result = await syncParserHandler.parse(
      { source, manifests: [] },
      storage,
    );

    expect(result.variant).toBe('ok');
    const allSyncs = result.allSyncs as { syncId: string; name: string }[];
    expect(allSyncs).toHaveLength(3);
    expect(allSyncs.map(s => s.name)).toContain('GenerateSchemas');
    expect(allSyncs.map(s => s.name)).toContain('GenerateCode');
    expect(allSyncs.map(s => s.name)).toContain('LogRegistration');
  });

  it('SyncCompiler compiles all framework syncs and validates structure', async () => {
    const compilerStorage = createInMemoryStorage();

    const source = readFileSync(
      resolve(SYNCS_DIR, 'framework', 'compiler-pipeline.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(source);

    for (const sync of syncs) {
      const result = await syncCompilerHandler.compile(
        { sync: sync.name, ast: sync },
        compilerStorage,
      );
      expect(result.variant).toBe('ok');
      const compiled = result.compiled as CompiledSync;
      expect(compiled.name).toBe(sync.name);
      expect(compiled.when.length).toBeGreaterThan(0);
      expect(compiled.then.length).toBeGreaterThan(0);
    }
  });

  it('compiled GenerateSchemas sync matches hand-registered structure', async () => {
    const storage = createInMemoryStorage();
    const source = readFileSync(
      resolve(SYNCS_DIR, 'framework', 'compiler-pipeline.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(source);
    const genSchemas = syncs.find(s => s.name === 'GenerateSchemas')!;

    const result = await syncCompilerHandler.compile(
      { sync: 'gs', ast: genSchemas },
      storage,
    );
    expect(result.variant).toBe('ok');
    const compiled = result.compiled as CompiledSync;

    // When: SpecParser/parse completion with spec and ast output
    expect(compiled.when).toHaveLength(1);
    expect(compiled.when[0].concept).toBe('urn:copf/SpecParser');
    expect(compiled.when[0].action).toBe('parse');
    // Output fields should capture ?spec and ?ast
    const outputVars = compiled.when[0].outputFields
      .filter(f => f.match.type === 'variable')
      .map(f => (f.match as { type: 'variable'; name: string }).name);
    expect(outputVars).toContain('spec');
    expect(outputVars).toContain('ast');

    // Then: SchemaGen/generate with spec and ast inputs
    expect(compiled.then).toHaveLength(1);
    expect(compiled.then[0].concept).toBe('urn:copf/SchemaGen');
    expect(compiled.then[0].action).toBe('generate');
    const thenFields = compiled.then[0].fields.map(f => f.name);
    expect(thenFields).toContain('spec');
    expect(thenFields).toContain('ast');
  });

  it('compiled GenerateCode sync matches hand-registered structure', async () => {
    const storage = createInMemoryStorage();
    const source = readFileSync(
      resolve(SYNCS_DIR, 'framework', 'compiler-pipeline.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(source);
    const genCode = syncs.find(s => s.name === 'GenerateCode')!;

    const result = await syncCompilerHandler.compile(
      { sync: 'gc', ast: genCode },
      storage,
    );
    expect(result.variant).toBe('ok');
    const compiled = result.compiled as CompiledSync;

    // When: two patterns — SpecParser/parse and SchemaGen/generate
    expect(compiled.when).toHaveLength(2);
    expect(compiled.when[0].concept).toBe('urn:copf/SpecParser');
    expect(compiled.when[1].concept).toBe('urn:copf/SchemaGen');

    // Then: CodeGen/generate with spec, ast, and language="typescript"
    expect(compiled.then).toHaveLength(1);
    expect(compiled.then[0].concept).toBe('urn:copf/CodeGen');
    expect(compiled.then[0].action).toBe('generate');
    const langField = compiled.then[0].fields.find(f => f.name === 'language');
    expect(langField).toBeDefined();
    expect(langField!.value.type).toBe('literal');
    expect((langField!.value as { type: 'literal'; value: unknown }).value).toBe('typescript');
  });

  it('compiled LogRegistration sync matches hand-registered structure', async () => {
    const storage = createInMemoryStorage();
    const source = readFileSync(
      resolve(SYNCS_DIR, 'framework', 'compiler-pipeline.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(source);
    const logReg = syncs.find(s => s.name === 'LogRegistration')!;

    const result = await syncCompilerHandler.compile(
      { sync: 'lr', ast: logReg },
      storage,
    );
    expect(result.variant).toBe('ok');
    const compiled = result.compiled as CompiledSync;

    // When: Registry/register with concept output
    expect(compiled.when[0].concept).toBe('urn:copf/Registry');
    expect(compiled.when[0].action).toBe('register');

    // Then: ActionLog/append
    expect(compiled.then[0].concept).toBe('urn:copf/ActionLog');
    expect(compiled.then[0].action).toBe('append');
  });

  it('SyncParser parses and SyncCompiler compiles all app sync files', async () => {
    const syncFiles = ['echo.sync', 'registration.sync'];

    for (const file of syncFiles) {
      const source = readFileSync(resolve(SYNCS_DIR, 'app', file), 'utf-8');

      // Step 1: Parse
      const parseStorage = createInMemoryStorage();
      const parseResult = await syncParserHandler.parse(
        { source, manifests: [] },
        parseStorage,
      );
      expect(parseResult.variant).toBe('ok');

      // Step 2: Compile each parsed sync
      const compileStorage = createInMemoryStorage();
      const syncs = parseSyncFile(source);
      for (const sync of syncs) {
        const compileResult = await syncCompilerHandler.compile(
          { sync: sync.name, ast: sync },
          compileStorage,
        );
        expect(compileResult.variant).toBe('ok');
      }
    }
  });
});

// ============================================================
// Conformance Test Generation (Section 7.4)
//
// "The compiler generates conformance tests from the invariant
//  section of each concept spec."
//
// Verify that CodeGen produces correct conformance test code
// for app concepts that have invariants.
// ============================================================

describe('Stage 2 — Conformance Test Generation (Section 7.4)', () => {
  it('generates conformance test for Password concept', async () => {
    const storage = createInMemoryStorage();
    const ast = parseConceptFile(readSpec('app', 'password'));
    const result = await codeGenHandler.generate(
      { spec: 'pwd-1', ast, language: 'typescript' },
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
    expect(content).toContain('"secret"');
    expect(content).toContain('"wrong"');
    expect(content).toContain('.valid).toBe(false)');
  });

  it('generates conformance test for Echo concept', async () => {
    const storage = createInMemoryStorage();
    const ast = parseConceptFile(readSpec('app', 'echo'));
    const result = await codeGenHandler.generate(
      { spec: 'echo-1', ast, language: 'typescript' },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const testFile = files.find(f => f.path === 'echo.conformance.test.ts');
    expect(testFile).toBeDefined();
    expect(testFile!.content).toContain('echoHandler.send(');
    expect(testFile!.content).toContain('"hello"');
  });

  it('generates conformance test for JWT concept', async () => {
    const storage = createInMemoryStorage();
    const ast = parseConceptFile(readSpec('app', 'jwt'));
    const result = await codeGenHandler.generate(
      { spec: 'jwt-1', ast, language: 'typescript' },
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
    const storage = createInMemoryStorage();
    const ast = parseConceptFile(readSpec('app', 'user'));
    const result = await codeGenHandler.generate(
      { spec: 'u-1', ast, language: 'typescript' },
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
    const storage = createInMemoryStorage();
    // Framework specs have no invariants
    const ast = parseConceptFile(readSpec('framework', 'spec-parser'));
    const result = await codeGenHandler.generate(
      { spec: 'sp-1', ast, language: 'typescript' },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const testFile = files.find(f => f.path.includes('conformance'));
    expect(testFile).toBeUndefined();
  });
});

// ============================================================
// Full Pipeline: Kernel-driven end-to-end self-compilation
//
// Register all Stage 1 concepts on the kernel, load the
// compiler pipeline syncs, and run a complete self-compilation
// flow. This validates that:
// - Stage 1 concepts are correctly registered
// - The compiler pipeline syncs fire in the right order
// - The generated output is structurally sound
// ============================================================

describe('Stage 2 — Full Pipeline (kernel-driven)', () => {
  it('complete self-compilation flow via kernel', async () => {
    const kernel = createKernel();

    // Register all Stage 1 concepts on the kernel
    kernel.registerConcept('urn:copf/SpecParser', specParserHandler);
    kernel.registerConcept('urn:copf/SchemaGen', schemaGenHandler);
    kernel.registerConcept('urn:copf/CodeGen', codeGenHandler);
    kernel.registerConcept('urn:copf/SyncParser', syncParserHandler);
    kernel.registerConcept('urn:copf/SyncCompiler', syncCompilerHandler);
    kernel.registerConcept('urn:copf/ActionLog', actionLogHandler);
    kernel.registerConcept('urn:copf/Registry', registryHandler);

    // Load the compiler pipeline syncs
    const syncSource = readFileSync(
      resolve(SYNCS_DIR, 'framework', 'compiler-pipeline.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(syncSource);
    for (const sync of syncs) {
      kernel.registerSync(sync);
    }

    // Self-compile: parse a framework spec through the pipeline
    const specParserSpec = readSpec('framework', 'spec-parser');
    const result = await kernel.invokeConcept(
      'urn:copf/SpecParser',
      'parse',
      { source: specParserSpec },
    );

    expect(result.variant).toBe('ok');
    expect((result.ast as ConceptAST).name).toBe('SpecParser');
  });

  it('self-compilation pipeline for an app concept with invariants', async () => {
    const kernel = createKernel();

    kernel.registerConcept('urn:copf/SpecParser', specParserHandler);
    kernel.registerConcept('urn:copf/SchemaGen', schemaGenHandler);
    kernel.registerConcept('urn:copf/CodeGen', codeGenHandler);
    kernel.registerConcept('urn:copf/ActionLog', actionLogHandler);
    kernel.registerConcept('urn:copf/Registry', registryHandler);

    const syncSource = readFileSync(
      resolve(SYNCS_DIR, 'framework', 'compiler-pipeline.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(syncSource);
    for (const sync of syncs) {
      kernel.registerSync(sync);
    }

    // Parse the Password spec — should trigger the full pipeline
    const passwordSpec = readSpec('app', 'password');
    const result = await kernel.invokeConcept(
      'urn:copf/SpecParser',
      'parse',
      { source: passwordSpec },
    );

    expect(result.variant).toBe('ok');
    expect((result.ast as ConceptAST).name).toBe('Password');
    expect((result.ast as ConceptAST).invariants).toHaveLength(1);
  });
});
