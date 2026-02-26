// ============================================================
// RealWorld Pipeline Tests
//
// Validates self-compilation of RealWorld concept specs through
// the compiler pipeline, and parsing of RealWorld sync files.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  createInMemoryStorage,
} from '../kernel/src/index.js';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler.js';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.handler.js';
import type { ConceptAST, ConceptManifest } from '../kernel/src/types.js';

// Framework concept handlers (for self-compilation tests)
import { specParserHandler } from '../handlers/ts/framework/spec-parser.handler.js';
import { schemaGenHandler } from '../handlers/ts/framework/schema-gen.handler.js';
import { typescriptGenHandler } from '../handlers/ts/framework/typescript-gen.handler.js';
import { syncCompilerHandler } from '../handlers/ts/framework/sync-compiler.handler.js';

const SPECS_DIR = resolve(__dirname, '..', 'specs');
const REPERTOIRE_DIR = resolve(__dirname, '..', 'repertoire');
const SYNCS_DIR = resolve(__dirname, '..', 'syncs');

// Tag and Comment were superseded by richer kit versions.
// Map concept name → { dir, file } for reading from the correct location.
const SPEC_LOCATIONS: Record<string, { dir: string; file: string }> = {
  profile:  { dir: resolve(SPECS_DIR, 'app'), file: 'profile.concept' },
  article:  { dir: resolve(SPECS_DIR, 'app'), file: 'article.concept' },
  comment:  { dir: resolve(REPERTOIRE_DIR, 'content'), file: 'comment.concept' },
  tag:      { dir: resolve(REPERTOIRE_DIR, 'classification'), file: 'tag.concept' },
  favorite: { dir: resolve(SPECS_DIR, 'app'), file: 'favorite.concept' },
  follow:   { dir: resolve(SPECS_DIR, 'app'), file: 'follow.concept' },
};

function readSpec(_category: string, name: string): string {
  const loc = SPEC_LOCATIONS[name];
  if (!loc) throw new Error(`Unknown spec: ${name}`);
  return readFileSync(resolve(loc.dir, loc.file), 'utf-8');
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

// All 6 RealWorld concept names (comment and tag now from kit versions)
const REALWORLD_SPECS = ['profile', 'article', 'comment', 'tag', 'favorite', 'follow'];

// All 5 new RealWorld sync files
const REALWORLD_SYNCS = ['login.sync', 'articles.sync', 'comments.sync', 'social.sync', 'profile.sync'];

// ============================================================
// 1. Self-Compilation: New Concept Specs through the Pipeline
// ============================================================

describe('Self-Compilation of RealWorld Specs', () => {
  it('SpecParser parses all 6 new concept specs', async () => {
    const storage = createInMemoryStorage();

    for (const name of REALWORLD_SPECS) {
      const source = readSpec('app', name);
      const result = await specParserHandler.parse({ source }, storage);
      expect(result.variant).toBe('ok');
      expect(result.ast).toBeTruthy();
    }
  });

  it('SchemaGen generates manifests for all new specs', async () => {
    for (const name of REALWORLD_SPECS) {
      const ast = parseConceptFile(readSpec('app', name));
      const manifest = await generateManifest(ast);
      expect(manifest.name).toBeTruthy();
      expect(manifest.actions.length).toBeGreaterThan(0);
      expect(manifest.graphqlSchema).toBeTruthy();
    }
  });

  it('TypeScriptGen generates code for all new specs', async () => {
    for (const name of REALWORLD_SPECS) {
      const ast = parseConceptFile(readSpec('app', name));
      const manifest = await generateManifest(ast);
      const storage = createInMemoryStorage();
      const result = await typescriptGenHandler.generate(
        { spec: name, manifest },
        storage,
      );
      expect(result.variant).toBe('ok');
      const files = result.files as { path: string; content: string }[];
      // All new specs have invariants → types + handler + adapter + conformance
      expect(files.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('Article manifest has correct relation schema (state merge)', async () => {
    const ast = parseConceptFile(readSpec('app', 'article'));
    const manifest = await generateManifest(ast);

    // slug, title, description, body, author, createdAt, updatedAt all share
    // domain type A (scalar) → merged into one relation
    const mergedRelation = manifest.relations.find(r => r.source === 'merged');
    expect(mergedRelation).toBeDefined();
    const fieldNames = mergedRelation!.fields.map(f => f.name);
    expect(fieldNames).toContain('slug');
    expect(fieldNames).toContain('title');
    expect(fieldNames).toContain('body');
    expect(fieldNames).toContain('author');

    // 'articles: set A' is a separate set-valued relation
    const setRelation = manifest.relations.find(r => r.source === 'set-valued');
    expect(setRelation).toBeDefined();
  });

  it('Follow manifest has merged relation with set-typed field', async () => {
    const ast = parseConceptFile(readSpec('app', 'follow'));
    const manifest = await generateManifest(ast);

    // following: U -> set String is a relation, merged into entries
    const mergedRelation = manifest.relations.find(r => r.source === 'merged');
    expect(mergedRelation).toBeDefined();
    const followingField = mergedRelation!.fields.find(f => f.name === 'following');
    expect(followingField).toBeDefined();
    expect(followingField!.type.kind).toBe('set');
  });

  it('generated conformance tests for Profile include invariant assertions', async () => {
    const ast = parseConceptFile(readSpec('app', 'profile'));
    const manifest = await generateManifest(ast);
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'profile', manifest },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const testFile = files.find(f => f.path === 'profile.conformance.test.ts');
    expect(testFile).toBeDefined();
    expect(testFile!.content).toContain('profileHandler.update(');
    expect(testFile!.content).toContain('profileHandler.get(');
    expect(testFile!.content).toContain('"Hello world"');
    expect(testFile!.content).toContain('"http://img.png"');
  });
});

// ============================================================
// 2. Sync File Parsing
// ============================================================

describe('RealWorld Sync Parsing', () => {
  it('parses all 5 new sync files', () => {
    for (const file of REALWORLD_SYNCS) {
      const source = readFileSync(resolve(SYNCS_DIR, 'app', file), 'utf-8');
      const syncs = parseSyncFile(source);
      expect(syncs.length).toBeGreaterThan(0);

      for (const sync of syncs) {
        expect(sync.name).toBeTruthy();
        expect(sync.when.length).toBeGreaterThan(0);
        expect(sync.then.length).toBeGreaterThan(0);
      }
    }
  });

  it('login.sync has correct sync structure', () => {
    const source = readFileSync(resolve(SYNCS_DIR, 'app', 'login.sync'), 'utf-8');
    const syncs = parseSyncFile(source);
    const names = syncs.map(s => s.name);

    expect(names).toContain('LoginCheckPassword');
    expect(names).toContain('LoginSuccess');
    expect(names).toContain('LoginResponse');
    expect(names).toContain('LoginFailure');

    // LoginCheckPassword has a where clause for User state query
    const loginCheck = syncs.find(s => s.name === 'LoginCheckPassword')!;
    expect(loginCheck.where.length).toBeGreaterThan(0);
    expect(loginCheck.where[0].type).toBe('query');
    const loginWhere = loginCheck.where[0] as { type: 'query'; concept: string };
    expect(loginWhere.concept).toBe('urn:copf/User');
  });

  it('articles.sync includes CascadeDeleteComments', () => {
    const source = readFileSync(resolve(SYNCS_DIR, 'app', 'articles.sync'), 'utf-8');
    const syncs = parseSyncFile(source);
    const names = syncs.map(s => s.name);

    expect(names).toContain('CascadeDeleteComments');

    const cascade = syncs.find(s => s.name === 'CascadeDeleteComments')!;
    expect(cascade.where.length).toBeGreaterThan(0);
    const cascadeWhere = cascade.where[0] as { type: 'query'; concept: string };
    expect(cascadeWhere.concept).toBe('urn:copf/Comment');
  });

  it('social.sync covers follow and favorite flows', () => {
    const source = readFileSync(resolve(SYNCS_DIR, 'app', 'social.sync'), 'utf-8');
    const syncs = parseSyncFile(source);
    const names = syncs.map(s => s.name);

    expect(names).toContain('PerformFollow');
    expect(names).toContain('PerformUnfollow');
    expect(names).toContain('PerformFavorite');
    expect(names).toContain('PerformUnfavorite');
  });

  it('SyncCompiler compiles all new sync files', async () => {
    for (const file of REALWORLD_SYNCS) {
      const source = readFileSync(resolve(SYNCS_DIR, 'app', file), 'utf-8');
      const syncs = parseSyncFile(source);

      const storage = createInMemoryStorage();
      for (const sync of syncs) {
        const result = await syncCompilerHandler.compile(
          { sync: sync.name, ast: sync },
          storage,
        );
        expect(result.variant).toBe('ok');
      }
    }
  });
});
