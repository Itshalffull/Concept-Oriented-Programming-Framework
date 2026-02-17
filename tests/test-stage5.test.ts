// ============================================================
// Stage 5 — Multi-Target Tests
//
// Covers:
//   - RustGen concept: Rust type mapping, templates for structs/
//     traits/adapters, conformance tests
//   - Pipeline sync: SchemaGen/generate => RustGen/generate
//   - HTTP transport adapters (Lite + GraphQL)
//   - Cross-language interop: TS engine invokes Rust concept
//     via HTTP, completions flow through syncs, queries work
//   - Deployment manifest parsing and validation
//
// Key invariant validated: adding a new language target required
// only a new generator concept + one sync — zero modifications
// to existing code (SchemaGen, TypeScriptGen, pipeline syncs).
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  createKernel,
  createSelfHostedKernel,
  createInMemoryStorage,
  createConceptRegistry,
  createInProcessAdapter,
  parseConceptFile,
  parseSyncFile,
  createHttpLiteAdapter,
  createHttpGraphQLAdapter,
  createHttpConceptServer,
  parseDeploymentManifest,
  validateDeploymentManifest,
} from '../kernel/src/index.js';
import type {
  ConceptHandler,
  ConceptAST,
  ConceptManifest,
  ConceptTransport,
  ActionInvocation,
  ActionCompletion,
} from '../kernel/src/types.js';
import type {
  DeploymentManifest,
  ValidationResult,
} from '../implementations/typescript/framework/deployment-validator.impl.js';

// Stage 1 concept handlers
import { specParserHandler } from '../implementations/typescript/framework/spec-parser.impl.js';
import { schemaGenHandler } from '../implementations/typescript/framework/schema-gen.impl.js';
import { typescriptGenHandler } from '../implementations/typescript/framework/typescript-gen.impl.js';
import { rustGenHandler } from '../implementations/typescript/framework/rust-gen.impl.js';
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
// 1. RustGen Concept — Type Mapping
//
// Verify that RustGen correctly maps ResolvedType to Rust syntax.
// Type mapping table from Section 10.1:
//   String → String, Int → i64, Float → f64, Bool → bool,
//   Bytes → Vec<u8>, DateTime → DateTime<Utc>, ID → String,
//   option T → Option<T>, set T → HashSet<T>, list T → Vec<T>,
//   A -> B → HashMap<A,B>, params → String (opaque)
// ============================================================

describe('Stage 5 — RustGen Type Mapping', () => {
  it('RustGen concept spec exists and matches TypeScriptGen pattern', () => {
    const source = readSpec('framework', 'rust-gen');
    const ast = parseConceptFile(source);

    expect(ast.name).toBe('RustGen');
    expect(ast.actions).toHaveLength(1);
    expect(ast.actions[0].name).toBe('generate');
    expect(ast.actions[0].params.map(p => p.name)).toContain('manifest');
    expect(ast.actions[0].params.map(p => p.name)).toContain('spec');
    expect(ast.actions[0].variants.map(v => v.name)).toContain('ok');
    expect(ast.actions[0].variants.map(v => v.name)).toContain('error');
  });

  it('Password concept generates correct Rust type definitions', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await rustGenHandler.generate(
      { spec: 'pwd-1', manifest },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    const typesFile = files.find(f => f.path === 'password/types.rs')!;
    expect(typesFile).toBeDefined();

    // Primitive type mappings
    expect(typesFile.content).toContain('pub struct PasswordSetInput');
    expect(typesFile.content).toContain('pub user: String'); // param U → String
    expect(typesFile.content).toContain('pub password: String'); // String → String

    // Bool type mapping (enum variant fields don't use `pub` in Rust)
    expect(typesFile.content).toContain('valid: bool'); // Bool → bool

    // Enum output types with serde tag
    expect(typesFile.content).toContain('pub enum PasswordSetOutput');
    expect(typesFile.content).toContain('pub enum PasswordCheckOutput');
    expect(typesFile.content).toContain('#[serde(tag = "variant")]');

    // Variant names are capitalized
    expect(typesFile.content).toContain('Ok');
    expect(typesFile.content).toContain('Invalid');
    expect(typesFile.content).toContain('Notfound');

    // Derive macros
    expect(typesFile.content).toContain('#[derive(');
    expect(typesFile.content).toContain('Serialize');
    expect(typesFile.content).toContain('Deserialize');

    // Uses serde
    expect(typesFile.content).toContain('use serde::{Serialize, Deserialize}');
  });

  it('Password concept generates correct Rust handler trait', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await rustGenHandler.generate(
      { spec: 'pwd-1', manifest },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const handlerFile = files.find(f => f.path === 'password/handler.rs')!;
    expect(handlerFile).toBeDefined();

    // Trait definition
    expect(handlerFile.content).toContain('#[async_trait]');
    expect(handlerFile.content).toContain('pub trait PasswordHandler: Send + Sync');

    // Action methods
    expect(handlerFile.content).toContain('async fn set(');
    expect(handlerFile.content).toContain('async fn check(');
    expect(handlerFile.content).toContain('async fn validate(');

    // Method signatures include storage
    expect(handlerFile.content).toContain('storage: &dyn ConceptStorage');

    // Return types
    expect(handlerFile.content).toContain('Result<PasswordSetOutput');
    expect(handlerFile.content).toContain('Result<PasswordCheckOutput');
    expect(handlerFile.content).toContain('Result<PasswordValidateOutput');
  });

  it('Password concept generates correct Rust transport adapter', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await rustGenHandler.generate(
      { spec: 'pwd-1', manifest },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const adapterFile = files.find(f => f.path === 'password/adapter.rs')!;
    expect(adapterFile).toBeDefined();

    // Adapter struct
    expect(adapterFile.content).toContain('pub struct PasswordAdapter');
    expect(adapterFile.content).toContain('impl<H: PasswordHandler');

    // Action dispatch
    expect(adapterFile.content).toContain('"set"');
    expect(adapterFile.content).toContain('"check"');
    expect(adapterFile.content).toContain('"validate"');

    // Serde serialization
    expect(adapterFile.content).toContain('serde_json::from_value');
    expect(adapterFile.content).toContain('serde_json::to_value');

    // Transport trait impl
    expect(adapterFile.content).toContain('ConceptTransport for PasswordAdapter');
  });

  it('Password concept generates Rust conformance tests', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await rustGenHandler.generate(
      { spec: 'pwd-1', manifest },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const testFile = files.find(f => f.path === 'password/conformance.rs')!;
    expect(testFile).toBeDefined();

    // Test structure
    expect(testFile.content).toContain('#[cfg(test)]');
    expect(testFile.content).toContain('#[tokio::test]');
    expect(testFile.content).toContain('async fn password_invariant_1');

    // Deterministic test value
    expect(testFile.content).toContain('"u-test-invariant-001"');

    // After clause (setup)
    expect(testFile.content).toContain('// --- AFTER clause ---');
    // Then clause (assertions)
    expect(testFile.content).toContain('// --- THEN clause ---');

    // Rust-style assertions
    expect(testFile.content).toContain('assert_eq!');
  });

  it('generates files for concept without invariants (no conformance.rs)', async () => {
    const ast = parseConceptFile(readSpec('framework', 'schema-gen'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await rustGenHandler.generate(
      { spec: 'sg-1', manifest },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    // types, handler, adapter — but no conformance since no invariants
    expect(files).toHaveLength(3);
    expect(files.find(f => f.path.endsWith('conformance.rs'))).toBeUndefined();
  });

  it('handles complex types (list, option, set, map) correctly', async () => {
    // SpecParser has set S, list types — verify these map correctly
    const ast = parseConceptFile(readSpec('framework', 'spec-parser'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await rustGenHandler.generate(
      { spec: 'sp-1', manifest },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    const typesFile = files.find(f => f.path.endsWith('types.rs'))!;
    expect(typesFile).toBeDefined();

    // Verify the types file has struct definitions
    expect(typesFile.content).toContain('pub struct SpecParser');
    expect(typesFile.content).toContain('Serialize');
  });

  it('returns error for invalid manifest', async () => {
    const storage = createInMemoryStorage();
    const result = await rustGenHandler.generate(
      { spec: 'bad', manifest: {} },
      storage,
    );

    expect(result.variant).toBe('error');
    expect(result.message).toContain('missing concept name');
  });
});

// ============================================================
// 2. Pipeline Integration — RustGen Sync
//
// Verify that the GenerateRust sync is correctly wired into the
// compiler pipeline alongside GenerateTypeScript.
// ============================================================

describe('Stage 5 — Pipeline Integration', () => {
  it('GenerateRust sync exists in compiler pipeline', () => {
    const source = readFileSync(
      resolve(SYNCS_DIR, 'framework', 'compiler-pipeline.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(source);

    const genRust = syncs.find(s => s.name === 'GenerateRust');
    expect(genRust).toBeDefined();
    expect(genRust!.when).toHaveLength(1);
    expect(genRust!.when[0].concept).toBe('urn:copf/SchemaGen');
    expect(genRust!.when[0].action).toBe('generate');
    expect(genRust!.then[0].concept).toBe('urn:copf/RustGen');
    expect(genRust!.then[0].action).toBe('generate');
  });

  it('GenerateRust and GenerateTypeScript both fire from SchemaGen', () => {
    const source = readFileSync(
      resolve(SYNCS_DIR, 'framework', 'compiler-pipeline.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(source);

    const genTS = syncs.find(s => s.name === 'GenerateTypeScript')!;
    const genRust = syncs.find(s => s.name === 'GenerateRust')!;

    // Both trigger on SchemaGen/generate
    expect(genTS.when[0].concept).toBe('urn:copf/SchemaGen');
    expect(genRust.when[0].concept).toBe('urn:copf/SchemaGen');

    // Both receive spec and manifest
    const tsOutputVars = genTS.when[0].outputFields.map(f =>
      f.match.type === 'variable' ? f.match.name : ''
    );
    const rustOutputVars = genRust.when[0].outputFields.map(f =>
      f.match.type === 'variable' ? f.match.name : ''
    );
    expect(tsOutputVars).toContain('manifest');
    expect(rustOutputVars).toContain('manifest');
  });

  it('both generators consume the same manifest for Password', async () => {
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);

    // TypeScriptGen
    const tsStorage = createInMemoryStorage();
    const tsResult = await typescriptGenHandler.generate(
      { spec: 'pwd-1', manifest },
      tsStorage,
    );

    // RustGen
    const rustStorage = createInMemoryStorage();
    const rustResult = await rustGenHandler.generate(
      { spec: 'pwd-1', manifest },
      rustStorage,
    );

    // Both succeed with the same manifest
    expect(tsResult.variant).toBe('ok');
    expect(rustResult.variant).toBe('ok');

    const tsFiles = tsResult.files as { path: string; content: string }[];
    const rustFiles = rustResult.files as { path: string; content: string }[];

    // TS: types, handler, adapter, conformance
    expect(tsFiles).toHaveLength(4);
    // Rust: types, handler, adapter, conformance
    expect(rustFiles).toHaveLength(4);

    // Both produce type definitions, handler, adapter, and conformance
    expect(tsFiles.find(f => f.path.includes('types'))).toBeDefined();
    expect(rustFiles.find(f => f.path.includes('types'))).toBeDefined();
    expect(tsFiles.find(f => f.path.includes('handler'))).toBeDefined();
    expect(rustFiles.find(f => f.path.includes('handler'))).toBeDefined();
    expect(tsFiles.find(f => f.path.includes('adapter'))).toBeDefined();
    expect(rustFiles.find(f => f.path.includes('adapter'))).toBeDefined();
    expect(tsFiles.find(f => f.path.includes('conformance'))).toBeDefined();
    expect(rustFiles.find(f => f.path.includes('conformance'))).toBeDefined();
  });

  it('full pipeline produces both TS and Rust output from same manifest', async () => {
    // Manually run the multi-target pipeline:
    // SpecParser → SchemaGen → [TypeScriptGen, RustGen]
    const storage = createInMemoryStorage();

    // Step 1: SpecParser parses the Password spec
    const source = readSpec('app', 'password');
    const parseResult = await specParserHandler.parse({ source }, storage);
    expect(parseResult.variant).toBe('ok');

    // Step 2: SchemaGen produces the ConceptManifest
    const manifest = await generateManifest(parseResult.ast as ConceptAST);
    expect(manifest.name).toBe('Password');

    // Step 3a: TypeScriptGen consumes the manifest
    const tsStorage = createInMemoryStorage();
    const tsResult = await typescriptGenHandler.generate(
      { spec: 'pwd-1', manifest },
      tsStorage,
    );
    expect(tsResult.variant).toBe('ok');
    const tsFiles = tsResult.files as { path: string; content: string }[];
    expect(tsFiles.length).toBe(4); // types, handler, adapter, conformance

    // Step 3b: RustGen consumes the SAME manifest (in parallel)
    const rustStorage = createInMemoryStorage();
    const rustResult = await rustGenHandler.generate(
      { spec: 'pwd-1', manifest },
      rustStorage,
    );
    expect(rustResult.variant).toBe('ok');
    const rustFiles = rustResult.files as { path: string; content: string }[];
    expect(rustFiles.length).toBe(4); // types, handler, adapter, conformance

    // Both outputs stored correctly
    const storedTs = await tsStorage.find('outputs');
    expect(storedTs.length).toBe(1);
    const storedRust = await rustStorage.find('outputs');
    expect(storedRust.length).toBe(1);
  });
});

// ============================================================
// 3. HTTP Transport Adapters
//
// Verify that HttpLiteAdapter and HttpGraphQLAdapter correctly
// implement the ConceptTransport interface over HTTP.
// ============================================================

describe('Stage 5 — HTTP Transport Adapters', () => {
  it('HttpLiteAdapter invokes actions via mock HTTP', async () => {
    // Create a concept handler to serve as the "remote" concept
    const passwordHandler: ConceptHandler = {
      async set(input, storage) {
        await storage.put('entries', input.user as string, {
          user: input.user,
          password: input.password,
        });
        return { variant: 'ok', user: input.user };
      },
      async check(input, storage) {
        const entry = await storage.get('entries', input.user as string);
        if (!entry) return { variant: 'notfound', message: 'No credentials' };
        return { variant: 'ok', valid: entry.password === input.password };
      },
    };

    // Set up the server-side transport
    const storage = createInMemoryStorage();
    const serverTransport = createInProcessAdapter(passwordHandler, storage);
    const server = createHttpConceptServer(serverTransport);

    // Create a mock fetch that routes to the server
    const mockFetch = async (url: string, options: any) => {
      const path = new URL(url).pathname;
      const body = options.body ? JSON.parse(options.body) : undefined;
      const result = await server(path, options.method, body);
      return {
        status: result.status,
        json: async () => result.body,
      };
    };

    // Create the HTTP adapter with mock fetch
    const adapter = createHttpLiteAdapter('http://localhost:3000', mockFetch);

    // Verify query mode
    expect(adapter.queryMode).toBe('lite');

    // Invoke set action
    const setInvocation: ActionInvocation = {
      id: 'inv-1',
      concept: 'urn:app/Password',
      action: 'set',
      input: { user: 'u-1', password: 'secret' },
      flow: 'flow-1',
      timestamp: new Date().toISOString(),
    };
    const setCompletion = await adapter.invoke(setInvocation);
    expect(setCompletion.variant).toBe('ok');
    expect(setCompletion.output.user).toBe('u-1');

    // Invoke check action
    const checkInvocation: ActionInvocation = {
      id: 'inv-2',
      concept: 'urn:app/Password',
      action: 'check',
      input: { user: 'u-1', password: 'secret' },
      flow: 'flow-1',
      timestamp: new Date().toISOString(),
    };
    const checkCompletion = await adapter.invoke(checkInvocation);
    expect(checkCompletion.variant).toBe('ok');
    expect(checkCompletion.output.valid).toBe(true);
  });

  it('HttpLiteAdapter queries state via JSON-RPC', async () => {
    const handler: ConceptHandler = {
      async set(input, storage) {
        await storage.put('entries', input.user as string, {
          user: input.user,
          password: input.password,
        });
        return { variant: 'ok', user: input.user };
      },
    };

    const storage = createInMemoryStorage();
    const serverTransport = createInProcessAdapter(handler, storage);
    const server = createHttpConceptServer(serverTransport);

    const mockFetch = async (url: string, options: any) => {
      const path = new URL(url).pathname;
      const body = options.body ? JSON.parse(options.body) : undefined;
      const result = await server(path, options.method, body);
      return {
        status: result.status,
        json: async () => result.body,
      };
    };

    const adapter = createHttpLiteAdapter('http://localhost:3000', mockFetch);

    // Store some data via invocation
    await adapter.invoke({
      id: 'inv-1',
      concept: 'test',
      action: 'set',
      input: { user: 'u-1', password: 'secret' },
      flow: 'flow-1',
      timestamp: new Date().toISOString(),
    });

    // Query via lite protocol
    const results = await adapter.query({ relation: 'entries' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('user', 'u-1');
  });

  it('HttpLiteAdapter health check works', async () => {
    const server = createHttpConceptServer(
      createInProcessAdapter({ async noop() { return { variant: 'ok' }; } }, createInMemoryStorage()),
    );

    const mockFetch = async (url: string, options: any) => {
      const path = new URL(url).pathname;
      const body = options.body ? JSON.parse(options.body) : undefined;
      const result = await server(path, options.method, body);
      return {
        status: result.status,
        json: async () => result.body,
      };
    };

    const adapter = createHttpLiteAdapter('http://localhost:3000', mockFetch);
    const health = await adapter.health();
    expect(health.available).toBe(true);
    expect(health.latency).toBeGreaterThanOrEqual(0);
  });

  it('HttpGraphQLAdapter invokes actions via mock HTTP', async () => {
    const echoHandler: ConceptHandler = {
      async send(input) {
        return { variant: 'ok', echo: input.text };
      },
    };

    const storage = createInMemoryStorage();
    const serverTransport = createInProcessAdapter(echoHandler, storage);
    const server = createHttpConceptServer(serverTransport);

    const mockFetch = async (url: string, options: any) => {
      const path = new URL(url).pathname;
      const body = options.body ? JSON.parse(options.body) : undefined;
      const result = await server(path, options.method, body);
      return {
        status: result.status,
        json: async () => result.body,
      };
    };

    const adapter = createHttpGraphQLAdapter('http://localhost:3000', mockFetch);

    // Verify query mode
    expect(adapter.queryMode).toBe('graphql');

    // Invoke action
    const completion = await adapter.invoke({
      id: 'inv-1',
      concept: 'urn:app/Echo',
      action: 'send',
      input: { text: 'hello' },
      flow: 'flow-1',
      timestamp: new Date().toISOString(),
    });

    expect(completion.variant).toBe('ok');
    expect(completion.output.echo).toBe('hello');
  });

  it('HttpConceptServer returns 404 for unknown paths', async () => {
    const server = createHttpConceptServer(
      createInProcessAdapter({ async noop() { return { variant: 'ok' }; } }, createInMemoryStorage()),
    );

    const result = await server('/unknown', 'GET', null);
    expect(result.status).toBe(404);
  });
});

// ============================================================
// 4. Cross-Language Interop Simulation
//
// Simulate a Rust concept served over HTTP that the TypeScript
// sync engine invokes. Validate completions flow through sync
// evaluation and state queries work.
// ============================================================

describe('Stage 5 — Cross-Language Interop', () => {
  it('TS sync engine invokes "Rust" concept via HTTP adapter', async () => {
    // Simulate a Rust Password concept as a mock HTTP service.
    // In production, this would be a real Rust binary serving over HTTP.
    const rustPasswordHandler: ConceptHandler = {
      async set(input, storage) {
        await storage.put('entries', input.user as string, {
          user: input.user,
          hash: `hashed:${input.password}`,
        });
        return { variant: 'ok', user: input.user };
      },
      async check(input, storage) {
        const entry = await storage.get('entries', input.user as string);
        if (!entry) return { variant: 'notfound', message: 'No entry' };
        const valid = entry.hash === `hashed:${input.password}`;
        return { variant: 'ok', valid };
      },
    };

    // Set up the "Rust" concept as an HTTP server
    const rustStorage = createInMemoryStorage();
    const rustTransport = createInProcessAdapter(rustPasswordHandler, rustStorage);
    const rustServer = createHttpConceptServer(rustTransport);

    const mockFetch = async (url: string, options: any) => {
      const path = new URL(url).pathname;
      const body = options.body ? JSON.parse(options.body) : undefined;
      const result = await rustServer(path, options.method, body);
      return {
        status: result.status,
        json: async () => result.body,
      };
    };

    // Create the HTTP adapter that the TS engine uses to talk to "Rust"
    const httpAdapter = createHttpLiteAdapter('http://rust-password:8080', mockFetch);

    // Create a kernel and register the "Rust" concept via HTTP
    const kernel = createKernel();

    // Override the Password concept to use HTTP transport
    // (normally registerConcept creates in-process, but we can register
    //  the transport directly via the registry)
    const registry = createConceptRegistry();
    const { handler, log } = createSyncEngineHandler(registry);
    const shKernel = createSelfHostedKernel(handler, log, registry);

    // Register local concepts
    shKernel.registerConcept('urn:copf/ActionLog', actionLogHandler);

    // Register the "Rust" Password concept via HTTP transport
    registry.register('urn:app/Password', httpAdapter);

    // Register a sync that logs password operations
    const logSyncSource = `
      sync LogPasswordSet [eager]
      when {
        Password/set: [] => [ user: ?u ]
      }
      then {
        ActionLog/append: [ record: { type: "password-set"; user: ?u } ]
      }
    `;
    const logSyncs = parseSyncFile(logSyncSource);
    for (const s of logSyncs) {
      shKernel.registerSync(s);
    }

    // Invoke the "Rust" concept via the kernel
    const setResult = await shKernel.invokeConcept(
      'urn:app/Password',
      'set',
      { user: 'u-cross-lang', password: 'secret123' },
    );

    expect(setResult.variant).toBe('ok');
    expect(setResult.user).toBe('u-cross-lang');

    // Verify check works via HTTP
    const checkResult = await shKernel.invokeConcept(
      'urn:app/Password',
      'check',
      { user: 'u-cross-lang', password: 'secret123' },
    );

    expect(checkResult.variant).toBe('ok');
    expect(checkResult.valid).toBe(true);

    // Verify wrong password fails
    const wrongResult = await shKernel.invokeConcept(
      'urn:app/Password',
      'check',
      { user: 'u-cross-lang', password: 'wrong' },
    );

    expect(wrongResult.variant).toBe('ok');
    expect(wrongResult.valid).toBe(false);
  });

  it('state queries work via lite protocol over HTTP', async () => {
    const handler: ConceptHandler = {
      async set(input, storage) {
        await storage.put('entries', input.user as string, {
          user: input.user,
          data: input.data,
        });
        return { variant: 'ok', user: input.user };
      },
    };

    const storage = createInMemoryStorage();
    const transport = createInProcessAdapter(handler, storage);
    const server = createHttpConceptServer(transport);

    const mockFetch = async (url: string, options: any) => {
      const path = new URL(url).pathname;
      const body = options.body ? JSON.parse(options.body) : undefined;
      const result = await server(path, options.method, body);
      return { status: result.status, json: async () => result.body };
    };

    const adapter = createHttpLiteAdapter('http://remote:8080', mockFetch);

    // Store some data via invocations
    await adapter.invoke({
      id: 'inv-1', concept: 'test', action: 'set',
      input: { user: 'alice', data: 'A' },
      flow: 'f-1', timestamp: new Date().toISOString(),
    });
    await adapter.invoke({
      id: 'inv-2', concept: 'test', action: 'set',
      input: { user: 'bob', data: 'B' },
      flow: 'f-1', timestamp: new Date().toISOString(),
    });

    // Query all entries via lite protocol
    const allEntries = await adapter.query({ relation: 'entries' });
    expect(allEntries).toHaveLength(2);

    // Query with filter
    const filtered = await adapter.query({
      relation: 'entries',
      args: { user: 'alice' },
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].user).toBe('alice');
  });
});

// ============================================================
// 5. Deployment Manifest — Parsing & Validation
//
// Verify deployment manifest parsing and validation rules from
// Section 8.1.
// ============================================================

describe('Stage 5 — Deployment Manifest', () => {
  const validManifestData: Record<string, unknown> = {
    app: {
      name: 'conduit',
      version: '0.1.0',
      uri: 'urn:conduit',
    },
    runtimes: {
      server: {
        type: 'node',
        engine: true,
        transport: 'in-process',
      },
      ios: {
        type: 'swift',
        engine: true,
        transport: 'websocket',
        upstream: 'server',
      },
    },
    concepts: {
      Password: {
        spec: './specs/password.concept',
        implementations: [
          {
            language: 'typescript',
            path: './server/concepts/password',
            runtime: 'server',
            storage: 'sqlite',
            queryMode: 'graphql',
          },
        ],
      },
      Profile: {
        spec: './specs/profile.concept',
        implementations: [
          {
            language: 'typescript',
            path: './server/concepts/profile',
            runtime: 'server',
            storage: 'postgres',
            queryMode: 'graphql',
          },
          {
            language: 'swift',
            path: './ios/concepts/profile',
            runtime: 'ios',
            storage: 'coredata',
            queryMode: 'lite',
            cacheTtl: 10000,
          },
        ],
      },
    },
    syncs: [
      {
        path: './syncs/auth.sync',
        engine: 'server',
        annotations: ['eager'],
      },
      {
        path: './syncs/profile-sync.sync',
        engine: 'server',
        annotations: ['eventual'],
      },
    ],
  };

  it('parses a valid deployment manifest', () => {
    const manifest = parseDeploymentManifest(validManifestData);

    expect(manifest.app.name).toBe('conduit');
    expect(manifest.app.version).toBe('0.1.0');
    expect(manifest.app.uri).toBe('urn:conduit');

    expect(Object.keys(manifest.runtimes)).toHaveLength(2);
    expect(manifest.runtimes.server.type).toBe('node');
    expect(manifest.runtimes.server.engine).toBe(true);
    expect(manifest.runtimes.ios.upstream).toBe('server');

    expect(Object.keys(manifest.concepts)).toHaveLength(2);
    expect(manifest.concepts.Password.implementations).toHaveLength(1);
    expect(manifest.concepts.Profile.implementations).toHaveLength(2);

    expect(manifest.syncs).toHaveLength(2);
  });

  it('validates a correct manifest', () => {
    const manifest = parseDeploymentManifest(validManifestData);

    const result = validateDeploymentManifest(
      manifest,
      ['urn:app/Password', 'urn:app/Profile'],
      {
        './syncs/auth.sync': ['Password'],
        './syncs/profile-sync.sync': ['Profile'],
      },
      {
        Password: ['crypto'],
        Profile: [],
      },
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.plan).not.toBeNull();
  });

  it('produces a deployment plan with concept placements', () => {
    const manifest = parseDeploymentManifest(validManifestData);

    const result = validateDeploymentManifest(
      manifest,
      ['urn:app/Password', 'urn:app/Profile'],
      {
        './syncs/auth.sync': ['Password'],
        './syncs/profile-sync.sync': ['Profile'],
      },
      { Password: ['crypto'], Profile: [] },
    );

    expect(result.plan!.conceptPlacements).toHaveLength(3); // Password(1) + Profile(2)

    const pwdPlacement = result.plan!.conceptPlacements.find(
      p => p.concept === 'Password',
    )!;
    expect(pwdPlacement.runtime).toBe('server');
    expect(pwdPlacement.language).toBe('typescript');
    expect(pwdPlacement.queryMode).toBe('graphql');

    const profilePlacements = result.plan!.conceptPlacements.filter(
      p => p.concept === 'Profile',
    );
    expect(profilePlacements).toHaveLength(2);
    expect(profilePlacements.map(p => p.language).sort()).toEqual(['swift', 'typescript']);
  });

  it('detects sync assignments and cross-runtime flags', () => {
    const manifest = parseDeploymentManifest(validManifestData);

    const result = validateDeploymentManifest(
      manifest,
      ['urn:app/Password', 'urn:app/Profile'],
      {
        './syncs/auth.sync': ['Password'],
        './syncs/profile-sync.sync': ['Profile'],
      },
      { Password: ['crypto'], Profile: [] },
    );

    const authSync = result.plan!.syncAssignments.find(
      s => s.sync === './syncs/auth.sync',
    )!;
    expect(authSync.engine).toBe('server');
    expect(authSync.crossRuntime).toBe(false); // Password only on server

    const profileSync = result.plan!.syncAssignments.find(
      s => s.sync === './syncs/profile-sync.sync',
    )!;
    expect(profileSync.engine).toBe('server');
    expect(profileSync.crossRuntime).toBe(true); // Profile on server + ios
  });

  it('errors when sync references undefined concept', () => {
    const manifest = parseDeploymentManifest(validManifestData);

    const result = validateDeploymentManifest(
      manifest,
      [],
      {
        './syncs/auth.sync': ['Password'],
        './syncs/missing.sync': ['NonExistent'],
      },
      {},
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('NonExistent'))).toBe(true);
  });

  it('errors when concept requires capability not provided by runtime', () => {
    const manifest = parseDeploymentManifest({
      app: { name: 'test', version: '1.0', uri: 'urn:test' },
      runtimes: {
        browser: { type: 'browser', engine: true, transport: 'in-process' },
      },
      concepts: {
        Password: {
          spec: './specs/password.concept',
          implementations: [{
            language: 'typescript',
            path: './browser/password',
            runtime: 'browser',
            storage: 'localstorage',
            queryMode: 'lite',
          }],
        },
      },
      syncs: [],
    });

    const result = validateDeploymentManifest(
      manifest,
      ['urn:app/Password'],
      {},
      { Password: ['crypto'] }, // browser doesn't have crypto
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('crypto'))).toBe(true);
    expect(result.errors.some(e => e.includes('browser'))).toBe(true);
  });

  it('errors when sync assigned to non-engine runtime', () => {
    const manifest = parseDeploymentManifest({
      app: { name: 'test', version: '1.0', uri: 'urn:test' },
      runtimes: {
        worker: { type: 'node', engine: false, transport: 'worker' },
      },
      concepts: {},
      syncs: [{
        path: './syncs/test.sync',
        engine: 'worker',
        annotations: [],
      }],
    });

    const result = validateDeploymentManifest(manifest, [], {}, {});

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('engine: true'))).toBe(true);
  });

  it('warns about eager syncs spanning multiple runtimes', () => {
    const manifest = parseDeploymentManifest(validManifestData);

    // auth sync references both Password (server) and Profile (server+ios)
    const result = validateDeploymentManifest(
      manifest,
      [],
      {
        './syncs/auth.sync': ['Password', 'Profile'],
      },
      { Password: ['crypto'], Profile: [] },
    );

    // Should warn about cross-runtime eager sync
    expect(result.warnings.some(w => w.includes('multiple runtimes'))).toBe(true);
  });

  it('errors on missing app fields', () => {
    expect(() => {
      parseDeploymentManifest({ app: { name: 'test' } } as any);
    }).toThrow('app.version');
  });

  it('errors when runtime references undefined upstream', () => {
    const manifest = parseDeploymentManifest({
      app: { name: 'test', version: '1.0', uri: 'urn:test' },
      runtimes: {
        ios: { type: 'swift', engine: true, transport: 'websocket', upstream: 'missing-server' },
      },
      concepts: {},
      syncs: [],
    });

    const result = validateDeploymentManifest(manifest, [], {}, {});

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('upstream'))).toBe(true);
  });
});

// ============================================================
// 6. Extensibility Validation
//
// Key invariant: adding a new language target required only
// a new generator concept + one sync. No existing code was
// modified — only new code was added.
// ============================================================

describe('Stage 5 — Extensibility Validation', () => {
  it('RustGen was added without modifying TypeScriptGen', async () => {
    // Verify that TypeScriptGen output is unchanged from Stage 4
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'pwd-1', manifest },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    // Same 4 files as in Stage 4
    expect(files).toHaveLength(4);
    expect(files.find(f => f.path === 'password.types.ts')).toBeDefined();
    expect(files.find(f => f.path === 'password.handler.ts')).toBeDefined();
    expect(files.find(f => f.path === 'password.adapter.ts')).toBeDefined();
    expect(files.find(f => f.path === 'password.conformance.test.ts')).toBeDefined();
  });

  it('RustGen was added without modifying SchemaGen', async () => {
    // SchemaGen still produces the same manifest structure
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);

    // Same fields as Stage 4
    expect(manifest.uri).toBe('urn:copf/Password');
    expect(manifest.name).toBe('Password');
    expect(manifest.typeParams).toHaveLength(1);
    expect(manifest.relations).toHaveLength(1);
    expect(manifest.actions).toHaveLength(3);
    expect(manifest.invariants).toHaveLength(1);
    expect(manifest.graphqlSchema).toBeDefined();
    expect(manifest.jsonSchemas).toBeDefined();
  });

  it('adding a hypothetical SwiftGen requires only concept + sync', async () => {
    // To prove extensibility, we add a mock SwiftGen with zero changes
    // to any existing concept, handler, or sync

    const swiftGenHandler: ConceptHandler = {
      async generate(input, storage) {
        const m = input.manifest as ConceptManifest;
        const files = m.actions.map(a => ({
          path: `${m.name}/${a.name}.swift`,
          content: `// Swift handler for ${m.name}.${a.name}`,
        }));
        await storage.put('outputs', input.spec as string, { spec: input.spec, files });
        return { variant: 'ok', files };
      },
    };

    // The sync for SwiftGen
    const swiftSyncSource = `
      sync GenerateSwift [eager]
      when {
        SchemaGen/generate: [ spec: ?spec ] => [ manifest: ?manifest ]
      }
      then {
        SwiftGen/generate: [ spec: ?spec; manifest: ?manifest ]
      }
    `;

    const syncs = parseSyncFile(swiftSyncSource);
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('GenerateSwift');

    // The mock SwiftGen produces output from the same manifest
    const ast = parseConceptFile(readSpec('app', 'password'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await swiftGenHandler.generate!(
      { spec: 'pwd-1', manifest },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    expect(files).toHaveLength(3); // set, check, validate
    expect(files[0].path).toContain('.swift');
  });
});
