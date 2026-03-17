// ============================================================
// DSL Codegen — All Languages Verification
//
// Validates that all four language generators (TypeScript, Rust,
// Solidity, Swift) emit StorageProgram DSL runtime files with
// lenses/optics, effect tracking, algebraic effects, transport
// effects, and functorial render program mapping.
// ============================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createInMemoryStorage } from '../runtime/index.js';
import { parseConceptFile } from '../handlers/ts/framework/parser.js';
import { schemaGenHandler } from '../handlers/ts/framework/schema-gen.handler.js';
import { typescriptGenHandler } from '../handlers/ts/framework/typescript-gen.handler.js';
import { rustGenHandler } from '../handlers/ts/framework/rust-gen.handler.js';
import { solidityGenHandler } from '../handlers/ts/framework/solidity-gen.handler.js';
import { swiftGenHandler } from '../handlers/ts/framework/swift-gen.handler.js';
import type { ConceptAST, ConceptManifest } from '../runtime/types.js';

const ROOT = resolve(__dirname, '..');
const SPECS_DIR = resolve(ROOT, 'specs');

function readSpec(category: string, name: string): string {
  return readFileSync(resolve(SPECS_DIR, category, `${name}.concept`), 'utf-8');
}

async function generateManifest(ast: ConceptAST): Promise<ConceptManifest> {
  const storage = createInMemoryStorage();
  const result = await schemaGenHandler.generate(
    { spec: 'test', ast },
    storage,
  );
  expect(result.variant).toBe('ok');
  return result.manifest as ConceptManifest;
}

// Parse and generate manifest for a concept with invariants
let passwordManifest: ConceptManifest;

beforeAll(async () => {
  const source = readSpec('app', 'password');
  const ast = parseConceptFile(source);
  passwordManifest = await generateManifest(ast);
});

// ============================================================
// 1. Generator Registration — DSL Runtime Capability
// ============================================================

describe('Generator Registration — dsl-runtime capability', () => {
  it('TypeScriptGen registers dsl-runtime capability', async () => {
    const result = await typescriptGenHandler.register!();
    const caps = JSON.parse(result.capabilities as string);
    expect(caps).toContain('dsl-runtime');
  });

  it('RustGen registers dsl-runtime capability', async () => {
    const result = await rustGenHandler.register!();
    const caps = JSON.parse(result.capabilities as string);
    expect(caps).toContain('dsl-runtime');
  });

  it('SolidityGen registers dsl-runtime capability', async () => {
    const result = await solidityGenHandler.register!();
    const caps = JSON.parse(result.capabilities as string);
    expect(caps).toContain('dsl-runtime');
  });

  it('SwiftGen registers dsl-runtime capability', async () => {
    const result = await swiftGenHandler.register!();
    const caps = JSON.parse(result.capabilities as string);
    expect(caps).toContain('dsl-runtime');
  });
});

// ============================================================
// 2. TypeScript DSL Runtime Generation
// ============================================================

describe('TypeScript DSL Runtime Generation', () => {
  let files: { path: string; content: string }[];
  let dslFile: { path: string; content: string };

  beforeAll(async () => {
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'dsl-test', manifest: passwordManifest },
      storage,
    );
    expect(result.variant).toBe('ok');
    files = result.files as { path: string; content: string }[];
    dslFile = files.find(f => f.path.includes('storage-program.dsl'))!;
  });

  it('generates DSL runtime file', () => {
    expect(dslFile).toBeDefined();
    expect(dslFile.path).toBe('storage-program.dsl.stub.ts');
  });

  // Lenses
  it('includes StateLens type', () => {
    expect(dslFile.content).toContain('interface StateLens');
    expect(dslFile.content).toContain('LensSegment');
  });

  it('includes lens builders: relation, at, field, composeLens', () => {
    expect(dslFile.content).toContain('function relation(');
    expect(dslFile.content).toContain('function at(');
    expect(dslFile.content).toContain('function field(');
    expect(dslFile.content).toContain('function composeLens(');
  });

  // Effect Set
  it('includes EffectSet with all four dimensions', () => {
    expect(dslFile.content).toContain('interface EffectSet');
    expect(dslFile.content).toContain('reads: ReadonlySet<string>');
    expect(dslFile.content).toContain('writes: ReadonlySet<string>');
    expect(dslFile.content).toContain('completionVariants: ReadonlySet<string>');
    expect(dslFile.content).toContain('performs: ReadonlySet<string>');
  });

  it('includes Purity type and purityOf function', () => {
    expect(dslFile.content).toContain("type Purity = 'pure' | 'read-only' | 'read-write'");
    expect(dslFile.content).toContain('function purityOf(');
  });

  it('includes mergeEffects', () => {
    expect(dslFile.content).toContain('function mergeEffects(');
  });

  // StorageProgram
  it('includes StorageProgram interface and createProgram', () => {
    expect(dslFile.content).toContain('interface StorageProgram<A>');
    expect(dslFile.content).toContain('function createProgram()');
  });

  it('includes all instruction builders: get, put, getLens, putLens, modifyLens', () => {
    expect(dslFile.content).toContain('function get(');
    expect(dslFile.content).toContain('function put(');
    expect(dslFile.content).toContain('function getLens(');
    expect(dslFile.content).toContain('function putLens(');
    expect(dslFile.content).toContain('function modifyLens(');
  });

  // Algebraic effects
  it('includes complete() for algebraic effects', () => {
    expect(dslFile.content).toContain('function complete<');
    expect(dslFile.content).toContain('completionVariants');
  });

  // Transport effects
  it('includes perform() for transport effects', () => {
    expect(dslFile.content).toContain('function perform(');
    expect(dslFile.content).toContain('protocol: string');
    expect(dslFile.content).toContain('operation: string');
  });

  // Analysis
  it('includes extractCompletionVariants and extractPerformSet', () => {
    expect(dslFile.content).toContain('function extractCompletionVariants(');
    expect(dslFile.content).toContain('function extractPerformSet(');
  });

  it('includes validatePurity', () => {
    expect(dslFile.content).toContain('function validatePurity(');
  });

  // Render Program
  it('includes RenderInstruction with all tags', () => {
    expect(dslFile.content).toContain('type RenderInstruction');
    expect(dslFile.content).toContain("tag: 'token'");
    expect(dslFile.content).toContain("tag: 'aria'");
    expect(dslFile.content).toContain("tag: 'bind'");
    expect(dslFile.content).toContain("tag: 'element'");
    expect(dslFile.content).toContain("tag: 'focus'");
    expect(dslFile.content).toContain("tag: 'keyboard'");
  });

  it('includes RenderProgram with mapRenderProgram', () => {
    expect(dslFile.content).toContain('interface RenderProgram');
    expect(dslFile.content).toContain('function mapRenderProgram(');
  });

  // Backward compat: still produces the 4 standard files
  it('still generates all standard concept files', () => {
    expect(files.find(f => f.path.endsWith('.types.stub.ts'))).toBeDefined();
    expect(files.find(f => f.path.endsWith('.handler.stub.ts'))).toBeDefined();
    expect(files.find(f => f.path.endsWith('.adapter.stub.ts'))).toBeDefined();
    expect(files.find(f => f.path.endsWith('.conformance.stub.test.ts'))).toBeDefined();
  });
});

// ============================================================
// 3. Rust DSL Runtime Generation
// ============================================================

describe('Rust DSL Runtime Generation', () => {
  let files: { path: string; content: string }[];
  let dslFile: { path: string; content: string };

  beforeAll(async () => {
    const storage = createInMemoryStorage();
    const result = await rustGenHandler.generate(
      { spec: 'dsl-test', manifest: passwordManifest },
      storage,
    );
    expect(result.variant).toBe('ok');
    files = result.files as { path: string; content: string }[];
    dslFile = files.find(f => f.path.includes('storage_program_dsl'))!;
  });

  it('generates DSL runtime file', () => {
    expect(dslFile).toBeDefined();
    expect(dslFile.path).toBe('storage_program_dsl.stub.rs');
  });

  // Lenses
  it('includes StateLens struct and LensSegment enum', () => {
    expect(dslFile.content).toContain('pub struct StateLens');
    expect(dslFile.content).toContain('pub enum LensSegment');
  });

  it('includes lens builder methods', () => {
    expect(dslFile.content).toContain('fn relation(name:');
    expect(dslFile.content).toContain('fn at(');
    expect(dslFile.content).toContain('fn field(');
    expect(dslFile.content).toContain('fn compose(');
  });

  // Effect Set
  it('includes EffectSet with completion_variants and performs', () => {
    expect(dslFile.content).toContain('pub struct EffectSet');
    expect(dslFile.content).toContain('pub completion_variants: HashSet<String>');
    expect(dslFile.content).toContain('pub performs: HashSet<String>');
  });

  it('includes Purity enum', () => {
    expect(dslFile.content).toContain('pub enum Purity');
    expect(dslFile.content).toContain('Pure');
    expect(dslFile.content).toContain('ReadOnly');
    expect(dslFile.content).toContain('ReadWrite');
  });

  it('includes validate_purity', () => {
    expect(dslFile.content).toContain('fn validate_purity(');
  });

  // StorageProgram
  it('includes StorageProgram struct with builder methods', () => {
    expect(dslFile.content).toContain('pub struct StorageProgram');
    expect(dslFile.content).toContain('fn new()');
    expect(dslFile.content).toContain('fn get(');
    expect(dslFile.content).toContain('fn put(');
    expect(dslFile.content).toContain('fn get_lens(');
    expect(dslFile.content).toContain('fn put_lens(');
  });

  // Algebraic effects
  it('includes complete() method', () => {
    expect(dslFile.content).toContain('fn complete(');
    expect(dslFile.content).toContain('completion_variants');
  });

  // Transport effects
  it('includes perform() method', () => {
    expect(dslFile.content).toContain('fn perform(');
    expect(dslFile.content).toContain('protocol:');
    expect(dslFile.content).toContain('operation:');
  });

  // Analysis
  it('includes extract_completion_variants and extract_perform_set', () => {
    expect(dslFile.content).toContain('fn extract_completion_variants(');
    expect(dslFile.content).toContain('fn extract_perform_set(');
  });

  // Render Program
  it('includes RenderInstruction and RenderProgram', () => {
    expect(dslFile.content).toContain('pub enum RenderInstruction');
    expect(dslFile.content).toContain('pub struct RenderProgram');
    expect(dslFile.content).toContain('fn map<F>(');
  });

  it('includes all render instruction variants', () => {
    expect(dslFile.content).toContain('Token {');
    expect(dslFile.content).toContain('Aria {');
    expect(dslFile.content).toContain('Bind {');
    expect(dslFile.content).toContain('Element {');
    expect(dslFile.content).toContain('Focus {');
    expect(dslFile.content).toContain('Keyboard {');
  });

  // Uses Rust idioms
  it('uses Rust idioms: derive macros, impl blocks', () => {
    expect(dslFile.content).toContain('#[derive(Debug, Clone');
    expect(dslFile.content).toContain('#[serde(tag =');
    expect(dslFile.content).toContain('impl StorageProgram');
    expect(dslFile.content).toContain('impl EffectSet');
    expect(dslFile.content).toContain('impl StateLens');
  });

  // Backward compat
  it('still generates all standard concept files', () => {
    expect(files.find(f => f.path.endsWith('types.stub.rs'))).toBeDefined();
    expect(files.find(f => f.path.endsWith('handler.stub.rs'))).toBeDefined();
    expect(files.find(f => f.path.endsWith('adapter.stub.rs'))).toBeDefined();
    expect(files.find(f => f.path.endsWith('conformance.stub.rs'))).toBeDefined();
  });
});

// ============================================================
// 4. Solidity DSL Runtime Generation
// ============================================================

describe('Solidity DSL Runtime Generation', () => {
  let files: { path: string; content: string }[];
  let dslFile: { path: string; content: string };

  beforeAll(async () => {
    const storage = createInMemoryStorage();
    const result = await solidityGenHandler.generate(
      { spec: 'dsl-test', manifest: passwordManifest },
      storage,
    );
    expect(result.variant).toBe('ok');
    files = result.files as { path: string; content: string }[];
    dslFile = files.find(f => f.path.includes('StorageProgramDSL'))!;
  });

  it('generates DSL runtime file', () => {
    expect(dslFile).toBeDefined();
    expect(dslFile.path).toBe('src/StorageProgramDSL.stub.sol');
  });

  // Solidity-specific: SPDX + pragma
  it('includes SPDX license and pragma', () => {
    expect(dslFile.content).toContain('SPDX-License-Identifier: MIT');
    expect(dslFile.content).toContain('pragma solidity ^0.8.20');
  });

  // Lenses
  it('includes StateLens struct and LensLib library', () => {
    expect(dslFile.content).toContain('struct StateLens');
    expect(dslFile.content).toContain('enum LensSegmentKind');
    expect(dslFile.content).toContain('library LensLib');
  });

  it('includes lens functions: relation, at, field', () => {
    expect(dslFile.content).toContain('function relation(');
    expect(dslFile.content).toContain('function at(');
    expect(dslFile.content).toContain('function field(');
  });

  // Effect Set
  it('includes EffectSet struct and PurityLevel enum', () => {
    expect(dslFile.content).toContain('struct EffectSet');
    expect(dslFile.content).toContain('enum PurityLevel');
    expect(dslFile.content).toContain('string[] completionVariants');
    expect(dslFile.content).toContain('string[] performs');
  });

  it('includes EffectLib with purityOf and validatePurity', () => {
    expect(dslFile.content).toContain('library EffectLib');
    expect(dslFile.content).toContain('function purityOf(');
    expect(dslFile.content).toContain('function validatePurity(');
  });

  // StorageProgram
  it('includes StorageProgram struct and StorageProgramLib library', () => {
    expect(dslFile.content).toContain('struct StorageProgram');
    expect(dslFile.content).toContain('library StorageProgramLib');
  });

  // Algebraic effects
  it('includes complete() in StorageProgramLib', () => {
    expect(dslFile.content).toContain('function complete(');
    expect(dslFile.content).toContain('completionVariants');
  });

  // Transport effects
  it('includes perform() in StorageProgramLib', () => {
    expect(dslFile.content).toContain('function perform(');
    expect(dslFile.content).toContain('protocol');
    expect(dslFile.content).toContain('operation');
  });

  // Render Program
  it('includes RenderInstruction and RenderProgram', () => {
    expect(dslFile.content).toContain('enum RenderInstructionTag');
    expect(dslFile.content).toContain('struct RenderInstruction');
    expect(dslFile.content).toContain('struct RenderProgram');
  });

  it('includes all render instruction tags', () => {
    expect(dslFile.content).toContain('Token');
    expect(dslFile.content).toContain('Aria');
    expect(dslFile.content).toContain('Bind');
    expect(dslFile.content).toContain('Element');
    expect(dslFile.content).toContain('Focus');
    expect(dslFile.content).toContain('Keyboard');
  });

  // Backward compat
  it('still generates contract file', () => {
    expect(files.find(f => f.path.endsWith('.stub.sol') && !f.path.includes('DSL') && !f.path.includes('.t.'))).toBeDefined();
  });
});

// ============================================================
// 5. Swift DSL Runtime Generation
// ============================================================

describe('Swift DSL Runtime Generation', () => {
  let files: { path: string; content: string }[];
  let dslFile: { path: string; content: string };

  beforeAll(async () => {
    const storage = createInMemoryStorage();
    const result = await swiftGenHandler.generate(
      { spec: 'dsl-test', manifest: passwordManifest },
      storage,
    );
    expect(result.variant).toBe('ok');
    files = result.files as { path: string; content: string }[];
    dslFile = files.find(f => f.path.includes('StorageProgramDSL'))!;
  });

  it('generates DSL runtime file', () => {
    expect(dslFile).toBeDefined();
    expect(dslFile.path).toBe('StorageProgramDSL.stub.swift');
  });

  // Lenses
  it('includes StateLens struct and LensSegment enum', () => {
    expect(dslFile.content).toContain('public struct StateLens');
    expect(dslFile.content).toContain('public enum LensSegment');
  });

  it('includes lens builder methods', () => {
    expect(dslFile.content).toContain('static func relation(');
    expect(dslFile.content).toContain('func at(');
    expect(dslFile.content).toContain('func field(');
    expect(dslFile.content).toContain('func compose(');
  });

  // Effect Set
  it('includes EffectSet with all four dimensions', () => {
    expect(dslFile.content).toContain('public struct EffectSet');
    expect(dslFile.content).toContain('var reads: Set<String>');
    expect(dslFile.content).toContain('var writes: Set<String>');
    expect(dslFile.content).toContain('var completionVariants: Set<String>');
    expect(dslFile.content).toContain('var performs: Set<String>');
  });

  it('includes Purity enum', () => {
    expect(dslFile.content).toContain('public enum Purity');
    expect(dslFile.content).toContain('case pure');
    expect(dslFile.content).toContain('case readOnly');
    expect(dslFile.content).toContain('case readWrite');
  });

  it('includes validatePurity', () => {
    expect(dslFile.content).toContain('func validatePurity(');
  });

  // StorageProgram
  it('includes StorageProgram struct with mutating methods', () => {
    expect(dslFile.content).toContain('public struct StorageProgram');
    expect(dslFile.content).toContain('static func create()');
    expect(dslFile.content).toContain('mutating func get(');
    expect(dslFile.content).toContain('mutating func put(');
    expect(dslFile.content).toContain('mutating func getLens(');
    expect(dslFile.content).toContain('mutating func putLens(');
  });

  // Algebraic effects
  it('includes complete() method', () => {
    expect(dslFile.content).toContain('mutating func complete(');
    expect(dslFile.content).toContain('completionVariants');
  });

  // Transport effects
  it('includes perform() method', () => {
    expect(dslFile.content).toContain('mutating func perform(');
  });

  // Analysis
  it('includes extractCompletionVariants and extractPerformSet', () => {
    expect(dslFile.content).toContain('func extractCompletionVariants()');
    expect(dslFile.content).toContain('func extractPerformSet()');
  });

  // Render Program
  it('includes RenderInstruction and RenderProgram', () => {
    expect(dslFile.content).toContain('public enum RenderInstruction');
    expect(dslFile.content).toContain('public struct RenderProgram');
    expect(dslFile.content).toContain('func map(');
  });

  it('includes all render instruction cases', () => {
    expect(dslFile.content).toContain('case token(');
    expect(dslFile.content).toContain('case aria(');
    expect(dslFile.content).toContain('case bind(');
    expect(dslFile.content).toContain('case element(');
    expect(dslFile.content).toContain('case focus(');
    expect(dslFile.content).toContain('case keyboard(');
  });

  // Swift idioms
  it('uses Swift idioms: import Foundation, Codable, public access', () => {
    expect(dslFile.content).toContain('import Foundation');
    expect(dslFile.content).toContain('Codable');
    expect(dslFile.content).toContain('public');
  });

  // Backward compat
  it('still generates all standard concept files', () => {
    expect(files.find(f => f.path.endsWith('Types.stub.swift'))).toBeDefined();
    expect(files.find(f => f.path.endsWith('Handler.stub.swift'))).toBeDefined();
    expect(files.find(f => f.path.endsWith('Adapter.stub.swift'))).toBeDefined();
    expect(files.find(f => f.path.endsWith('ConformanceTests.stub.swift'))).toBeDefined();
  });
});

// ============================================================
// 6. Cross-Language Feature Parity
// ============================================================

describe('Cross-Language Feature Parity', () => {
  let tsContent: string;
  let rsContent: string;
  let solContent: string;
  let swiftContent: string;

  beforeAll(async () => {
    const generators = [
      { handler: typescriptGenHandler, key: 'ts' },
      { handler: rustGenHandler, key: 'rs' },
      { handler: solidityGenHandler, key: 'sol' },
      { handler: swiftGenHandler, key: 'swift' },
    ];

    const contents: Record<string, string> = {};

    for (const gen of generators) {
      const storage = createInMemoryStorage();
      const result = await gen.handler.generate(
        { spec: 'parity-test', manifest: passwordManifest },
        storage,
      );
      const files = result.files as { path: string; content: string }[];
      const dsl = files.find(f =>
        f.path.includes('storage-program') ||
        f.path.includes('storage_program') ||
        f.path.includes('StorageProgramDSL')
      )!;
      contents[gen.key] = dsl.content;
    }

    tsContent = contents.ts;
    rsContent = contents.rs;
    solContent = contents.sol;
    swiftContent = contents.swift;
  });

  const features = [
    { name: 'Lens types', patterns: { ts: 'StateLens', rs: 'StateLens', sol: 'StateLens', swift: 'StateLens' } },
    { name: 'Effect set', patterns: { ts: 'EffectSet', rs: 'EffectSet', sol: 'EffectSet', swift: 'EffectSet' } },
    { name: 'Purity', patterns: { ts: 'Purity', rs: 'Purity', sol: 'PurityLevel', swift: 'Purity' } },
    { name: 'StorageProgram', patterns: { ts: 'StorageProgram', rs: 'StorageProgram', sol: 'StorageProgram', swift: 'StorageProgram' } },
    { name: 'Completion variants', patterns: { ts: 'completionVariants', rs: 'completion_variants', sol: 'completionVariants', swift: 'completionVariants' } },
    { name: 'Transport effects (performs)', patterns: { ts: 'performs', rs: 'performs', sol: 'performs', swift: 'performs' } },
    { name: 'RenderInstruction', patterns: { ts: 'RenderInstruction', rs: 'RenderInstruction', sol: 'RenderInstruction', swift: 'RenderInstruction' } },
    { name: 'RenderProgram', patterns: { ts: 'RenderProgram', rs: 'RenderProgram', sol: 'RenderProgram', swift: 'RenderProgram' } },
  ];

  for (const feature of features) {
    it(`all languages include ${feature.name}`, () => {
      expect(tsContent).toContain(feature.patterns.ts);
      expect(rsContent).toContain(feature.patterns.rs);
      expect(solContent).toContain(feature.patterns.sol);
      expect(swiftContent).toContain(feature.patterns.swift);
    });
  }
});

// ============================================================
// 7. Backward Compatibility — Existing E2E Pipeline Still Works
// ============================================================

describe('Backward Compatibility — Existing generation still works', () => {
  it('TypeScript: existing types/handler/adapter files unchanged', async () => {
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'compat-test', manifest: passwordManifest },
      storage,
    );
    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    const types = files.find(f => f.path.endsWith('.types.stub.ts'))!;
    expect(types.content).toContain('PasswordSetInput');
    const handler = files.find(f => f.path.endsWith('.handler.stub.ts'))!;
    expect(handler.content).toContain('PasswordHandler');
    const adapter = files.find(f => f.path.endsWith('.adapter.stub.ts'))!;
    expect(adapter.content).toContain('createPasswordLiteAdapter');
  });

  it('Rust: existing types/handler/adapter files unchanged', async () => {
    const storage = createInMemoryStorage();
    const result = await rustGenHandler.generate(
      { spec: 'compat-test', manifest: passwordManifest },
      storage,
    );
    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    const types = files.find(f => f.path.endsWith('types.stub.rs'))!;
    expect(types.content).toContain('pub struct PasswordSetInput');
    const handler = files.find(f => f.path.endsWith('handler.stub.rs'))!;
    expect(handler.content).toContain('pub trait PasswordHandler');
  });

  it('Solidity: existing contract file unchanged', async () => {
    const storage = createInMemoryStorage();
    const result = await solidityGenHandler.generate(
      { spec: 'compat-test', manifest: passwordManifest },
      storage,
    );
    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    const contract = files.find(f => f.path.endsWith('.stub.sol') && !f.path.includes('DSL') && !f.path.includes('.t.'))!;
    expect(contract.content).toContain('contract Password');
  });

  it('Swift: existing types/handler/adapter files unchanged', async () => {
    const storage = createInMemoryStorage();
    const result = await swiftGenHandler.generate(
      { spec: 'compat-test', manifest: passwordManifest },
      storage,
    );
    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    const types = files.find(f => f.path.endsWith('Types.stub.swift'))!;
    expect(types.content).toContain('Codable');
    const handler = files.find(f => f.path.endsWith('Handler.stub.swift'))!;
    expect(handler.content).toContain('protocol PasswordHandler');
  });
});
