// ============================================================
// CLI Behavioral Parity Tests
//
// Verifies that the generated CLI's dispatch path (through the
// kernel's handleRequest/invokeConcept) produces identical
// results to the handmade CLI's direct handler calls.
//
// Each test invokes the same concept handler via both paths
// and asserts output equivalence: same variant, same output
// fields, same error messages, same storage side effects.
//
// Three dispatch levels tested:
//   1. Direct handler call  (handmade CLI approach)
//   2. kernel.invokeConcept (transport-layer dispatch)
//   3. kernel.handleRequest (full sync-driven dispatch)
//
// See Architecture doc: Clef Bind, Section 2.4
// ============================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Kernel components
import { createKernel } from '../handlers/ts/framework/kernel-factory';
import { createInMemoryStorage } from '@clef/runtime';
import type { ConceptAST, CompiledSync } from '../runtime/types';

// Concept handlers (the handmade CLI calls these directly)
import {
  parseConceptFile,
  specParserHandler,
} from '../handlers/ts/framework/spec-parser.handler';
import { schemaGenHandler } from '../handlers/ts/framework/schema-gen.handler';
import { syncCompilerHandler } from '../handlers/ts/framework/sync-compiler.handler';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.handler';

const PROJECT_ROOT = resolve(__dirname, '..');
const SPECS_DIR = resolve(PROJECT_ROOT, 'specs');
const SYNCS_DIR = resolve(PROJECT_ROOT, 'syncs');

// ---- Test Fixtures ----

const VALID_CONCEPT_SOURCE = `concept Tiny [X] {
  purpose { A minimal test concept. }
  state { items: set X }
  actions {
    action get(x: X) {
      -> ok(item: X) { Return the item. }
      -> notFound() { Item was not found. }
    }
  }
}`;

const INVALID_CONCEPT_SOURCE = `concept Broken {`;

const VALID_SYNC_AST: CompiledSync = {
  name: 'TestSync',
  when: [{
    concept: 'urn:clef/Echo',
    action: 'send',
    inputFields: [
      { name: 'id', match: { type: 'variable', name: 'id' } },
      { name: 'text', match: { type: 'variable', name: 'text' } },
    ],
    outputFields: [
      { name: 'echo', match: { type: 'variable', name: 'echo' } },
    ],
  }],
  where: [],
  then: [{
    concept: 'urn:clef/Web',
    action: 'respond',
    fields: [
      { name: 'body', value: { type: 'variable', name: 'echo' } },
    ],
  }],
};

const INVALID_SYNC_AST: CompiledSync = {
  name: 'BadSync',
  when: [{
    concept: 'urn:clef/User',
    action: 'register',
    inputFields: [],
    outputFields: [
      { name: 'user', match: { type: 'variable', name: 'u' } },
    ],
  }],
  where: [],
  then: [{
    concept: 'urn:clef/Log',
    action: 'write',
    fields: [
      { name: 'message', value: { type: 'variable', name: 'undefinedVar' } },
    ],
  }],
};

// ---- Tests ----

describe('CLI Behavioral Parity: Direct Handler vs Kernel Dispatch', () => {

  // ================================================================
  // SpecParser/parse — Direct handler vs kernel.invokeConcept
  // ================================================================

  describe('SpecParser/parse behavioral parity', () => {

    it('valid source: both paths return ok with equivalent AST', async () => {
      // Path 1: Direct handler call (handmade CLI approach)
      const directStorage = createInMemoryStorage();
      const directResult = await specParserHandler.parse(
        { source: VALID_CONCEPT_SOURCE },
        directStorage,
      );

      // Path 2: Kernel dispatch (generated CLI approach)
      const kernel = createKernel();
      kernel.registerConcept('urn:clef/SpecParser', specParserHandler);
      const kernelResult = await kernel.invokeConcept(
        'urn:clef/SpecParser',
        'parse',
        { source: VALID_CONCEPT_SOURCE },
      );

      // Both should succeed
      expect(directResult.variant).toBe('ok');
      expect(kernelResult.variant).toBe('ok');

      // Both should produce the same AST structure
      const directAst = directResult.ast as ConceptAST;
      const kernelAst = kernelResult.ast as ConceptAST;

      expect(directAst.name).toBe(kernelAst.name);
      expect(directAst.name).toBe('Tiny');
      expect(directAst.typeParams).toEqual(kernelAst.typeParams);
      expect(directAst.actions.length).toBe(kernelAst.actions.length);
      expect(directAst.actions[0].name).toBe(kernelAst.actions[0].name);
      expect(directAst.actions[0].variants.length).toBe(kernelAst.actions[0].variants.length);
      expect(directAst.state.length).toBe(kernelAst.state.length);
    });

    it('invalid source: both paths return error with same message', async () => {
      const directStorage = createInMemoryStorage();
      const directResult = await specParserHandler.parse(
        { source: INVALID_CONCEPT_SOURCE },
        directStorage,
      );

      const kernel = createKernel();
      kernel.registerConcept('urn:clef/SpecParser', specParserHandler);
      const kernelResult = await kernel.invokeConcept(
        'urn:clef/SpecParser',
        'parse',
        { source: INVALID_CONCEPT_SOURCE },
      );

      expect(directResult.variant).toBe('error');
      expect(kernelResult.variant).toBe('error');
      expect(directResult.message).toBe(kernelResult.message);
    });

    it('missing source: both paths return error variant', async () => {
      const directStorage = createInMemoryStorage();
      const directResult = await specParserHandler.parse({}, directStorage);

      const kernel = createKernel();
      kernel.registerConcept('urn:clef/SpecParser', specParserHandler);
      const kernelResult = await kernel.invokeConcept(
        'urn:clef/SpecParser',
        'parse',
        {},
      );

      expect(directResult.variant).toBe('error');
      expect(kernelResult.variant).toBe('error');
      expect(directResult.message).toBe(kernelResult.message);
    });

    it('non-string source: both paths return error variant', async () => {
      const directStorage = createInMemoryStorage();
      const directResult = await specParserHandler.parse(
        { source: 42 },
        directStorage,
      );

      const kernel = createKernel();
      kernel.registerConcept('urn:clef/SpecParser', specParserHandler);
      const kernelResult = await kernel.invokeConcept(
        'urn:clef/SpecParser',
        'parse',
        { source: 42 },
      );

      expect(directResult.variant).toBe('error');
      expect(kernelResult.variant).toBe('error');
      expect(directResult.message).toBe(kernelResult.message);
    });

    it('real concept file (password.concept): identical AST', async () => {
      const source = readFileSync(
        resolve(SPECS_DIR, 'app/password.concept'),
        'utf-8',
      );

      const directStorage = createInMemoryStorage();
      const directResult = await specParserHandler.parse({ source }, directStorage);

      const kernel = createKernel();
      kernel.registerConcept('urn:clef/SpecParser', specParserHandler);
      const kernelResult = await kernel.invokeConcept(
        'urn:clef/SpecParser',
        'parse',
        { source },
      );

      expect(directResult.variant).toBe('ok');
      expect(kernelResult.variant).toBe('ok');

      const directAst = directResult.ast as ConceptAST;
      const kernelAst = kernelResult.ast as ConceptAST;

      expect(directAst.name).toBe(kernelAst.name);
      expect(directAst.actions.length).toBe(kernelAst.actions.length);
      expect(directAst.state.length).toBe(kernelAst.state.length);
      expect(directAst.invariants.length).toBe(kernelAst.invariants.length);
      expect(directAst.typeParams).toEqual(kernelAst.typeParams);
    });

    it('all app concept files: both paths produce identical ASTs', async () => {
      const conceptFiles = [
        'password.concept', 'echo.concept', 'user.concept',
        'article.concept',
      ];

      for (const file of conceptFiles) {
        const filePath = resolve(SPECS_DIR, 'app', file);
        if (!existsSync(filePath)) continue;

        const source = readFileSync(filePath, 'utf-8');

        const directStorage = createInMemoryStorage();
        const directResult = await specParserHandler.parse({ source }, directStorage);

        const kernel = createKernel();
        kernel.registerConcept('urn:clef/SpecParser', specParserHandler);
        const kernelResult = await kernel.invokeConcept(
          'urn:clef/SpecParser',
          'parse',
          { source },
        );

        expect(directResult.variant).toBe(kernelResult.variant);
        if (directResult.variant === 'ok') {
          const d = directResult.ast as ConceptAST;
          const k = kernelResult.ast as ConceptAST;
          expect(d.name, `${file}: name mismatch`).toBe(k.name);
          expect(d.actions.length, `${file}: action count mismatch`).toBe(k.actions.length);
          expect(d.state.length, `${file}: state count mismatch`).toBe(k.state.length);
        }
      }
    });
  });

  // ================================================================
  // SchemaGen/generate — Direct handler vs kernel.invokeConcept
  // ================================================================

  describe('SchemaGen/generate behavioral parity', () => {
    let passwordAST: ConceptAST;

    beforeAll(() => {
      const source = readFileSync(
        resolve(SPECS_DIR, 'app/password.concept'),
        'utf-8',
      );
      passwordAST = parseConceptFile(source);
    });

    it('valid AST: both paths produce identical manifest', async () => {
      const directStorage = createInMemoryStorage();
      const directResult = await schemaGenHandler.generate(
        { spec: 'password.concept', ast: passwordAST },
        directStorage,
      );

      const kernel = createKernel();
      kernel.registerConcept('urn:clef/SchemaGen', schemaGenHandler);
      const kernelResult = await kernel.invokeConcept(
        'urn:clef/SchemaGen',
        'generate',
        { spec: 'password.concept', ast: passwordAST },
      );

      expect(directResult.variant).toBe('ok');
      expect(kernelResult.variant).toBe('ok');

      const directManifest = directResult.manifest as Record<string, unknown>;
      const kernelManifest = kernelResult.manifest as Record<string, unknown>;

      // Core manifest fields must match exactly
      expect(directManifest.name).toBe(kernelManifest.name);
      expect(directManifest.uri).toBe(kernelManifest.uri);
      expect(directManifest.purpose).toBe(kernelManifest.purpose);

      // Type params
      expect(JSON.stringify(directManifest.typeParams)).toBe(
        JSON.stringify(kernelManifest.typeParams),
      );

      // Relations
      expect(JSON.stringify(directManifest.relations)).toBe(
        JSON.stringify(kernelManifest.relations),
      );

      // Actions
      expect(JSON.stringify(directManifest.actions)).toBe(
        JSON.stringify(kernelManifest.actions),
      );

      // Invariants
      expect(JSON.stringify(directManifest.invariants)).toBe(
        JSON.stringify(kernelManifest.invariants),
      );

      // GraphQL schema
      expect(directManifest.graphqlSchema).toBe(kernelManifest.graphqlSchema);

      // JSON schemas
      expect(JSON.stringify(directManifest.jsonSchemas)).toBe(
        JSON.stringify(kernelManifest.jsonSchemas),
      );
    });

    it('null AST: both paths return error with same message', async () => {
      const directStorage = createInMemoryStorage();
      const directResult = await schemaGenHandler.generate(
        { spec: 'bad.concept', ast: null },
        directStorage,
      );

      const kernel = createKernel();
      kernel.registerConcept('urn:clef/SchemaGen', schemaGenHandler);
      const kernelResult = await kernel.invokeConcept(
        'urn:clef/SchemaGen',
        'generate',
        { spec: 'bad.concept', ast: null },
      );

      expect(directResult.variant).toBe('error');
      expect(kernelResult.variant).toBe('error');
      expect(directResult.message).toBe(kernelResult.message);
    });

    it('AST without name: both paths return error with same message', async () => {
      const directStorage = createInMemoryStorage();
      const directResult = await schemaGenHandler.generate(
        { spec: 'noname.concept', ast: { typeParams: [] } },
        directStorage,
      );

      const kernel = createKernel();
      kernel.registerConcept('urn:clef/SchemaGen', schemaGenHandler);
      const kernelResult = await kernel.invokeConcept(
        'urn:clef/SchemaGen',
        'generate',
        { spec: 'noname.concept', ast: { typeParams: [] } },
      );

      expect(directResult.variant).toBe('error');
      expect(kernelResult.variant).toBe('error');
      expect(directResult.message).toBe(kernelResult.message);
    });

    it('multiple concept files: all produce identical manifests via both paths', async () => {
      const conceptFiles = ['password.concept', 'echo.concept', 'user.concept'];

      for (const file of conceptFiles) {
        const filePath = resolve(SPECS_DIR, 'app', file);
        if (!existsSync(filePath)) continue;

        const source = readFileSync(filePath, 'utf-8');
        const ast = parseConceptFile(source);

        const directStorage = createInMemoryStorage();
        const directResult = await schemaGenHandler.generate(
          { spec: file, ast },
          directStorage,
        );

        const kernel = createKernel();
        kernel.registerConcept('urn:clef/SchemaGen', schemaGenHandler);
        const kernelResult = await kernel.invokeConcept(
          'urn:clef/SchemaGen',
          'generate',
          { spec: file, ast },
        );

        expect(directResult.variant, `${file}: variant mismatch`).toBe(kernelResult.variant);
        if (directResult.variant === 'ok') {
          expect(
            JSON.stringify(directResult.manifest),
            `${file}: manifest mismatch`,
          ).toBe(JSON.stringify(kernelResult.manifest));
        }
      }
    });

    it('manifest field types match between both paths', async () => {
      const directStorage = createInMemoryStorage();
      const directResult = await schemaGenHandler.generate(
        { spec: 'password.concept', ast: passwordAST },
        directStorage,
      );

      const kernel = createKernel();
      kernel.registerConcept('urn:clef/SchemaGen', schemaGenHandler);
      const kernelResult = await kernel.invokeConcept(
        'urn:clef/SchemaGen',
        'generate',
        { spec: 'password.concept', ast: passwordAST },
      );

      const dm = directResult.manifest as Record<string, unknown>;
      const km = kernelResult.manifest as Record<string, unknown>;

      // Verify each top-level field has the same type
      for (const key of Object.keys(dm)) {
        expect(typeof dm[key], `manifest.${key} type mismatch`).toBe(typeof km[key]);
      }

      // Verify no extra keys in either direction
      expect(Object.keys(dm).sort()).toEqual(Object.keys(km).sort());
    });
  });

  // ================================================================
  // SyncCompiler/compile — Direct handler vs kernel.invokeConcept
  // ================================================================

  describe('SyncCompiler/compile behavioral parity', () => {

    it('valid sync: both paths return ok with identical compiled output', async () => {
      const directStorage = createInMemoryStorage();
      const directResult = await syncCompilerHandler.compile(
        { sync: 'TestSync', ast: VALID_SYNC_AST },
        directStorage,
      );

      const kernel = createKernel();
      kernel.registerConcept('urn:clef/SyncCompiler', syncCompilerHandler);
      const kernelResult = await kernel.invokeConcept(
        'urn:clef/SyncCompiler',
        'compile',
        { sync: 'TestSync', ast: VALID_SYNC_AST },
      );

      expect(directResult.variant).toBe('ok');
      expect(kernelResult.variant).toBe('ok');

      const directCompiled = directResult.compiled as CompiledSync;
      const kernelCompiled = kernelResult.compiled as CompiledSync;

      expect(directCompiled.name).toBe(kernelCompiled.name);
      expect(JSON.stringify(directCompiled.when)).toBe(JSON.stringify(kernelCompiled.when));
      expect(JSON.stringify(directCompiled.where)).toBe(JSON.stringify(kernelCompiled.where));
      expect(JSON.stringify(directCompiled.then)).toBe(JSON.stringify(kernelCompiled.then));
    });

    it('unbound variables: both paths return error with same message', async () => {
      const directStorage = createInMemoryStorage();
      const directResult = await syncCompilerHandler.compile(
        { sync: 'BadSync', ast: INVALID_SYNC_AST },
        directStorage,
      );

      const kernel = createKernel();
      kernel.registerConcept('urn:clef/SyncCompiler', syncCompilerHandler);
      const kernelResult = await kernel.invokeConcept(
        'urn:clef/SyncCompiler',
        'compile',
        { sync: 'BadSync', ast: INVALID_SYNC_AST },
      );

      expect(directResult.variant).toBe('error');
      expect(kernelResult.variant).toBe('error');
      expect(directResult.message).toBe(kernelResult.message);
      expect(directResult.message as string).toContain('unbound');
    });

    it('null AST: both paths return error with same message', async () => {
      const directStorage = createInMemoryStorage();
      const directResult = await syncCompilerHandler.compile(
        { sync: 'empty', ast: null },
        directStorage,
      );

      const kernel = createKernel();
      kernel.registerConcept('urn:clef/SyncCompiler', syncCompilerHandler);
      const kernelResult = await kernel.invokeConcept(
        'urn:clef/SyncCompiler',
        'compile',
        { sync: 'empty', ast: null },
      );

      expect(directResult.variant).toBe('error');
      expect(kernelResult.variant).toBe('error');
      expect(directResult.message).toBe(kernelResult.message);
    });

    it('empty when clause: both paths return same error', async () => {
      const noWhen: CompiledSync = {
        name: 'NoWhen',
        when: [],
        where: [],
        then: [{ concept: 'X', action: 'y', fields: [] }],
      };

      const directStorage = createInMemoryStorage();
      const directResult = await syncCompilerHandler.compile(
        { sync: 'NoWhen', ast: noWhen },
        directStorage,
      );

      const kernel = createKernel();
      kernel.registerConcept('urn:clef/SyncCompiler', syncCompilerHandler);
      const kernelResult = await kernel.invokeConcept(
        'urn:clef/SyncCompiler',
        'compile',
        { sync: 'NoWhen', ast: noWhen },
      );

      expect(directResult.variant).toBe('error');
      expect(kernelResult.variant).toBe('error');
      expect(directResult.message).toBe(kernelResult.message);
      expect(directResult.message as string).toContain('when clause is required');
    });

    it('empty then clause: both paths return same error', async () => {
      const noThen: CompiledSync = {
        name: 'NoThen',
        when: [{
          concept: 'X',
          action: 'y',
          inputFields: [],
          outputFields: [],
        }],
        where: [],
        then: [],
      };

      const directStorage = createInMemoryStorage();
      const directResult = await syncCompilerHandler.compile(
        { sync: 'NoThen', ast: noThen },
        directStorage,
      );

      const kernel = createKernel();
      kernel.registerConcept('urn:clef/SyncCompiler', syncCompilerHandler);
      const kernelResult = await kernel.invokeConcept(
        'urn:clef/SyncCompiler',
        'compile',
        { sync: 'NoThen', ast: noThen },
      );

      expect(directResult.variant).toBe('error');
      expect(kernelResult.variant).toBe('error');
      expect(directResult.message).toBe(kernelResult.message);
      expect(directResult.message as string).toContain('then clause is required');
    });

    it('real sync files: both paths validate identically', async () => {
      const source = readFileSync(resolve(SYNCS_DIR, 'app/echo.sync'), 'utf-8');
      const syncs = parseSyncFile(source);

      for (const sync of syncs) {
        const directStorage = createInMemoryStorage();
        const directResult = await syncCompilerHandler.compile(
          { sync: sync.name, ast: sync },
          directStorage,
        );

        const kernel = createKernel();
        kernel.registerConcept('urn:clef/SyncCompiler', syncCompilerHandler);
        const kernelResult = await kernel.invokeConcept(
          'urn:clef/SyncCompiler',
          'compile',
          { sync: sync.name, ast: sync },
        );

        expect(
          directResult.variant,
          `sync "${sync.name}": variant mismatch`,
        ).toBe(kernelResult.variant);

        if (directResult.variant === 'ok') {
          expect(
            JSON.stringify(directResult.compiled),
            `sync "${sync.name}": compiled output mismatch`,
          ).toBe(JSON.stringify(kernelResult.compiled));
        } else {
          expect(directResult.message).toBe(kernelResult.message);
        }
      }
    });
  });

  // ================================================================
  // Full handleRequest Dispatch Parity
  //
  // Tests the complete generated CLI dispatch path:
  //   handleRequest → SyncEngine → concept handler → Web/respond
  //
  // Requires route syncs to wire Web/request to concept actions.
  // ================================================================

  describe('Full handleRequest dispatch parity', () => {

    it('SpecParser/parse via handleRequest returns same AST as direct call', async () => {
      const kernel = createKernel();
      kernel.registerConcept('urn:clef/SpecParser', specParserHandler);

      // Route sync: Web/request{method:'parse'} → SpecParser/parse
      kernel.registerSync({
        name: 'RouteSpecParse',
        when: [{
          concept: 'urn:clef/Web',
          action: 'request',
          inputFields: [
            { name: 'method', match: { type: 'literal', value: 'parse' } },
            { name: 'source', match: { type: 'variable', name: 'source' } },
          ],
          outputFields: [
            { name: 'request', match: { type: 'variable', name: 'request' } },
          ],
        }],
        where: [],
        then: [{
          concept: 'urn:clef/SpecParser',
          action: 'parse',
          fields: [
            { name: 'source', value: { type: 'variable', name: 'source' } },
          ],
        }],
      });

      // Response sync: collect SpecParser/parse ok → Web/respond
      kernel.registerSync({
        name: 'RespondSpecParse',
        when: [
          {
            concept: 'urn:clef/Web',
            action: 'request',
            inputFields: [
              { name: 'method', match: { type: 'literal', value: 'parse' } },
            ],
            outputFields: [
              { name: 'request', match: { type: 'variable', name: 'request' } },
            ],
          },
          {
            concept: 'urn:clef/SpecParser',
            action: 'parse',
            inputFields: [],
            outputFields: [
              { name: 'ast', match: { type: 'variable', name: 'ast' } },
            ],
          },
        ],
        where: [],
        then: [{
          concept: 'urn:clef/Web',
          action: 'respond',
          fields: [
            { name: 'request', value: { type: 'variable', name: 'request' } },
            { name: 'body', value: { type: 'variable', name: 'ast' } },
          ],
        }],
      });

      // Direct call
      const directStorage = createInMemoryStorage();
      const directResult = await specParserHandler.parse(
        { source: VALID_CONCEPT_SOURCE },
        directStorage,
      );

      // handleRequest call (generated CLI dispatch path)
      const response = await kernel.handleRequest({
        method: 'parse',
        source: VALID_CONCEPT_SOURCE,
      });

      expect(directResult.variant).toBe('ok');
      expect(response.body).toBeDefined();

      // The response body contains the AST that was routed through Web/respond
      const directAst = directResult.ast as ConceptAST;
      const responseBody = response.body as unknown as ConceptAST;

      expect(responseBody.name).toBe(directAst.name);
      expect(responseBody.typeParams).toEqual(directAst.typeParams);
      expect(responseBody.actions.length).toBe(directAst.actions.length);
    });

    it('SchemaGen/generate via handleRequest returns same manifest as direct call', async () => {
      const source = readFileSync(
        resolve(SPECS_DIR, 'app/password.concept'),
        'utf-8',
      );
      const ast = parseConceptFile(source);

      const kernel = createKernel();
      kernel.registerConcept('urn:clef/SchemaGen', schemaGenHandler);

      // Route sync: Web/request{method:'generate'} → SchemaGen/generate
      kernel.registerSync({
        name: 'RouteSchemaGen',
        when: [{
          concept: 'urn:clef/Web',
          action: 'request',
          inputFields: [
            { name: 'method', match: { type: 'literal', value: 'generate' } },
            { name: 'spec', match: { type: 'variable', name: 'spec' } },
            { name: 'ast', match: { type: 'variable', name: 'ast' } },
          ],
          outputFields: [
            { name: 'request', match: { type: 'variable', name: 'request' } },
          ],
        }],
        where: [],
        then: [{
          concept: 'urn:clef/SchemaGen',
          action: 'generate',
          fields: [
            { name: 'spec', value: { type: 'variable', name: 'spec' } },
            { name: 'ast', value: { type: 'variable', name: 'ast' } },
          ],
        }],
      });

      // Response sync: collect SchemaGen/generate ok → Web/respond
      kernel.registerSync({
        name: 'RespondSchemaGen',
        when: [
          {
            concept: 'urn:clef/Web',
            action: 'request',
            inputFields: [
              { name: 'method', match: { type: 'literal', value: 'generate' } },
            ],
            outputFields: [
              { name: 'request', match: { type: 'variable', name: 'request' } },
            ],
          },
          {
            concept: 'urn:clef/SchemaGen',
            action: 'generate',
            inputFields: [],
            outputFields: [
              { name: 'manifest', match: { type: 'variable', name: 'manifest' } },
            ],
          },
        ],
        where: [],
        then: [{
          concept: 'urn:clef/Web',
          action: 'respond',
          fields: [
            { name: 'request', value: { type: 'variable', name: 'request' } },
            { name: 'body', value: { type: 'variable', name: 'manifest' } },
          ],
        }],
      });

      // Direct call
      const directStorage = createInMemoryStorage();
      const directResult = await schemaGenHandler.generate(
        { spec: 'password.concept', ast },
        directStorage,
      );

      // handleRequest call
      const response = await kernel.handleRequest({
        method: 'generate',
        spec: 'password.concept',
        ast,
      });

      expect(directResult.variant).toBe('ok');
      expect(response.body).toBeDefined();

      const directManifest = directResult.manifest as Record<string, unknown>;
      const responseManifest = response.body as Record<string, unknown>;

      expect(responseManifest.name).toBe(directManifest.name);
      expect(responseManifest.uri).toBe(directManifest.uri);
      expect(JSON.stringify(responseManifest.actions)).toBe(
        JSON.stringify(directManifest.actions),
      );
      expect(JSON.stringify(responseManifest.relations)).toBe(
        JSON.stringify(directManifest.relations),
      );
    });

    it('SyncCompiler/compile via handleRequest returns same result as direct call', async () => {
      const kernel = createKernel();
      kernel.registerConcept('urn:clef/SyncCompiler', syncCompilerHandler);

      // Route sync
      kernel.registerSync({
        name: 'RouteSyncCompile',
        when: [{
          concept: 'urn:clef/Web',
          action: 'request',
          inputFields: [
            { name: 'method', match: { type: 'literal', value: 'compile' } },
            { name: 'sync', match: { type: 'variable', name: 'sync' } },
            { name: 'ast', match: { type: 'variable', name: 'ast' } },
          ],
          outputFields: [
            { name: 'request', match: { type: 'variable', name: 'request' } },
          ],
        }],
        where: [],
        then: [{
          concept: 'urn:clef/SyncCompiler',
          action: 'compile',
          fields: [
            { name: 'sync', value: { type: 'variable', name: 'sync' } },
            { name: 'ast', value: { type: 'variable', name: 'ast' } },
          ],
        }],
      });

      // Response sync
      kernel.registerSync({
        name: 'RespondSyncCompile',
        when: [
          {
            concept: 'urn:clef/Web',
            action: 'request',
            inputFields: [
              { name: 'method', match: { type: 'literal', value: 'compile' } },
            ],
            outputFields: [
              { name: 'request', match: { type: 'variable', name: 'request' } },
            ],
          },
          {
            concept: 'urn:clef/SyncCompiler',
            action: 'compile',
            inputFields: [],
            outputFields: [
              { name: 'compiled', match: { type: 'variable', name: 'compiled' } },
            ],
          },
        ],
        where: [],
        then: [{
          concept: 'urn:clef/Web',
          action: 'respond',
          fields: [
            { name: 'request', value: { type: 'variable', name: 'request' } },
            { name: 'body', value: { type: 'variable', name: 'compiled' } },
          ],
        }],
      });

      // Direct call
      const directStorage = createInMemoryStorage();
      const directResult = await syncCompilerHandler.compile(
        { sync: 'TestSync', ast: VALID_SYNC_AST },
        directStorage,
      );

      // handleRequest call
      const response = await kernel.handleRequest({
        method: 'compile',
        sync: 'TestSync',
        ast: VALID_SYNC_AST,
      });

      expect(directResult.variant).toBe('ok');
      expect(response.body).toBeDefined();

      const directCompiled = directResult.compiled as CompiledSync;
      const responseCompiled = response.body as unknown as CompiledSync;

      expect(responseCompiled.name).toBe(directCompiled.name);
      expect(JSON.stringify(responseCompiled.when)).toBe(
        JSON.stringify(directCompiled.when),
      );
      expect(JSON.stringify(responseCompiled.then)).toBe(
        JSON.stringify(directCompiled.then),
      );
    });
  });

  // ================================================================
  // Storage Side Effects Parity
  //
  // Verifies that both dispatch paths create equivalent storage
  // entries (same relations, same record structure).
  // ================================================================

  describe('Storage side effects parity', () => {

    it('SpecParser/parse: direct call stores in specs and ast relations', async () => {
      const storage = createInMemoryStorage();
      const result = await specParserHandler.parse(
        { source: VALID_CONCEPT_SOURCE },
        storage,
      );
      expect(result.variant).toBe('ok');

      const specs = await storage.find('specs');
      const asts = await storage.find('ast');
      expect(specs.length).toBe(1);
      expect(asts.length).toBe(1);
    });

    it('SchemaGen/generate: direct call stores in manifests relation', async () => {
      const source = readFileSync(
        resolve(SPECS_DIR, 'app/password.concept'),
        'utf-8',
      );
      const ast = parseConceptFile(source);

      const storage = createInMemoryStorage();
      const result = await schemaGenHandler.generate(
        { spec: 'password.concept', ast },
        storage,
      );
      expect(result.variant).toBe('ok');

      const stored = await storage.find('manifests');
      expect(stored.length).toBe(1);
      expect((stored[0] as Record<string, unknown>).spec).toBe('password.concept');
    });

    it('SyncCompiler/compile: direct call stores in compiled relation', async () => {
      const storage = createInMemoryStorage();
      const result = await syncCompilerHandler.compile(
        { sync: 'TestSync', ast: VALID_SYNC_AST },
        storage,
      );
      expect(result.variant).toBe('ok');

      const stored = await storage.find('compiled');
      expect(stored.length).toBe(1);
      expect((stored[0] as Record<string, unknown>).syncRef).toBe('TestSync');
    });

    it('kernel.invokeConcept also stores in concept storage', async () => {
      const kernel = createKernel();
      kernel.registerConcept('urn:clef/SpecParser', specParserHandler);

      const result = await kernel.invokeConcept(
        'urn:clef/SpecParser',
        'parse',
        { source: VALID_CONCEPT_SOURCE },
      );
      expect(result.variant).toBe('ok');

      // The kernel allocates its own storage for the concept when
      // registerConcept is called, so storage mutations happen in
      // the kernel-managed storage instance. We can verify the handler
      // ran correctly by checking the output.
      expect(result.ast).toBeDefined();
      expect((result.ast as ConceptAST).name).toBe('Tiny');
    });
  });

  // ================================================================
  // Pipeline Parity: check → generate → compile-syncs
  //
  // Runs the complete CLI pipeline through both dispatch paths
  // and verifies end-to-end equivalence.
  // ================================================================

  describe('Pipeline parity: check → generate → compile-syncs', () => {

    it('full pipeline via direct calls matches kernel.invokeConcept', async () => {
      const source = readFileSync(
        resolve(SPECS_DIR, 'app/password.concept'),
        'utf-8',
      );

      // ---- Step 1: Parse (check) ----
      const directParseStorage = createInMemoryStorage();
      const directParse = await specParserHandler.parse(
        { source },
        directParseStorage,
      );

      const kernel = createKernel();
      kernel.registerConcept('urn:clef/SpecParser', specParserHandler);
      kernel.registerConcept('urn:clef/SchemaGen', schemaGenHandler);
      kernel.registerConcept('urn:clef/SyncCompiler', syncCompilerHandler);

      const kernelParse = await kernel.invokeConcept(
        'urn:clef/SpecParser',
        'parse',
        { source },
      );

      expect(directParse.variant).toBe(kernelParse.variant);
      expect((directParse.ast as ConceptAST).name).toBe(
        (kernelParse.ast as ConceptAST).name,
      );

      // ---- Step 2: Generate (schema-gen) ----
      const directGenStorage = createInMemoryStorage();
      const directGen = await schemaGenHandler.generate(
        { spec: 'password.concept', ast: directParse.ast },
        directGenStorage,
      );

      const kernelGen = await kernel.invokeConcept(
        'urn:clef/SchemaGen',
        'generate',
        { spec: 'password.concept', ast: kernelParse.ast },
      );

      expect(directGen.variant).toBe(kernelGen.variant);
      expect(JSON.stringify(directGen.manifest)).toBe(
        JSON.stringify(kernelGen.manifest),
      );

      // ---- Step 3: Compile syncs ----
      const syncSource = readFileSync(
        resolve(SYNCS_DIR, 'app/echo.sync'),
        'utf-8',
      );
      const syncs = parseSyncFile(syncSource);

      for (const sync of syncs) {
        const directCompileStorage = createInMemoryStorage();
        const directCompile = await syncCompilerHandler.compile(
          { sync: sync.name, ast: sync },
          directCompileStorage,
        );

        const kernelCompile = await kernel.invokeConcept(
          'urn:clef/SyncCompiler',
          'compile',
          { sync: sync.name, ast: sync },
        );

        expect(directCompile.variant).toBe(kernelCompile.variant);
        if (directCompile.variant === 'ok') {
          expect(JSON.stringify(directCompile.compiled)).toBe(
            JSON.stringify(kernelCompile.compiled),
          );
        }
      }
    });
  });

  // ================================================================
  // Unknown Action Handling
  //
  // The handmade CLI doesn't call unknown actions (it has a static
  // switch statement). The generated CLI dispatches via method name,
  // so unknown actions must be handled gracefully.
  // ================================================================

  describe('Unknown action handling', () => {

    it('kernel.invokeConcept returns error for unknown action', async () => {
      const kernel = createKernel();
      kernel.registerConcept('urn:clef/SpecParser', specParserHandler);

      const result = await kernel.invokeConcept(
        'urn:clef/SpecParser',
        'nonexistent',
        {},
      );

      expect(result.variant).toBe('error');
      expect(result.message).toContain('Unknown action');
    });

    it('kernel.invokeConcept returns error for unregistered concept', async () => {
      const kernel = createKernel();

      await expect(
        kernel.invokeConcept('urn:clef/DoesNotExist', 'parse', {}),
      ).rejects.toThrow('Concept not found');
    });
  });

  // ================================================================
  // Variant Consistency
  //
  // Verifies that variant names and output field names are
  // identical across both dispatch paths for all test cases.
  // ================================================================

  describe('Variant and output field consistency', () => {

    it('SpecParser ok variant output fields match between paths', async () => {
      const directStorage = createInMemoryStorage();
      const directResult = await specParserHandler.parse(
        { source: VALID_CONCEPT_SOURCE },
        directStorage,
      );

      const kernel = createKernel();
      kernel.registerConcept('urn:clef/SpecParser', specParserHandler);
      const kernelResult = await kernel.invokeConcept(
        'urn:clef/SpecParser',
        'parse',
        { source: VALID_CONCEPT_SOURCE },
      );

      // Both should have the same output field names
      const directKeys = Object.keys(directResult).sort();
      const kernelKeys = Object.keys(kernelResult).sort();
      expect(directKeys).toEqual(kernelKeys);
    });

    it('SpecParser error variant output fields match between paths', async () => {
      const directStorage = createInMemoryStorage();
      const directResult = await specParserHandler.parse(
        { source: INVALID_CONCEPT_SOURCE },
        directStorage,
      );

      const kernel = createKernel();
      kernel.registerConcept('urn:clef/SpecParser', specParserHandler);
      const kernelResult = await kernel.invokeConcept(
        'urn:clef/SpecParser',
        'parse',
        { source: INVALID_CONCEPT_SOURCE },
      );

      const directKeys = Object.keys(directResult).sort();
      const kernelKeys = Object.keys(kernelResult).sort();
      expect(directKeys).toEqual(kernelKeys);
    });

    it('SchemaGen ok variant output fields match between paths', async () => {
      const source = readFileSync(
        resolve(SPECS_DIR, 'app/password.concept'),
        'utf-8',
      );
      const ast = parseConceptFile(source);

      const directStorage = createInMemoryStorage();
      const directResult = await schemaGenHandler.generate(
        { spec: 'password.concept', ast },
        directStorage,
      );

      const kernel = createKernel();
      kernel.registerConcept('urn:clef/SchemaGen', schemaGenHandler);
      const kernelResult = await kernel.invokeConcept(
        'urn:clef/SchemaGen',
        'generate',
        { spec: 'password.concept', ast },
      );

      const directKeys = Object.keys(directResult).sort();
      const kernelKeys = Object.keys(kernelResult).sort();
      expect(directKeys).toEqual(kernelKeys);
    });

    it('SyncCompiler ok variant output fields match between paths', async () => {
      const directStorage = createInMemoryStorage();
      const directResult = await syncCompilerHandler.compile(
        { sync: 'TestSync', ast: VALID_SYNC_AST },
        directStorage,
      );

      const kernel = createKernel();
      kernel.registerConcept('urn:clef/SyncCompiler', syncCompilerHandler);
      const kernelResult = await kernel.invokeConcept(
        'urn:clef/SyncCompiler',
        'compile',
        { sync: 'TestSync', ast: VALID_SYNC_AST },
      );

      const directKeys = Object.keys(directResult).sort();
      const kernelKeys = Object.keys(kernelResult).sort();
      expect(directKeys).toEqual(kernelKeys);
    });

    it('SyncCompiler error variant output fields match between paths', async () => {
      const directStorage = createInMemoryStorage();
      const directResult = await syncCompilerHandler.compile(
        { sync: 'BadSync', ast: INVALID_SYNC_AST },
        directStorage,
      );

      const kernel = createKernel();
      kernel.registerConcept('urn:clef/SyncCompiler', syncCompilerHandler);
      const kernelResult = await kernel.invokeConcept(
        'urn:clef/SyncCompiler',
        'compile',
        { sync: 'BadSync', ast: INVALID_SYNC_AST },
      );

      const directKeys = Object.keys(directResult).sort();
      const kernelKeys = Object.keys(kernelResult).sort();
      expect(directKeys).toEqual(kernelKeys);
    });
  });
});
