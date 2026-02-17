// ============================================================
// Self-Compilation Tests
//
// Validates that the framework can compile its own concept specs:
//   1. SpecParser parses all framework specs
//   2. SchemaGen generates manifests for all specs
//   3. TypeScriptGen generates TypeScript for all specs
//   4. SyncParser + SyncCompiler round-trip for framework syncs
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  createInMemoryStorage,
} from '../kernel/src/index.js';
import { parseConceptFile } from '../implementations/typescript/framework/spec-parser.impl.js';
import { parseSyncFile } from '../implementations/typescript/framework/sync-parser.impl.js';
import type { ConceptAST, CompiledSync, ConceptManifest } from '../kernel/src/types.js';

// Framework concept handlers
import { specParserHandler } from '../implementations/typescript/framework/spec-parser.impl.js';
import { schemaGenHandler } from '../implementations/typescript/framework/schema-gen.impl.js';
import { typescriptGenHandler } from '../implementations/typescript/framework/typescript-gen.impl.js';
import { syncParserHandler } from '../implementations/typescript/framework/sync-parser.impl.js';
import { syncCompilerHandler } from '../implementations/typescript/framework/sync-compiler.impl.js';

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

// All 7 framework concept names
const FRAMEWORK_SPECS = [
  'spec-parser', 'schema-gen', 'typescript-gen',
  'sync-parser', 'sync-compiler',
  'action-log', 'registry',
];

// All 4 app concept names
const APP_SPECS = ['echo', 'password', 'user', 'jwt'];

// ============================================================
// Self-Validation: Parse framework specs through framework concepts
// ============================================================

describe('Self-Validation', () => {
  it('SpecParser parses all framework concept specs', async () => {
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
  });

  it('SchemaGen generates manifests for all framework specs', async () => {
    const parserStorage = createInMemoryStorage();
    const schemaStorage = createInMemoryStorage();

    const specNames = [
      'spec-parser', 'schema-gen', 'typescript-gen',
      'sync-parser', 'sync-compiler',
      'action-log', 'registry',
    ];

    for (const name of specNames) {
      const source = readSpec('framework', name);
      const parseResult = await specParserHandler.parse({ source }, parserStorage);
      expect(parseResult.variant).toBe('ok');

      const genResult = await schemaGenHandler.generate(
        { spec: parseResult.spec, ast: parseResult.ast },
        schemaStorage,
      );
      expect(genResult.variant).toBe('ok');
      const manifest = genResult.manifest as ConceptManifest;
      expect(manifest.graphqlSchema).toBeTruthy();
      expect(manifest.actions.length).toBeGreaterThan(0);
    }
  });

  it('TypeScriptGen generates TypeScript for all framework specs', async () => {
    const parserStorage = createInMemoryStorage();
    const codeStorage = createInMemoryStorage();

    const specNames = [
      'spec-parser', 'schema-gen', 'typescript-gen',
      'sync-parser', 'sync-compiler',
      'action-log', 'registry',
    ];

    for (const name of specNames) {
      const source = readSpec('framework', name);
      const parseResult = await specParserHandler.parse({ source }, parserStorage);
      expect(parseResult.variant).toBe('ok');

      const manifest = await generateManifest(parseResult.ast as ConceptAST);
      const genResult = await typescriptGenHandler.generate(
        { spec: parseResult.spec, manifest },
        codeStorage,
      );
      expect(genResult.variant).toBe('ok');
      const files = genResult.files as { path: string; content: string }[];
      expect(files).toHaveLength(3);
      // Verify each file has content
      for (const file of files) {
        expect(file.content.length).toBeGreaterThan(0);
      }
    }
  });

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
    expect(allSyncs).toHaveLength(4);
  });

  it('SyncCompiler compiles all framework syncs', async () => {
    const parserStorage = createInMemoryStorage();
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
    }
  });
});

// ============================================================
// Step 1: SpecParser self-compilation
// ============================================================

describe('SpecParser Self-Compilation', () => {
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

    expect(parsedASTs['typescript-gen'].name).toBe('TypeScriptGen');
    expect(parsedASTs['typescript-gen'].actions[0].name).toBe('generate');

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

    // All app specs should be stored
    const allSpecs = await storage.find('specs');
    expect(allSpecs).toHaveLength(APP_SPECS.length);
  });
});

// ============================================================
// Step 2: SchemaGen self-compilation (ConceptManifest)
// ============================================================

describe('SchemaGen Self-Compilation (ConceptManifest)', () => {
  it('generates manifests for all framework specs', async () => {
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
      const manifest = genResult.manifest as ConceptManifest;
      expect(manifest.name).toBeTruthy();
      expect(manifest.graphqlSchema).toBeTruthy();
      expect(manifest.actions.length).toBeGreaterThan(0);
    }
  });

  it('SpecParser manifest has correct GraphQL structure', async () => {
    const ast = parseConceptFile(readSpec('framework', 'spec-parser'));
    const manifest = await generateManifest(ast);

    // SpecParser state: specs: set S, ast: S -> AST
    // 'set S' becomes a set-valued relation; 'S -> AST' merges into entry
    expect(manifest.graphqlSchema).toContain('SpecParserState');
    expect(manifest.graphqlSchema).toContain('SpecParserEntry');
    expect(manifest.graphqlSchema).toContain('ast:');  // merged field
  });

  it('SpecParser manifest has correct JSON schemas for parse action', async () => {
    const ast = parseConceptFile(readSpec('framework', 'spec-parser'));
    const manifest = await generateManifest(ast);

    // parse action: invocation + 2 completion variants (ok, error)
    expect(manifest.jsonSchemas.invocations['parse']).toBeDefined();
    expect(manifest.jsonSchemas.completions['parse']['ok']).toBeDefined();
    expect(manifest.jsonSchemas.completions['parse']['error']).toBeDefined();

    const invocation = manifest.jsonSchemas.invocations['parse'] as any;
    expect(invocation.$id).toContain('parse/invocation');
    expect(invocation.properties.input.properties.source).toBeDefined();

    const okCompletion = manifest.jsonSchemas.completions['parse']['ok'] as any;
    expect(okCompletion.$id).toContain('parse/completion/ok');
    expect(okCompletion.properties.variant.const).toBe('ok');

    const errorCompletion = manifest.jsonSchemas.completions['parse']['error'] as any;
    expect(errorCompletion.$id).toContain('parse/completion/error');
    expect(errorCompletion.properties.variant.const).toBe('error');
  });

  it('Registry manifest captures all 3 actions', async () => {
    const ast = parseConceptFile(readSpec('framework', 'registry'));
    const manifest = await generateManifest(ast);

    // 3 actions: register, deregister, heartbeat
    expect(manifest.actions).toHaveLength(3);
    expect(manifest.jsonSchemas.invocations['register']).toBeDefined();
    expect(manifest.jsonSchemas.invocations['deregister']).toBeDefined();
    expect(manifest.jsonSchemas.invocations['heartbeat']).toBeDefined();

    // register has ok and error variants
    expect(manifest.jsonSchemas.completions['register']['ok']).toBeDefined();
    expect(manifest.jsonSchemas.completions['register']['error']).toBeDefined();

    // Verify register invocation has uri and transport params
    const registerInv = manifest.jsonSchemas.invocations['register'] as any;
    expect(registerInv.properties.input.properties.uri).toBeDefined();
    expect(registerInv.properties.input.properties.transport).toBeDefined();
  });

  it('ActionLog manifest captures all 3 actions', async () => {
    const ast = parseConceptFile(readSpec('framework', 'action-log'));
    const manifest = await generateManifest(ast);

    expect(manifest.actions).toHaveLength(3);
    expect(manifest.actions.map(a => a.name)).toContain('append');
    expect(manifest.actions.map(a => a.name)).toContain('addEdge');
    expect(manifest.actions.map(a => a.name)).toContain('query');
  });

  it('manifests for app specs are consistent with framework specs', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);

    // Password state: hash: U -> Bytes, salt: U -> Bytes
    // Both merge into entries relation
    expect(manifest.graphqlSchema).toContain('PasswordEntry');
    expect(manifest.graphqlSchema).toContain('hash:');
    expect(manifest.graphqlSchema).toContain('salt:');
    expect(manifest.graphqlSchema).toContain('password_entry');
    expect(manifest.graphqlSchema).toContain('password_entries');

    // Verify relation schemas
    expect(manifest.relations).toHaveLength(1);
    expect(manifest.relations[0].source).toBe('merged');
    expect(manifest.relations[0].fields).toHaveLength(2);
    expect(manifest.relations[0].fields.map(f => f.name)).toContain('hash');
    expect(manifest.relations[0].fields.map(f => f.name)).toContain('salt');
  });
});

// ============================================================
// Step 3: TypeScriptGen self-compilation
// ============================================================

describe('TypeScriptGen Self-Compilation', () => {
  it('generates TypeScript skeletons for all framework specs', async () => {
    const parserStorage = createInMemoryStorage();
    const codeStorage = createInMemoryStorage();

    for (const name of FRAMEWORK_SPECS) {
      const source = readSpec('framework', name);
      const parseResult = await specParserHandler.parse({ source }, parserStorage);
      expect(parseResult.variant).toBe('ok');

      const manifest = await generateManifest(parseResult.ast as ConceptAST);
      const genResult = await typescriptGenHandler.generate(
        { spec: parseResult.spec, manifest },
        codeStorage,
      );
      expect(genResult.variant).toBe('ok');
      const files = genResult.files as { path: string; content: string }[];
      // types + handler + adapter (no conformance tests since framework specs lack invariants)
      expect(files.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('generated SpecParser handler interface matches hand-written impl', async () => {
    const ast = parseConceptFile(readSpec('framework', 'spec-parser'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'sp-1', manifest },
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
    const ast = parseConceptFile(readSpec('framework', 'schema-gen'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'sg-1', manifest },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const handlerFile = files.find(f => f.path === 'schemagen.handler.ts');
    expect(handlerFile).toBeDefined();
    expect(handlerFile!.content).toContain('SchemaGenHandler');
    expect(handlerFile!.content).toContain('generate(input:');
  });

  it('generated TypeScriptGen handler interface matches hand-written impl', async () => {
    const ast = parseConceptFile(readSpec('framework', 'typescript-gen'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'tsg-1', manifest },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const handlerFile = files.find(f => f.path === 'typescriptgen.handler.ts');
    expect(handlerFile).toBeDefined();
    expect(handlerFile!.content).toContain('TypeScriptGenHandler');
    expect(handlerFile!.content).toContain('generate(input:');
  });

  it('generated Registry handler interface has all 3 actions', async () => {
    const ast = parseConceptFile(readSpec('framework', 'registry'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'r-1', manifest },
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
    const ast = parseConceptFile(readSpec('framework', 'action-log'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'al-1', manifest },
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
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'pwd-1', manifest },
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
// Step 4: SyncParser + SyncCompiler self-compilation
// ============================================================

describe('SyncParser + SyncCompiler Self-Compilation', () => {
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
    expect(allSyncs).toHaveLength(4);
    expect(allSyncs.map(s => s.name)).toContain('GenerateManifest');
    expect(allSyncs.map(s => s.name)).toContain('GenerateTypeScript');
    expect(allSyncs.map(s => s.name)).toContain('GenerateRust');
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

  it('compiled GenerateManifest sync matches expected structure', async () => {
    const storage = createInMemoryStorage();
    const source = readFileSync(
      resolve(SYNCS_DIR, 'framework', 'compiler-pipeline.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(source);
    const genManifest = syncs.find(s => s.name === 'GenerateManifest')!;

    const result = await syncCompilerHandler.compile(
      { sync: 'gm', ast: genManifest },
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

  it('compiled GenerateTypeScript sync matches expected structure', async () => {
    const storage = createInMemoryStorage();
    const source = readFileSync(
      resolve(SYNCS_DIR, 'framework', 'compiler-pipeline.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(source);
    const genTS = syncs.find(s => s.name === 'GenerateTypeScript')!;

    const result = await syncCompilerHandler.compile(
      { sync: 'gt', ast: genTS },
      storage,
    );
    expect(result.variant).toBe('ok');
    const compiled = result.compiled as CompiledSync;

    // When: single pattern — SchemaGen/generate with spec input and manifest output
    expect(compiled.when).toHaveLength(1);
    expect(compiled.when[0].concept).toBe('urn:copf/SchemaGen');
    expect(compiled.when[0].action).toBe('generate');

    // Then: TypeScriptGen/generate with spec and manifest
    expect(compiled.then).toHaveLength(1);
    expect(compiled.then[0].concept).toBe('urn:copf/TypeScriptGen');
    expect(compiled.then[0].action).toBe('generate');
    const thenFields = compiled.then[0].fields.map(f => f.name);
    expect(thenFields).toContain('spec');
    expect(thenFields).toContain('manifest');
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
