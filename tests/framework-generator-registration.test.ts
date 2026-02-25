// ============================================================
// Framework Generator Registration Tests
//
// Validates that all framework generators implement the
// provider/PluginRegistry pattern by exposing a register action
// that returns static metadata compatible with the generation
// kit's RegisterGeneratorKinds and EnsureKindsDefined syncs.
//
// See generation kit syncs: register-generator-kinds.sync,
// ensure-kinds-defined.sync
// ============================================================

import { describe, it, expect } from 'vitest';
import { schemaGenHandler } from '../implementations/typescript/framework/schema-gen.impl.js';
import { typescriptGenHandler } from '../implementations/typescript/framework/typescript-gen.impl.js';
import { rustGenHandler } from '../implementations/typescript/framework/rust-gen.impl.js';
import { swiftGenHandler } from '../implementations/typescript/framework/swift-gen.impl.js';
import { solidityGenHandler } from '../implementations/typescript/framework/solidity-gen.impl.js';

// All generators must return these fields from register() so
// the generation kit's register-generator-kinds.sync can bind
// ?meta.name, ?meta.inputKind, and ?meta.outputKind.
interface GeneratorRegistration {
  variant: string;
  name: string;
  inputKind: string;
  outputKind: string;
  capabilities: string; // JSON-serialized list
}

describe('Framework Generator PluginRegistry Registration', () => {
  // ---------------------------------------------------------
  // SchemaGen
  // ---------------------------------------------------------
  describe('SchemaGen', () => {
    it('register action returns valid metadata', async () => {
      const result = await schemaGenHandler.register(
        {},
        null as any,
      ) as GeneratorRegistration;

      expect(result.variant).toBe('ok');
      expect(result.name).toBe('SchemaGen');
      expect(result.inputKind).toBe('ConceptAST');
      expect(result.outputKind).toBe('ConceptManifest');
      const caps = JSON.parse(result.capabilities);
      expect(caps).toContain('graphql');
      expect(caps).toContain('json-schema');
      expect(caps).toContain('invariants');
    });
  });

  // ---------------------------------------------------------
  // TypeScriptGen
  // ---------------------------------------------------------
  describe('TypeScriptGen', () => {
    it('register action returns valid metadata', async () => {
      const result = await typescriptGenHandler.register(
        {},
        null as any,
      ) as GeneratorRegistration;

      expect(result.variant).toBe('ok');
      expect(result.name).toBe('TypeScriptGen');
      expect(result.inputKind).toBe('ConceptManifest');
      expect(result.outputKind).toBe('TypeScriptSource');
      const caps = JSON.parse(result.capabilities);
      expect(caps).toContain('types');
      expect(caps).toContain('handler');
      expect(caps).toContain('adapter');
      expect(caps).toContain('conformance-tests');
    });
  });

  // ---------------------------------------------------------
  // RustGen
  // ---------------------------------------------------------
  describe('RustGen', () => {
    it('register action returns valid metadata', async () => {
      const result = await rustGenHandler.register(
        {},
        null as any,
      ) as GeneratorRegistration;

      expect(result.variant).toBe('ok');
      expect(result.name).toBe('RustGen');
      expect(result.inputKind).toBe('ConceptManifest');
      expect(result.outputKind).toBe('RustSource');
      const caps = JSON.parse(result.capabilities);
      expect(caps).toContain('types');
      expect(caps).toContain('handler');
      expect(caps).toContain('adapter');
      expect(caps).toContain('conformance-tests');
    });
  });

  // ---------------------------------------------------------
  // SwiftGen
  // ---------------------------------------------------------
  describe('SwiftGen', () => {
    it('register action returns valid metadata', async () => {
      const result = await swiftGenHandler.register(
        {},
        null as any,
      ) as GeneratorRegistration;

      expect(result.variant).toBe('ok');
      expect(result.name).toBe('SwiftGen');
      expect(result.inputKind).toBe('ConceptManifest');
      expect(result.outputKind).toBe('SwiftSource');
      const caps = JSON.parse(result.capabilities);
      expect(caps).toContain('types');
      expect(caps).toContain('handler');
      expect(caps).toContain('adapter');
      expect(caps).toContain('conformance-tests');
    });
  });

  // ---------------------------------------------------------
  // SolidityGen
  // ---------------------------------------------------------
  describe('SolidityGen', () => {
    it('register action returns valid metadata', async () => {
      const result = await solidityGenHandler.register(
        {},
        null as any,
      ) as GeneratorRegistration;

      expect(result.variant).toBe('ok');
      expect(result.name).toBe('SolidityGen');
      expect(result.inputKind).toBe('ConceptManifest');
      expect(result.outputKind).toBe('SoliditySource');
      const caps = JSON.parse(result.capabilities);
      expect(caps).toContain('contract');
      expect(caps).toContain('events');
      expect(caps).toContain('foundry-tests');
    });
  });

  // ---------------------------------------------------------
  // Cross-generator consistency
  // ---------------------------------------------------------
  describe('Cross-generator consistency', () => {
    it('all language generators share ConceptManifest as inputKind', async () => {
      const generators = [
        typescriptGenHandler,
        rustGenHandler,
        swiftGenHandler,
        solidityGenHandler,
      ];

      for (const gen of generators) {
        const result = await gen.register({}, null as any) as GeneratorRegistration;
        expect(result.inputKind).toBe('ConceptManifest');
      }
    });

    it('all language generators produce distinct outputKinds', async () => {
      const generators = [
        typescriptGenHandler,
        rustGenHandler,
        swiftGenHandler,
        solidityGenHandler,
      ];

      const outputKinds = new Set<string>();
      for (const gen of generators) {
        const result = await gen.register({}, null as any) as GeneratorRegistration;
        outputKinds.add(result.outputKind);
      }

      expect(outputKinds.size).toBe(generators.length);
    });

    it('SchemaGen output feeds into language generator input', async () => {
      const schemaResult = await schemaGenHandler.register({}, null as any) as GeneratorRegistration;
      const tsResult = await typescriptGenHandler.register({}, null as any) as GeneratorRegistration;

      // SchemaGen's outputKind must match language generators' inputKind
      expect(schemaResult.outputKind).toBe(tsResult.inputKind);
    });

    it('all generators return valid JSON capabilities', async () => {
      const generators = [
        schemaGenHandler,
        typescriptGenHandler,
        rustGenHandler,
        swiftGenHandler,
        solidityGenHandler,
      ];

      for (const gen of generators) {
        const result = await gen.register({}, null as any) as GeneratorRegistration;
        expect(() => JSON.parse(result.capabilities)).not.toThrow();
        const caps = JSON.parse(result.capabilities);
        expect(Array.isArray(caps)).toBe(true);
        expect(caps.length).toBeGreaterThan(0);
      }
    });
  });
});
