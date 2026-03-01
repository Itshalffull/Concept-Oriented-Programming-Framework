// ============================================================
// SyncParser + SyncCompiler Tests
//
// Validates sync file parsing and compilation — both the raw
// parser functions and the concept handlers.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  createInMemoryStorage,
} from '../runtime/index.js';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.handler.js';
import { syncParserHandler } from '../handlers/ts/framework/sync-parser.handler.js';
import { syncCompilerHandler } from '../handlers/ts/framework/sync-compiler.handler.js';
import { validateSyncFields } from '../cli/src/commands/compile-syncs.js';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler.js';
import type { CompiledSync, ConceptAST } from '../runtime/types.js';

const SYNCS_DIR = resolve(__dirname, '..', 'syncs');
const SPECS_DIR = resolve(__dirname, '..', 'specs', 'app');

// Relocated specs: tag → kits/classification, comment → kits/content
const REPERTOIRE_DIR = resolve(__dirname, '..', 'repertoire');
const RELOCATED_APP_SPECS: Record<string, string> = {
  tag: resolve(REPERTOIRE_DIR, 'concepts', 'classification', 'tag.concept'),
  comment: resolve(REPERTOIRE_DIR, 'concepts', 'content', 'comment.concept'),
};

// ============================================================
// 1. SyncParser Concept
// ============================================================

describe('SyncParser Concept', () => {
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
    expect(allSyncs).toHaveLength(6);
    const names = allSyncs.map(s => s.name);
    expect(names).toContain('GenerateManifest');
    expect(names).toContain('GenerateTypeScript');
    expect(names).toContain('GenerateRust');
    expect(names).toContain('GenerateSwift');
    expect(names).toContain('GenerateSolidity');
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
// 2. SyncCompiler Concept
// ============================================================

describe('SyncCompiler Concept', () => {
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
// 3. Sync Field Validation
//
// Validates that field names in sync patterns match the fields
// declared in concept specs. See Section 7.2.
// ============================================================

function loadSpec(name: string): ConceptAST {
  const specPath = RELOCATED_APP_SPECS[name] ?? resolve(SPECS_DIR, `${name}.concept`);
  return parseConceptFile(readFileSync(specPath, 'utf-8'));
}

describe('Sync Field Validation', () => {
  it('produces no warnings for valid echo sync', () => {
    const echoAST = loadSpec('echo');
    const syncs = parseSyncFile(readFileSync(resolve(SYNCS_DIR, 'app', 'echo.sync'), 'utf-8'));
    const conceptMap = new Map<string, ConceptAST>([['Echo', echoAST]]);

    // HandleEcho then-clause: Echo/send: [ id: ?id; text: ?text ]
    // Echo/send params: id(M), text(String) — match
    // EchoResponse when-clause: Echo/send => [ echo: ?echo ]
    // Echo/send ok variant: id, echo — match
    const allWarnings = syncs.flatMap(s => validateSyncFields(s, conceptMap));
    expect(allWarnings).toEqual([]);
  });

  it('warns on unknown when-clause output field', () => {
    const articleAST = loadSpec('article');
    const conceptMap = new Map<string, ConceptAST>([['Article', articleAST]]);

    // Article/list ok variant outputs: articles
    // Sync references "tagList" which doesn't exist
    const badSync: CompiledSync = {
      name: 'BadListSync',
      when: [{
        concept: 'urn:clef/Article',
        action: 'list',
        inputFields: [],
        outputFields: [{ name: 'tagList', match: { type: 'variable', name: 'tags' } }],
      }],
      where: [],
      then: [{ concept: 'urn:clef/Web', action: 'respond', fields: [] }],
    };

    const warnings = validateSyncFields(badSync, conceptMap);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('tagList');
    expect(warnings[0]).toContain('not a declared output');
    expect(warnings[0]).toContain('articles');
  });

  it('warns on unknown when-clause input field', () => {
    const articleAST = loadSpec('article');
    const conceptMap = new Map<string, ConceptAST>([['Article', articleAST]]);

    // Article/get params: article(A) — not "slug"
    const badSync: CompiledSync = {
      name: 'BadGetSync',
      when: [{
        concept: 'urn:clef/Article',
        action: 'get',
        inputFields: [{ name: 'slug', match: { type: 'variable', name: 's' } }],
        outputFields: [],
      }],
      where: [],
      then: [{ concept: 'urn:clef/Web', action: 'respond', fields: [] }],
    };

    const warnings = validateSyncFields(badSync, conceptMap);
    expect(warnings.some(w => w.includes('slug') && w.includes('not a declared parameter'))).toBe(true);
    expect(warnings.some(w => w.includes('article'))).toBe(true); // shows the expected param
  });

  it('warns on missing required then-clause parameter', () => {
    const articleAST = loadSpec('article');
    const conceptMap = new Map<string, ConceptAST>([['Article', articleAST]]);

    // Article/create params: article, title, description, body, author
    // Sync only provides: article, title — missing 3
    const badSync: CompiledSync = {
      name: 'IncompleteCreate',
      when: [{ concept: 'urn:clef/Web', action: 'request', inputFields: [], outputFields: [] }],
      where: [],
      then: [{
        concept: 'urn:clef/Article',
        action: 'create',
        fields: [
          { name: 'article', value: { type: 'variable', name: 'a' } },
          { name: 'title', value: { type: 'variable', name: 't' } },
        ],
      }],
    };

    const warnings = validateSyncFields(badSync, conceptMap);
    expect(warnings.some(w => w.includes('missing required parameter "description"'))).toBe(true);
    expect(warnings.some(w => w.includes('missing required parameter "body"'))).toBe(true);
    expect(warnings.some(w => w.includes('missing required parameter "author"'))).toBe(true);
  });

  it('produces no warnings for login sync', () => {
    const passwordAST = loadSpec('password');
    const jwtAST = loadSpec('jwt');
    const conceptMap = new Map<string, ConceptAST>([
      ['Password', passwordAST],
      ['JWT', jwtAST],
    ]);

    const syncs = parseSyncFile(readFileSync(resolve(SYNCS_DIR, 'app', 'login.sync'), 'utf-8'));
    const allWarnings = syncs.flatMap(s => validateSyncFields(s, conceptMap));
    expect(allWarnings).toEqual([]);
  });

  it('skips Web concept references without warnings', () => {
    const badSync: CompiledSync = {
      name: 'WebOnly',
      when: [{
        concept: 'urn:clef/Web',
        action: 'request',
        inputFields: [{ name: 'anything', match: { type: 'variable', name: 'x' } }],
        outputFields: [{ name: 'whatever', match: { type: 'variable', name: 'y' } }],
      }],
      where: [],
      then: [{
        concept: 'urn:clef/Web',
        action: 'respond',
        fields: [{ name: 'body', value: { type: 'variable', name: 'y' } }],
      }],
    };

    const warnings = validateSyncFields(badSync, new Map());
    expect(warnings).toEqual([]);
  });

  it('validates Article/list output fields in reads sync', () => {
    const articleAST = loadSpec('article');
    const tagAST = loadSpec('tag');
    const profileAST = loadSpec('profile');
    const commentAST = loadSpec('comment');
    const conceptMap = new Map<string, ConceptAST>([
      ['Article', articleAST],
      ['Tag', tagAST],
      ['Profile', profileAST],
      ['Comment', commentAST],
    ]);

    const syncs = parseSyncFile(readFileSync(resolve(SYNCS_DIR, 'app', 'reads.sync'), 'utf-8'));
    const allWarnings = syncs.flatMap(s => validateSyncFields(s, conceptMap));
    expect(allWarnings).toEqual([]);
  });
});
