// ============================================================
// Score Auto-Integration Tests
//
// Validates that Score concepts (ScoreApi, ScoreIndex) work
// correctly as built-in concepts, that the kernel bootstrap
// registers them, and that the interface targets generate
// LLM-friendly output. See Architecture doc Sections 10.1, 2.7.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { scoreApiHandler } from '../handlers/ts/score/score-api.handler.js';
import { scoreIndexHandler } from '../handlers/ts/score/score-index.handler.js';
import { bootstrapScore, isScoreRegistered, SCORE_API_URI, SCORE_INDEX_URI } from '../runtime/score-bootstrap.js';
import type { ConceptStorage } from '../runtime/types.js';

// ─── ScoreIndex Conformance ─────────────────────────────

describe('ScoreIndex handler', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- upsertConcept ---

  it('should upsert a concept entry and return ok', async () => {
    const result = await scoreIndexHandler.upsertConcept(
      { name: 'User', purpose: 'Manage user accounts', actions: ['register', 'login'], stateFields: ['email', 'name'], file: 'specs/user.concept' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.index).toBe('concept:User');
  });

  it('should return error when concept name is missing', async () => {
    const result = await scoreIndexHandler.upsertConcept(
      { name: '', purpose: 'test', actions: [], stateFields: [], file: '' },
      storage,
    );
    expect(result.variant).toBe('error');
  });

  it('should update an existing concept entry', async () => {
    await scoreIndexHandler.upsertConcept(
      { name: 'User', purpose: 'v1', actions: ['register'], stateFields: [], file: 'user.concept' },
      storage,
    );
    const result = await scoreIndexHandler.upsertConcept(
      { name: 'User', purpose: 'v2', actions: ['register', 'login'], stateFields: ['email'], file: 'user.concept' },
      storage,
    );
    expect(result.variant).toBe('ok');

    // Verify stats reflect only one concept
    const stats = await scoreIndexHandler.stats({}, storage);
    expect(stats.conceptCount).toBe(1);
  });

  // --- upsertSync ---

  it('should upsert a sync entry', async () => {
    const result = await scoreIndexHandler.upsertSync(
      { name: 'RegisterUser', annotation: 'eager', triggers: ['Web/request'], effects: ['User/register'], file: 'syncs/register-user.sync' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.index).toBe('sync:RegisterUser');
  });

  it('should return error when sync name is missing', async () => {
    const result = await scoreIndexHandler.upsertSync(
      { name: '', annotation: 'eager', triggers: [], effects: [], file: '' },
      storage,
    );
    expect(result.variant).toBe('error');
  });

  // --- upsertSymbol ---

  it('should upsert a symbol entry', async () => {
    const result = await scoreIndexHandler.upsertSymbol(
      { name: 'UserHandler', kind: 'class', file: 'handlers/user.ts', line: 42, scope: 'module' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.index).toContain('symbol:UserHandler');
  });

  it('should return error when symbol name is missing', async () => {
    const result = await scoreIndexHandler.upsertSymbol(
      { name: '', kind: 'function', file: '', line: 0, scope: '' },
      storage,
    );
    expect(result.variant).toBe('error');
  });

  // --- upsertFile ---

  it('should upsert a file entry', async () => {
    const result = await scoreIndexHandler.upsertFile(
      { path: 'specs/user.concept', language: 'concept-spec', role: 'spec', definitions: ['User'] },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.index).toBe('file:specs/user.concept');
  });

  it('should return error when file path is missing', async () => {
    const result = await scoreIndexHandler.upsertFile(
      { path: '', language: '', role: '', definitions: [] },
      storage,
    );
    expect(result.variant).toBe('error');
  });

  // --- removeByFile ---

  it('should remove all entries for a file', async () => {
    await scoreIndexHandler.upsertFile(
      { path: 'user.ts', language: 'typescript', role: 'source', definitions: ['User'] },
      storage,
    );
    await scoreIndexHandler.upsertSymbol(
      { name: 'User', kind: 'class', file: 'user.ts', line: 1, scope: 'module' },
      storage,
    );
    await scoreIndexHandler.upsertConcept(
      { name: 'User', purpose: 'test', actions: [], stateFields: [], file: 'user.ts' },
      storage,
    );

    const result = await scoreIndexHandler.removeByFile({ path: 'user.ts' }, storage);
    expect(result.variant).toBe('ok');
    expect(result.removed).toBeGreaterThanOrEqual(2);

    const stats = await scoreIndexHandler.stats({}, storage);
    expect(stats.fileCount).toBe(0);
  });

  // --- clear ---

  it('should clear all index entries', async () => {
    await scoreIndexHandler.upsertConcept(
      { name: 'A', purpose: 'test', actions: [], stateFields: [], file: 'a.concept' },
      storage,
    );
    await scoreIndexHandler.upsertSync(
      { name: 'S', annotation: 'eager', triggers: [], effects: [], file: 's.sync' },
      storage,
    );
    await scoreIndexHandler.upsertFile(
      { path: 'f.ts', language: 'ts', role: 'source', definitions: [] },
      storage,
    );

    const result = await scoreIndexHandler.clear({}, storage);
    expect(result.variant).toBe('ok');
    expect(result.cleared).toBe(3);

    const stats = await scoreIndexHandler.stats({}, storage);
    expect(stats.conceptCount).toBe(0);
    expect(stats.syncCount).toBe(0);
    expect(stats.fileCount).toBe(0);
  });

  // --- stats ---

  it('should return accurate counts', async () => {
    await scoreIndexHandler.upsertConcept(
      { name: 'A', purpose: 'a', actions: ['x'], stateFields: [], file: 'a.concept' },
      storage,
    );
    await scoreIndexHandler.upsertConcept(
      { name: 'B', purpose: 'b', actions: ['y'], stateFields: [], file: 'b.concept' },
      storage,
    );
    await scoreIndexHandler.upsertSync(
      { name: 'S1', annotation: 'eager', triggers: ['A/x'], effects: ['B/y'], file: 's.sync' },
      storage,
    );
    await scoreIndexHandler.upsertSymbol(
      { name: 'handler', kind: 'function', file: 'h.ts', line: 1, scope: '' },
      storage,
    );
    await scoreIndexHandler.upsertFile(
      { path: 'h.ts', language: 'typescript', role: 'source', definitions: ['handler'] },
      storage,
    );

    const stats = await scoreIndexHandler.stats({}, storage);
    expect(stats.variant).toBe('ok');
    expect(stats.conceptCount).toBe(2);
    expect(stats.syncCount).toBe(1);
    expect(stats.symbolCount).toBe(1);
    expect(stats.fileCount).toBe(1);
    expect(stats.lastUpdated).toBeTruthy();
  });
});

// ─── ScoreApi Conformance ───────────────────────────────

describe('ScoreApi handler', () => {
  let storage: ConceptStorage;

  beforeEach(async () => {
    storage = createInMemoryStorage();

    // Seed the index with test data
    await scoreIndexHandler.upsertConcept(
      { name: 'User', purpose: 'Manage user accounts', actions: ['register', 'login', 'deactivate'], stateFields: ['email', 'name', 'active'], file: 'specs/app/user.concept' },
      storage,
    );
    await scoreIndexHandler.upsertConcept(
      { name: 'Password', purpose: 'Manage password hashing and verification', actions: ['set', 'verify'], stateFields: ['hash', 'salt'], file: 'specs/app/password.concept' },
      storage,
    );
    await scoreIndexHandler.upsertSync(
      { name: 'RegisterUser', annotation: 'eager', triggers: ['Web/request'], effects: ['User/register', 'Password/set'], file: 'syncs/register-user.sync' },
      storage,
    );
    await scoreIndexHandler.upsertSymbol(
      { name: 'UserHandler', kind: 'class', file: 'handlers/user.ts', line: 10, scope: 'module' },
      storage,
    );
    await scoreIndexHandler.upsertSymbol(
      { name: 'PasswordHandler', kind: 'class', file: 'handlers/password.ts', line: 5, scope: 'module' },
      storage,
    );
    await scoreIndexHandler.upsertFile(
      { path: 'specs/app/user.concept', language: 'concept-spec', role: 'spec', definitions: ['User'] },
      storage,
    );
    await scoreIndexHandler.upsertFile(
      { path: 'handlers/user.ts', language: 'typescript', role: 'source', definitions: ['UserHandler'] },
      storage,
    );
  });

  // --- listFiles ---

  it('should list all files with wildcard pattern', async () => {
    const result = await scoreApiHandler.listFiles({ pattern: '*' }, storage);
    expect(result.variant).toBe('ok');
    expect(result.files).toHaveLength(2);
  });

  it('should return empty for non-matching pattern', async () => {
    const result = await scoreApiHandler.listFiles({ pattern: '**/*.rs' }, storage);
    expect(result.variant).toBe('empty');
  });

  // --- getFileTree ---

  it('should return a tree view', async () => {
    const result = await scoreApiHandler.getFileTree({ path: 'specs', depth: 0 }, storage);
    expect(result.variant).toBe('ok');
    expect(typeof result.tree).toBe('string');
    expect(result.fileCount).toBeGreaterThan(0);
  });

  // --- getFileContent ---

  it('should return file content for indexed file', async () => {
    const result = await scoreApiHandler.getFileContent({ path: 'specs/app/user.concept' }, storage);
    expect(result.variant).toBe('ok');
    expect(result.language).toBe('concept-spec');
  });

  it('should return notFound for missing file', async () => {
    const result = await scoreApiHandler.getFileContent({ path: 'nonexistent.ts' }, storage);
    expect(result.variant).toBe('notFound');
  });

  // --- getDefinitions ---

  it('should return definitions for file with symbols', async () => {
    const result = await scoreApiHandler.getDefinitions({ path: 'handlers/user.ts' }, storage);
    expect(result.variant).toBe('ok');
    expect(result.definitions).toHaveLength(1);
    expect((result.definitions as any[])[0].name).toBe('UserHandler');
  });

  it('should return notFound for file without symbols', async () => {
    const result = await scoreApiHandler.getDefinitions({ path: 'nonexistent.ts' }, storage);
    expect(result.variant).toBe('notFound');
  });

  // --- findSymbol ---

  it('should find symbols by name (case-insensitive)', async () => {
    const result = await scoreApiHandler.findSymbol({ name: 'handler' }, storage);
    expect(result.variant).toBe('ok');
    expect((result.symbols as any[]).length).toBe(2);
  });

  it('should return notFound for unknown symbol', async () => {
    const result = await scoreApiHandler.findSymbol({ name: 'ZZZNonexistent' }, storage);
    expect(result.variant).toBe('notFound');
  });

  // --- listConcepts ---

  it('should list all indexed concepts', async () => {
    const result = await scoreApiHandler.listConcepts({}, storage);
    expect(result.variant).toBe('ok');
    expect((result.concepts as any[]).length).toBe(2);
    const names = (result.concepts as any[]).map((c: any) => c.name);
    expect(names).toContain('User');
    expect(names).toContain('Password');
  });

  // --- getConcept ---

  it('should get detailed concept info', async () => {
    const result = await scoreApiHandler.getConcept({ name: 'User' }, storage);
    expect(result.variant).toBe('ok');
    expect((result.concept as any).name).toBe('User');
    expect((result.concept as any).purpose).toBe('Manage user accounts');
  });

  it('should return notFound for unknown concept', async () => {
    const result = await scoreApiHandler.getConcept({ name: 'Nonexistent' }, storage);
    expect(result.variant).toBe('notFound');
  });

  // --- listSyncs ---

  it('should list all indexed syncs', async () => {
    const result = await scoreApiHandler.listSyncs({}, storage);
    expect(result.variant).toBe('ok');
    expect((result.syncs as any[]).length).toBe(1);
    expect((result.syncs as any[])[0].name).toBe('RegisterUser');
  });

  // --- getSync ---

  it('should get detailed sync info', async () => {
    const result = await scoreApiHandler.getSync({ name: 'RegisterUser' }, storage);
    expect(result.variant).toBe('ok');
    expect((result.sync as any).name).toBe('RegisterUser');
    expect((result.sync as any).annotation).toBe('eager');
  });

  it('should return notFound for unknown sync', async () => {
    const result = await scoreApiHandler.getSync({ name: 'Nonexistent' }, storage);
    expect(result.variant).toBe('notFound');
  });

  // --- search ---

  it('should search concepts by natural language query', async () => {
    const result = await scoreApiHandler.search({ query: 'user', limit: 10 }, storage);
    expect(result.variant).toBe('ok');
    const results = result.results as any[];
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('User');
  });

  it('should search across concepts, syncs, and symbols', async () => {
    const result = await scoreApiHandler.search({ query: 'Register', limit: 20 }, storage);
    expect(result.variant).toBe('ok');
    const results = result.results as any[];
    const kinds = results.map((r: any) => r.kind);
    expect(kinds).toContain('sync');
  });

  it('should return empty for no-match query', async () => {
    const result = await scoreApiHandler.search({ query: 'zzzzzzzzz', limit: 10 }, storage);
    expect(result.variant).toBe('empty');
  });

  // --- explain ---

  it('should explain a concept', async () => {
    const result = await scoreApiHandler.explain({ symbol: 'User' }, storage);
    expect(result.variant).toBe('ok');
    expect(result.summary).toContain('User');
    expect(result.summary).toContain('concept');
    expect(result.kind).toBe('concept');
  });

  it('should explain a sync', async () => {
    const result = await scoreApiHandler.explain({ symbol: 'RegisterUser' }, storage);
    expect(result.variant).toBe('ok');
    expect(result.summary).toContain('RegisterUser');
    expect(result.kind).toBe('sync');
  });

  it('should explain a symbol', async () => {
    const result = await scoreApiHandler.explain({ symbol: 'UserHandler' }, storage);
    expect(result.variant).toBe('ok');
    expect(result.summary).toContain('UserHandler');
    expect(result.kind).toBe('class');
  });

  it('should return notFound for unknown entity', async () => {
    const result = await scoreApiHandler.explain({ symbol: 'Nonexistent' }, storage);
    expect(result.variant).toBe('notFound');
  });

  // --- status ---

  it('should return index status with accurate counts', async () => {
    const result = await scoreApiHandler.status({}, storage);
    expect(result.variant).toBe('ok');
    expect(result.indexed).toBe(true);
    expect(result.conceptCount).toBe(2);
    expect(result.syncCount).toBe(1);
    expect(result.symbolCount).toBe(2);
    expect(result.fileCount).toBe(2);
  });

  // --- reindex ---

  it('should clear the index and return zero counts', async () => {
    const result = await scoreApiHandler.reindex({}, storage);
    expect(result.variant).toBe('ok');
    expect(result.conceptCount).toBe(0);
    expect(result.fileCount).toBe(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  // --- getFlow ---

  it('should trace action flow through syncs', async () => {
    const result = await scoreApiHandler.getFlow(
      { startConcept: 'Web', startAction: 'request' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const flow = result.flow as any[];
    expect(flow.length).toBeGreaterThan(0);
    // First entry should be Web/request
    expect(flow[0].concept).toBe('Web');
    expect(flow[0].action).toBe('request');
  });

  // --- matchPattern ---

  it('should return ok for valid pattern (stub)', async () => {
    const result = await scoreApiHandler.matchPattern(
      { pattern: '(function_declaration)', language: 'typescript' },
      storage,
    );
    expect(result.variant).toBe('ok');
  });

  it('should return invalidPattern for empty pattern', async () => {
    const result = await scoreApiHandler.matchPattern(
      { pattern: '', language: 'typescript' },
      storage,
    );
    expect(result.variant).toBe('invalidPattern');
  });
});

// ─── Score Bootstrap ────────────────────────────────────

describe('Score bootstrap', () => {
  it('should register Score concepts in the registry', () => {
    // Create a minimal registry
    const entries = new Map<string, unknown>();
    const registry = {
      register(uri: string, transport: unknown) { entries.set(uri, transport); },
      resolve(uri: string) { return entries.get(uri); },
    };

    expect(isScoreRegistered(registry as any)).toBe(false);

    bootstrapScore(
      registry as any,
      scoreApiHandler,
      scoreIndexHandler,
      () => {}, // no-op sync registration
    );

    expect(isScoreRegistered(registry as any)).toBe(true);
    expect(entries.has(SCORE_API_URI)).toBe(true);
    expect(entries.has(SCORE_INDEX_URI)).toBe(true);
  });

  it('should not double-register Score', () => {
    const entries = new Map<string, unknown>();
    let registerCount = 0;
    const registry = {
      register(uri: string, transport: unknown) {
        entries.set(uri, transport);
        registerCount++;
      },
      resolve(uri: string) { return entries.get(uri); },
    };

    bootstrapScore(registry as any, scoreApiHandler, scoreIndexHandler, () => {});
    const firstCount = registerCount;

    // Attempt second bootstrap — should be skipped by isScoreRegistered guard
    if (!isScoreRegistered(registry as any)) {
      bootstrapScore(registry as any, scoreApiHandler, scoreIndexHandler, () => {});
    }

    expect(registerCount).toBe(firstCount);
  });

  it('should register indexing syncs during bootstrap', () => {
    const entries = new Map<string, unknown>();
    const registry = {
      register(uri: string, transport: unknown) { entries.set(uri, transport); },
      resolve(uri: string) { return entries.get(uri); },
    };

    const registeredSyncs: unknown[] = [];
    bootstrapScore(
      registry as any,
      scoreApiHandler,
      scoreIndexHandler,
      (sync) => { registeredSyncs.push(sync); },
    );

    // Should register the 4 indexing syncs
    expect(registeredSyncs.length).toBe(4);
  });
});
