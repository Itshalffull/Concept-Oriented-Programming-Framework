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
} from '../kernel/src/index.js';
import { parseSyncFile } from '../implementations/typescript/framework/sync-parser.impl.js';
import { syncParserHandler } from '../implementations/typescript/framework/sync-parser.impl.js';
import { syncCompilerHandler } from '../implementations/typescript/framework/sync-compiler.impl.js';
import type { CompiledSync } from '../kernel/src/types.js';

const SYNCS_DIR = resolve(__dirname, '..', 'syncs');

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
