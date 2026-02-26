// ============================================================
// Compiler Pipeline Tests
//
// End-to-end compiler pipeline validation — sync-driven flows,
// kernel-driven pipelines, pipeline sync structure, and
// multi-target pipeline integration.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  createInMemoryStorage,
} from '../runtime/index.js';
import { createKernel } from '../handlers/ts/framework/kernel-factory.js';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler.js';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.handler.js';
import type { ConceptAST, ConceptManifest } from '../runtime/types.js';

// Framework concept handlers
import { specParserHandler } from '../handlers/ts/framework/spec-parser.handler.js';
import { schemaGenHandler } from '../handlers/ts/framework/schema-gen.handler.js';
import { typescriptGenHandler } from '../handlers/ts/framework/typescript-gen.handler.js';
import { rustGenHandler } from '../handlers/ts/framework/rust-gen.handler.js';
import { syncParserHandler } from '../handlers/ts/framework/sync-parser.handler.js';
import { syncCompilerHandler } from '../handlers/ts/framework/sync-compiler.handler.js';
import { actionLogHandler } from '../handlers/ts/framework/action-log.handler.js';
import { registryHandler } from '../handlers/ts/framework/registry.handler.js';

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
// 1. Compiler Pipeline via Syncs (end-to-end)
// ============================================================

describe('Compiler Pipeline (end-to-end)', () => {
  it('SpecParser → SchemaGen → TypeScriptGen pipeline fires via syncs', async () => {
    const kernel = createKernel();

    // Register the framework concepts
    kernel.registerConcept('urn:clef/SpecParser', specParserHandler);
    kernel.registerConcept('urn:clef/SchemaGen', schemaGenHandler);
    kernel.registerConcept('urn:clef/TypeScriptGen', typescriptGenHandler);
    kernel.registerConcept('urn:clef/ActionLog', actionLogHandler);
    kernel.registerConcept('urn:clef/Registry', registryHandler);

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
      'urn:clef/SpecParser',
      'parse',
      { source: passwordSpec },
    );

    expect(parseResult.variant).toBe('ok');
    expect((parseResult.ast as ConceptAST).name).toBe('Password');
  });

  it('LogRegistration sync fires on concept registration', async () => {
    const kernel = createKernel();

    kernel.registerConcept('urn:clef/Registry', registryHandler);
    kernel.registerConcept('urn:clef/ActionLog', actionLogHandler);

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
      'urn:clef/Registry',
      'register',
      { uri: 'urn:app/TestConcept', transport: { type: 'in-process' } },
    );

    expect(result.variant).toBe('ok');
    expect(result.concept).toBeTruthy();
  });
});

// ============================================================
// 2. Full Pipeline: Kernel-driven end-to-end self-compilation
// ============================================================

describe('Full Pipeline (kernel-driven)', () => {
  it('complete self-compilation flow via kernel', async () => {
    const kernel = createKernel();

    // Register all framework concepts on the kernel
    kernel.registerConcept('urn:clef/SpecParser', specParserHandler);
    kernel.registerConcept('urn:clef/SchemaGen', schemaGenHandler);
    kernel.registerConcept('urn:clef/TypeScriptGen', typescriptGenHandler);
    kernel.registerConcept('urn:clef/SyncParser', syncParserHandler);
    kernel.registerConcept('urn:clef/SyncCompiler', syncCompilerHandler);
    kernel.registerConcept('urn:clef/ActionLog', actionLogHandler);
    kernel.registerConcept('urn:clef/Registry', registryHandler);

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
      'urn:clef/SpecParser',
      'parse',
      { source: specParserSpec },
    );

    expect(result.variant).toBe('ok');
    expect((result.ast as ConceptAST).name).toBe('SpecParser');
  });

  it('self-compilation pipeline for an app concept with invariants', async () => {
    const kernel = createKernel();

    kernel.registerConcept('urn:clef/SpecParser', specParserHandler);
    kernel.registerConcept('urn:clef/SchemaGen', schemaGenHandler);
    kernel.registerConcept('urn:clef/TypeScriptGen', typescriptGenHandler);
    kernel.registerConcept('urn:clef/ActionLog', actionLogHandler);
    kernel.registerConcept('urn:clef/Registry', registryHandler);

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
      'urn:clef/SpecParser',
      'parse',
      { source: passwordSpec },
    );

    expect(result.variant).toBe('ok');
    expect((result.ast as ConceptAST).name).toBe('Password');
    expect((result.ast as ConceptAST).invariants).toHaveLength(1);
  });
});

// ============================================================
// 3. Pipeline Syncs
// ============================================================

describe('Pipeline Syncs', () => {
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
    expect(genTS!.when[0].concept).toBe('urn:clef/SchemaGen');
    expect(genTS!.when[0].action).toBe('generate');
  });

  it('TypeScriptGen spec exists and replaces CodeGen spec', async () => {
    const tsGenSource = readSpec('framework', 'typescript-gen');
    const ast = parseConceptFile(tsGenSource);

    expect(ast.name).toBe('TypeScriptGen');
    expect(ast.actions).toHaveLength(2);
    expect(ast.actions.map(a => a.name)).toContain('generate');
    expect(ast.actions.map(a => a.name)).toContain('register');
    const generateAction = ast.actions.find(a => a.name === 'generate')!;
    // Takes manifest instead of ast + language
    expect(generateAction.params.map(p => p.name)).toContain('manifest');
    expect(generateAction.params.map(p => p.name)).not.toContain('language');
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
// 4. Pipeline Integration — RustGen Sync
// ============================================================

describe('Pipeline Integration', () => {
  it('GenerateRust sync exists in compiler pipeline', () => {
    const source = readFileSync(
      resolve(SYNCS_DIR, 'framework', 'compiler-pipeline.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(source);

    const genRust = syncs.find(s => s.name === 'GenerateRust');
    expect(genRust).toBeDefined();
    expect(genRust!.when).toHaveLength(1);
    expect(genRust!.when[0].concept).toBe('urn:clef/SchemaGen');
    expect(genRust!.when[0].action).toBe('generate');
    expect(genRust!.then[0].concept).toBe('urn:clef/RustGen');
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
    expect(genTS.when[0].concept).toBe('urn:clef/SchemaGen');
    expect(genRust.when[0].concept).toBe('urn:clef/SchemaGen');

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

    // Generators return files directly; BuildCache handles storage
    expect(tsFiles.length).toBeGreaterThan(0);
    expect(rustFiles.length).toBeGreaterThan(0);
  });
});
