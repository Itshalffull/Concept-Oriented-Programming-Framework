// ============================================================
// Generator Sync Auto-Generation Tests
//
// Validates that `clef generate --generator-syncs` produces
// correct sync files for both framework generators (SchemaGen
// pipeline) and interface target providers (InterfaceGenerator
// pipeline). Covers file naming, sync DSL structure, concept
// references, and family filtering.
//
// See clef-generation-suite.md Parts 2.4–2.7
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  generateFrameworkSyncs,
  generateInterfaceSyncs,
  INTERFACE_TARGET_META,
} from '../../../../tools/clef-cli/src/commands/generate.js';
import { createInMemoryStorage } from '../../../../kernel/src/index.js';

let tempDir: string;
let emitStorage: ReturnType<typeof createInMemoryStorage>;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'clef-syncs-'));
  emitStorage = createInMemoryStorage();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

// ============================================================
// Framework generator syncs
// ============================================================

describe('Framework generator sync auto-generation', () => {
  const frameworkMeta = {
    name: 'TypeScriptGen',
    family: 'framework',
    inputKind: 'ConceptManifest',
    outputKind: 'TypeScriptFiles',
    deterministic: true,
    handler: {} as never, // not used by sync generation
  };

  it('generates 5 sync files per framework generator', async () => {
    const count = await generateFrameworkSyncs(tempDir, frameworkMeta, emitStorage);
    expect(count).toBe(5);

    const files = readdirSync(tempDir).sort();
    expect(files).toEqual([
      'cache-check-before-type-script-gen.sync',
      'emit-type-script-gen-files.sync',
      'observe-type-script-gen.sync',
      'record-cache-type-script-gen.sync',
      'type-script-gen-on-miss.sync',
    ]);
  });

  it('cache-check sync triggers on SchemaGen/generate', async () => {
    await generateFrameworkSyncs(tempDir, frameworkMeta, emitStorage);
    const content = readFileSync(
      join(tempDir, 'cache-check-before-type-script-gen.sync'),
      'utf-8',
    );
    expect(content).toContain('sync CheckCacheBeforeTypeScriptGen');
    expect(content).toContain('SchemaGen/generate');
    expect(content).toContain('BuildCache/check');
    expect(content).toContain('deterministic: true');
  });

  it('on-miss sync gates generation on cache miss', async () => {
    await generateFrameworkSyncs(tempDir, frameworkMeta, emitStorage);
    const content = readFileSync(
      join(tempDir, 'type-script-gen-on-miss.sync'),
      'utf-8',
    );
    expect(content).toContain('TypeScriptGenOnCacheMiss');
    expect(content).toContain('BuildCache/check');
    expect(content).toContain('=> changed');
    expect(content).toContain('TypeScriptGen/generate');
  });

  it('emit sync routes files through Emitter', async () => {
    await generateFrameworkSyncs(tempDir, frameworkMeta, emitStorage);
    const content = readFileSync(
      join(tempDir, 'emit-type-script-gen-files.sync'),
      'utf-8',
    );
    expect(content).toContain('EmitTypeScriptGenFiles');
    expect(content).toContain('TypeScriptGen/generate');
    expect(content).toContain('Emitter/writeBatch');
  });

  it('record-cache sync stores result after emit', async () => {
    await generateFrameworkSyncs(tempDir, frameworkMeta, emitStorage);
    const content = readFileSync(
      join(tempDir, 'record-cache-type-script-gen.sync'),
      'utf-8',
    );
    expect(content).toContain('RecordCacheTypeScriptGen');
    expect(content).toContain('Emitter/writeBatch');
    expect(content).toContain('BuildCache/record');
  });

  it('observer sync records step in GenerationPlan', async () => {
    await generateFrameworkSyncs(tempDir, frameworkMeta, emitStorage);
    const content = readFileSync(
      join(tempDir, 'observe-type-script-gen.sync'),
      'utf-8',
    );
    expect(content).toContain('ObserveTypeScriptGen');
    expect(content).toContain('GenerationPlan/recordStep');
    expect(content).toContain('"done"');
  });
});

// ============================================================
// Interface target provider syncs
// ============================================================

describe('Interface target provider sync auto-generation', () => {
  const restMeta = INTERFACE_TARGET_META.find(m => m.name === 'RestTarget')!;

  it('generates 5 sync files per interface provider', async () => {
    const count = await generateInterfaceSyncs(tempDir, restMeta, emitStorage);
    expect(count).toBe(5);

    const files = readdirSync(tempDir).sort();
    expect(files).toEqual([
      'cache-check-before-rest-target.sync',
      'emit-rest-target-files.sync',
      'observe-rest-target.sync',
      'record-cache-rest-target.sync',
      'rest-target-on-miss.sync',
    ]);
  });

  it('cache-check sync triggers on InterfaceGenerator/generate', async () => {
    await generateInterfaceSyncs(tempDir, restMeta, emitStorage);
    const content = readFileSync(
      join(tempDir, 'cache-check-before-rest-target.sync'),
      'utf-8',
    );
    expect(content).toContain('sync CheckCacheBeforeRestTarget');
    expect(content).toContain('InterfaceGenerator/generate');
    expect(content).toContain('dispatching(target: "RestTarget")');
    expect(content).toContain('BuildCache/check');
  });

  it('on-miss sync uses projection input (not manifest)', async () => {
    await generateInterfaceSyncs(tempDir, restMeta, emitStorage);
    const content = readFileSync(
      join(tempDir, 'rest-target-on-miss.sync'),
      'utf-8',
    );
    expect(content).toContain('RestTargetOnCacheMiss');
    expect(content).toContain('projection: ?projection');
    expect(content).toContain('RestTarget/generate');
    expect(content).not.toContain('manifest: ?manifest');
  });

  it('emit sync routes files through Emitter', async () => {
    await generateInterfaceSyncs(tempDir, restMeta, emitStorage);
    const content = readFileSync(
      join(tempDir, 'emit-rest-target-files.sync'),
      'utf-8',
    );
    expect(content).toContain('EmitRestTargetFiles');
    expect(content).toContain('Emitter/writeBatch');
  });

  it('observer sync uses conceptOf(projection) for step key', async () => {
    await generateInterfaceSyncs(tempDir, restMeta, emitStorage);
    const content = readFileSync(
      join(tempDir, 'observe-rest-target.sync'),
      'utf-8',
    );
    expect(content).toContain('ObserveRestTarget');
    expect(content).toContain('conceptOf(?projection)');
    expect(content).toContain('GenerationPlan/recordStep');
  });
});

// ============================================================
// Full coverage: all 14 interface providers
// ============================================================

describe('All interface providers produce valid sync files', () => {
  it('generates syncs for all 14 interface target providers', async () => {
    expect(INTERFACE_TARGET_META).toHaveLength(14);

    let totalFiles = 0;
    for (const meta of INTERFACE_TARGET_META) {
      const count = await generateInterfaceSyncs(tempDir, meta, emitStorage);
      totalFiles += count;
    }

    // 14 providers × 5 syncs each = 70 files
    expect(totalFiles).toBe(70);

    const allFiles = readdirSync(tempDir);
    expect(allFiles).toHaveLength(70);
  });

  it('covers all three provider categories', () => {
    const targets = INTERFACE_TARGET_META.filter(m => m.category === 'target');
    const sdks = INTERFACE_TARGET_META.filter(m => m.category === 'sdk');
    const specs = INTERFACE_TARGET_META.filter(m => m.category === 'spec');

    expect(targets).toHaveLength(6);
    expect(sdks).toHaveLength(6);
    expect(specs).toHaveLength(2);
  });

  it('all generated syncs are valid sync DSL (have required sections)', async () => {
    for (const meta of INTERFACE_TARGET_META) {
      await generateInterfaceSyncs(tempDir, meta, emitStorage);
    }

    const files = readdirSync(tempDir);
    for (const file of files) {
      const content = readFileSync(join(tempDir, file), 'utf-8');
      expect(content, `${file} should start with sync keyword`).toMatch(/^sync \w+/);
      expect(content, `${file} should have purpose block`).toContain('purpose {');
      expect(content, `${file} should have when block`).toContain('when {');
      expect(content, `${file} should have then block`).toContain('then {');
    }
  });
});
