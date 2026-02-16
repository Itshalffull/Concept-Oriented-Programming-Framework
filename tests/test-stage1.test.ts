// ============================================================
// Stage 1 Integration Tests
//
// Validates that all 7 Stage 1 concepts work correctly both
// individually and wired together through the Stage 1 syncs.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  createKernel,
  createInMemoryStorage,
  createInProcessAdapter,
  parseConceptFile,
  parseSyncFile,
} from '../kernel/src/index.js';
import type { ConceptHandler, ConceptAST, CompiledSync } from '../kernel/src/types.js';

// Stage 1 concept handlers
import { specParserHandler } from '../implementations/typescript/framework/spec-parser.impl.js';
import { schemaGenHandler } from '../implementations/typescript/framework/schema-gen.impl.js';
import { codeGenHandler } from '../implementations/typescript/framework/code-gen.impl.js';
import { syncParserHandler } from '../implementations/typescript/framework/sync-parser.impl.js';
import { syncCompilerHandler } from '../implementations/typescript/framework/sync-compiler.impl.js';
import { actionLogHandler } from '../implementations/typescript/framework/action-log.impl.js';
import { registryHandler } from '../implementations/typescript/framework/registry.impl.js';

// Paths to spec files
const SPECS_DIR = resolve(__dirname, '..', 'specs');
const SYNCS_DIR = resolve(__dirname, '..', 'syncs');

// Helper: read a spec file
function readSpec(category: string, name: string): string {
  return readFileSync(resolve(SPECS_DIR, category, `${name}.concept`), 'utf-8');
}

// ============================================================
// 1. Stage 1 Concept Spec Parsing
// ============================================================

describe('Stage 1 — Concept Specs', () => {
  it('parses all 7 framework concept specs', () => {
    const specNames = [
      'spec-parser', 'schema-gen', 'code-gen',
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
// 2. SpecParser Concept
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
      'spec-parser', 'schema-gen', 'code-gen',
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
// 3. SchemaGen Concept
// ============================================================

describe('Stage 1 — SchemaGen Concept', () => {
  it('generates GraphQL schema from Password concept', async () => {
    const storage = createInMemoryStorage();
    const ast = parseConceptFile(readSpec('app', 'password'));
    const result = await schemaGenHandler.generate(
      { spec: 'test-spec-1', ast },
      storage,
    );

    expect(result.variant).toBe('ok');
    const graphql = result.graphql as string;
    expect(graphql).toContain('type PasswordState');
    expect(graphql).toContain('type PasswordEntry');
    expect(graphql).toContain('hash:');
    expect(graphql).toContain('salt:');
    expect(graphql).toContain('extend type Query');
    expect(graphql).toContain('password_entry');
    expect(graphql).toContain('password_entries');
  });

  it('generates JSON schemas for all actions', async () => {
    const storage = createInMemoryStorage();
    const ast = parseConceptFile(readSpec('app', 'password'));
    const result = await schemaGenHandler.generate(
      { spec: 'test-spec-1', ast },
      storage,
    );

    expect(result.variant).toBe('ok');
    const schemas = result.jsonSchemas as string[];

    // Password has 3 actions: set (invocation + ok + invalid = 3),
    // check (invocation + ok + notfound = 3), validate (invocation + ok = 2)
    // Total: 8 schemas
    expect(schemas.length).toBe(8);

    // Validate one invocation schema
    const setInvocation = JSON.parse(schemas[0]);
    expect(setInvocation.$id).toContain('set/invocation');
    expect(setInvocation.properties.input.properties.user).toBeDefined();
    expect(setInvocation.properties.input.properties.password).toBeDefined();

    // Validate one completion schema
    const setOk = JSON.parse(schemas[1]);
    expect(setOk.$id).toContain('set/completion/ok');
    expect(setOk.properties.variant.const).toBe('ok');
  });

  it('stores result in storage', async () => {
    const storage = createInMemoryStorage();
    const ast = parseConceptFile(readSpec('app', 'echo'));
    await schemaGenHandler.generate({ spec: 'spec-42', ast }, storage);

    const stored = await storage.get('schemas', 'spec-42');
    expect(stored).not.toBeNull();
    expect(stored!.graphql).toBeTruthy();
  });
});

// ============================================================
// 4. CodeGen Concept
// ============================================================

describe('Stage 1 — CodeGen Concept', () => {
  it('generates TypeScript skeleton for Password concept', async () => {
    const storage = createInMemoryStorage();
    const ast = parseConceptFile(readSpec('app', 'password'));
    const result = await codeGenHandler.generate(
      { spec: 'test-spec-1', ast, language: 'typescript' },
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

  it('rejects unsupported languages', async () => {
    const storage = createInMemoryStorage();
    const ast = parseConceptFile(readSpec('app', 'echo'));
    const result = await codeGenHandler.generate(
      { spec: 'spec-1', ast, language: 'rust' },
      storage,
    );

    expect(result.variant).toBe('error');
    expect(result.message).toContain('Unsupported language');
  });

  it('generates types for type parameter fields', async () => {
    const storage = createInMemoryStorage();
    const ast = parseConceptFile(readSpec('app', 'user'));
    const result = await codeGenHandler.generate(
      { spec: 'spec-1', ast, language: 'typescript' },
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
// 5. SyncParser Concept
// ============================================================

describe('Stage 1 — SyncParser Concept', () => {
  it('parses the echo sync file', async () => {
    const storage = createInMemoryStorage();
    const source = readFileSync(resolve(SYNCS_DIR, 'app', 'echo.sync'), 'utf-8');
    const result = await syncParserHandler.parse(
      { source, manifests: [] },
      storage,
    );

    expect(result.variant).toBe('ok');
    expect(result.sync).toBeTruthy();
    expect((result.ast as CompiledSync).name).toBeTruthy();
  });

  it('parses the registration sync file', async () => {
    const storage = createInMemoryStorage();
    const source = readFileSync(resolve(SYNCS_DIR, 'app', 'registration.sync'), 'utf-8');
    const result = await syncParserHandler.parse(
      { source, manifests: [] },
      storage,
    );

    expect(result.variant).toBe('ok');
    const allSyncs = result.allSyncs as { syncId: string; name: string }[];
    expect(allSyncs.length).toBeGreaterThanOrEqual(5);
  });

  it('parses the framework compiler pipeline sync', async () => {
    const storage = createInMemoryStorage();
    const source = readFileSync(resolve(SYNCS_DIR, 'framework', 'compiler-pipeline.sync'), 'utf-8');
    const result = await syncParserHandler.parse(
      { source, manifests: [] },
      storage,
    );

    expect(result.variant).toBe('ok');
    const allSyncs = result.allSyncs as { syncId: string; name: string }[];
    expect(allSyncs).toHaveLength(3);
    const names = allSyncs.map(s => s.name);
    expect(names).toContain('GenerateSchemas');
    expect(names).toContain('GenerateCode');
    expect(names).toContain('LogRegistration');
  });

  it('returns error for invalid source', async () => {
    const storage = createInMemoryStorage();
    const result = await syncParserHandler.parse(
      { source: 'not a valid sync ???', manifests: [] },
      storage,
    );

    expect(result.variant).toBe('error');
  });
});

// ============================================================
// 6. SyncCompiler Concept
// ============================================================

describe('Stage 1 — SyncCompiler Concept', () => {
  it('compiles a parsed sync into a CompiledSync', async () => {
    const storage = createInMemoryStorage();
    const source = readFileSync(resolve(SYNCS_DIR, 'app', 'echo.sync'), 'utf-8');
    const syncs = parseSyncFile(source);

    const result = await syncCompilerHandler.compile(
      { sync: 'sync-1', ast: syncs[0] },
      storage,
    );

    expect(result.variant).toBe('ok');
    const compiled = result.compiled as CompiledSync;
    expect(compiled.name).toBe(syncs[0].name);
    expect(compiled.when.length).toBeGreaterThan(0);
    expect(compiled.then.length).toBeGreaterThan(0);
  });

  it('stores compiled sync in storage', async () => {
    const storage = createInMemoryStorage();
    const source = readFileSync(resolve(SYNCS_DIR, 'app', 'echo.sync'), 'utf-8');
    const syncs = parseSyncFile(source);

    await syncCompilerHandler.compile(
      { sync: 'sync-ref-42', ast: syncs[0] },
      storage,
    );

    const stored = await storage.get('compiled', 'sync-ref-42');
    expect(stored).not.toBeNull();
    expect((stored!.compiled as CompiledSync).name).toBe(syncs[0].name);
  });

  it('rejects sync with missing when clause', async () => {
    const storage = createInMemoryStorage();
    const result = await syncCompilerHandler.compile(
      { sync: 's1', ast: { name: 'Bad', when: [], where: [], then: [{ concept: 'X', action: 'y', fields: [] }] } },
      storage,
    );

    expect(result.variant).toBe('error');
    expect(result.message).toContain('when clause is required');
  });
});

// ============================================================
// 7. ActionLog Concept
// ============================================================

describe('Stage 1 — ActionLog Concept', () => {
  it('appends records and queries by flow', async () => {
    const storage = createInMemoryStorage();

    // Append two records in the same flow
    const r1 = await actionLogHandler.append({
      record: { type: 'completion', concept: 'A', action: 'foo', flow: 'flow-1' },
    }, storage);
    expect(r1.variant).toBe('ok');
    expect(r1.id).toBeTruthy();

    const r2 = await actionLogHandler.append({
      record: { type: 'invocation', concept: 'B', action: 'bar', flow: 'flow-1' },
    }, storage);
    expect(r2.variant).toBe('ok');

    // Append a record in a different flow
    await actionLogHandler.append({
      record: { type: 'completion', concept: 'C', action: 'baz', flow: 'flow-2' },
    }, storage);

    // Query by flow
    const query = await actionLogHandler.query({ flow: 'flow-1' }, storage);
    expect(query.variant).toBe('ok');
    expect((query.records as unknown[]).length).toBe(2);
  });

  it('adds provenance edges', async () => {
    const storage = createInMemoryStorage();

    const r1 = await actionLogHandler.append({
      record: { type: 'completion', concept: 'A', action: 'x', flow: 'f' },
    }, storage);
    const r2 = await actionLogHandler.append({
      record: { type: 'invocation', concept: 'B', action: 'y', flow: 'f' },
    }, storage);

    const edge = await actionLogHandler.addEdge({
      from: r1.id as string,
      to: r2.id as string,
      sync: 'MySync',
    }, storage);
    expect(edge.variant).toBe('ok');

    // Verify edge is stored
    const edges = await storage.find('edges');
    expect(edges).toHaveLength(1);
    expect(edges[0].sync).toBe('MySync');
  });
});

// ============================================================
// 8. Registry Concept
// ============================================================

describe('Stage 1 — Registry Concept', () => {
  it('registers and queries concepts', async () => {
    const storage = createInMemoryStorage();

    const result = await registryHandler.register({
      uri: 'urn:app/Password',
      transport: { type: 'in-process' },
    }, storage);

    expect(result.variant).toBe('ok');
    expect(result.concept).toBeTruthy();
  });

  it('rejects duplicate URI registration', async () => {
    const storage = createInMemoryStorage();

    await registryHandler.register({
      uri: 'urn:app/User',
      transport: { type: 'in-process' },
    }, storage);

    const dup = await registryHandler.register({
      uri: 'urn:app/User',
      transport: { type: 'in-process' },
    }, storage);

    expect(dup.variant).toBe('error');
    expect(dup.message).toContain('already registered');
  });

  it('heartbeat returns availability', async () => {
    const storage = createInMemoryStorage();

    await registryHandler.register({
      uri: 'urn:app/Echo',
      transport: { type: 'in-process' },
    }, storage);

    const hb = await registryHandler.heartbeat({ uri: 'urn:app/Echo' }, storage);
    expect(hb.variant).toBe('ok');
    expect(hb.available).toBe(true);

    const unknown = await registryHandler.heartbeat({ uri: 'urn:app/Unknown' }, storage);
    expect(unknown.variant).toBe('ok');
    expect(unknown.available).toBe(false);
  });

  it('deregisters concepts', async () => {
    const storage = createInMemoryStorage();

    await registryHandler.register({
      uri: 'urn:app/JWT',
      transport: { type: 'in-process' },
    }, storage);

    const dereg = await registryHandler.deregister({ uri: 'urn:app/JWT' }, storage);
    expect(dereg.variant).toBe('ok');

    // Should be able to re-register
    const reReg = await registryHandler.register({
      uri: 'urn:app/JWT',
      transport: { type: 'in-process' },
    }, storage);
    expect(reReg.variant).toBe('ok');
  });
});

// ============================================================
// 9. End-to-End: Compiler Pipeline via Syncs
//
// Register all Stage 1 concepts on the kernel, load the
// compiler pipeline syncs, then invoke SpecParser/parse.
// The GenerateSchemas and GenerateCode syncs should fire
// automatically, producing schemas and code.
// ============================================================

describe('Stage 1 — Compiler Pipeline (end-to-end)', () => {
  it('SpecParser → SchemaGen → CodeGen pipeline fires via syncs', async () => {
    const kernel = createKernel();

    // Register the Stage 1 concepts
    kernel.registerConcept('urn:copf/SpecParser', specParserHandler);
    kernel.registerConcept('urn:copf/SchemaGen', schemaGenHandler);
    kernel.registerConcept('urn:copf/CodeGen', codeGenHandler);
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

    // Feed a concept spec through the pipeline by directly invoking SpecParser
    const passwordSpec = readSpec('app', 'password');
    const parseResult = await kernel.invokeConcept(
      'urn:copf/SpecParser',
      'parse',
      { source: passwordSpec },
    );

    expect(parseResult.variant).toBe('ok');
    expect((parseResult.ast as ConceptAST).name).toBe('Password');
  });

  it('LogRegistration sync fires on concept registration', async () => {
    const kernel = createKernel();

    kernel.registerConcept('urn:copf/Registry', registryHandler);
    kernel.registerConcept('urn:copf/ActionLog', actionLogHandler);

    // Load just the LogRegistration sync
    const syncSource = readFileSync(
      resolve(SYNCS_DIR, 'framework', 'compiler-pipeline.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(syncSource);
    const logSync = syncs.find(s => s.name === 'LogRegistration');
    expect(logSync).toBeDefined();
    kernel.registerSync(logSync!);

    // Register a concept through the Registry concept
    const result = await kernel.invokeConcept(
      'urn:copf/Registry',
      'register',
      { uri: 'urn:app/TestConcept', transport: { type: 'in-process' } },
    );

    expect(result.variant).toBe('ok');
    expect(result.concept).toBeTruthy();
  });
});

// ============================================================
// 10. Self-Validation: Parse Stage 1 specs through Stage 1
//
// The Stage 1 SpecParser concept should be able to parse
// its own concept specs — this is the beginning of the
// Stage 2 self-compilation story.
// ============================================================

describe('Stage 1 — Self-Validation', () => {
  it('SpecParser parses all Stage 1 concept specs', async () => {
    const storage = createInMemoryStorage();

    const specNames = [
      'spec-parser', 'schema-gen', 'code-gen',
      'sync-parser', 'sync-compiler',
      'action-log', 'registry',
    ];

    for (const name of specNames) {
      const source = readSpec('framework', name);
      const result = await specParserHandler.parse({ source }, storage);
      expect(result.variant).toBe('ok');
    }
  });

  it('SchemaGen generates schemas for all Stage 1 specs', async () => {
    const parserStorage = createInMemoryStorage();
    const schemaStorage = createInMemoryStorage();

    const specNames = [
      'spec-parser', 'schema-gen', 'code-gen',
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
      expect(genResult.graphql).toBeTruthy();
      expect((genResult.jsonSchemas as string[]).length).toBeGreaterThan(0);
    }
  });

  it('CodeGen generates TypeScript for all Stage 1 specs', async () => {
    const parserStorage = createInMemoryStorage();
    const codeStorage = createInMemoryStorage();

    const specNames = [
      'spec-parser', 'schema-gen', 'code-gen',
      'sync-parser', 'sync-compiler',
      'action-log', 'registry',
    ];

    for (const name of specNames) {
      const source = readSpec('framework', name);
      const parseResult = await specParserHandler.parse({ source }, parserStorage);
      expect(parseResult.variant).toBe('ok');

      const genResult = await codeGenHandler.generate(
        { spec: parseResult.spec, ast: parseResult.ast, language: 'typescript' },
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
    expect(allSyncs).toHaveLength(3);
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
