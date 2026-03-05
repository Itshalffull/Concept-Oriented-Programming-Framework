// ============================================================
// Emitter Conformance Tests
//
// Validates content-addressed writes, batch operations,
// source traceability, drift detection, and orphan cleanup.
// See clef-generation-suite.md Part 1.5
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/runtime';
import { emitterHandler } from '../../../../handlers/ts/framework/emitter.handler.js';
import type { ConceptStorage } from '@clef/runtime';

describe('Emitter conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- write ---

  it('should write a new file and return written: true', async () => {
    const result = await emitterHandler.write(
      { path: 'out/test.ts', content: 'export const x = 1;' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.written).toBe(true);
    expect(result.path).toBe('out/test.ts');
    expect(result.contentHash).toBeDefined();
  });

  it('should skip write when content hash matches (content-addressed)', async () => {
    const content = 'export const x = 1;';

    const first = await emitterHandler.write(
      { path: 'out/test.ts', content },
      storage,
    );
    expect(first.written).toBe(true);

    const second = await emitterHandler.write(
      { path: 'out/test.ts', content },
      storage,
    );
    expect(second.variant).toBe('ok');
    expect(second.written).toBe(false);
    expect(second.contentHash).toBe(first.contentHash);
  });

  it('should rewrite when content changes', async () => {
    await emitterHandler.write(
      { path: 'out/test.ts', content: 'v1' },
      storage,
    );

    const result = await emitterHandler.write(
      { path: 'out/test.ts', content: 'v2' },
      storage,
    );
    expect(result.written).toBe(true);
  });

  it('should return error when path is missing', async () => {
    const result = await emitterHandler.write(
      { path: '', content: 'hello' },
      storage,
    );
    expect(result.variant).toBe('error');
  });

  // --- write with sources (traceability) ---

  it('should store source provenance when sources are provided', async () => {
    await emitterHandler.write(
      {
        path: 'out/password.ts',
        content: 'export const password = {};',
        sources: [
          { sourcePath: './specs/password.concept', conceptName: 'Password' },
        ],
      },
      storage,
    );

    const trace = await emitterHandler.trace(
      { outputPath: 'out/password.ts' },
      storage,
    );
    expect(trace.variant).toBe('ok');
    expect(trace.sources).toHaveLength(1);
    expect((trace.sources as any[])[0].sourcePath).toBe('./specs/password.concept');
  });

  // --- writeBatch ---

  it('should write multiple files in a batch', async () => {
    const result = await emitterHandler.writeBatch(
      {
        files: [
          { path: 'out/a.ts', content: 'const a = 1;' },
          { path: 'out/b.ts', content: 'const b = 2;' },
          { path: 'out/c.ts', content: 'const c = 3;' },
        ],
      },
      storage,
    );

    expect(result.variant).toBe('ok');
    const results = result.results as any[];
    expect(results).toHaveLength(3);
    expect(results[0].written).toBe(true);
    expect(results[1].written).toBe(true);
    expect(results[2].written).toBe(true);
  });

  it('should skip unchanged files in batch', async () => {
    // Write initial batch
    await emitterHandler.writeBatch(
      {
        files: [
          { path: 'out/a.ts', content: 'const a = 1;' },
          { path: 'out/b.ts', content: 'const b = 2;' },
        ],
      },
      storage,
    );

    // Write same content again
    const result = await emitterHandler.writeBatch(
      {
        files: [
          { path: 'out/a.ts', content: 'const a = 1;' },
          { path: 'out/b.ts', content: 'const b = CHANGED;' },
        ],
      },
      storage,
    );

    const results = result.results as any[];
    expect(results[0].written).toBe(false);  // unchanged
    expect(results[1].written).toBe(true);   // changed
  });

  it('should return ok with empty results for empty batch', async () => {
    const result = await emitterHandler.writeBatch(
      { files: [] },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.results).toEqual([]);
  });

  // --- format ---

  it('should format a file by path', async () => {
    await emitterHandler.write(
      { path: 'out/test.ts', content: 'const x=1;' },
      storage,
    );

    const result = await emitterHandler.format(
      { path: 'out/test.ts' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.changed).toBe(true);
  });

  it('should return changed: false for unknown extensions', async () => {
    await emitterHandler.write(
      { path: 'out/data.xyz', content: 'data' },
      storage,
    );

    const result = await emitterHandler.format(
      { path: 'out/data.xyz' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.changed).toBe(false);
  });

  // --- trace ---

  it('should return notFound for untracked output path', async () => {
    const result = await emitterHandler.trace(
      { outputPath: 'nonexistent.ts' },
      storage,
    );
    expect(result.variant).toBe('notFound');
  });

  it('should return empty sources when file has no provenance', async () => {
    await emitterHandler.write(
      { path: 'out/test.ts', content: 'hello' },
      storage,
    );

    const result = await emitterHandler.trace(
      { outputPath: 'out/test.ts' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.sources).toEqual([]);
  });

  // --- affected ---

  it('should find all outputs affected by a source path', async () => {
    await emitterHandler.write(
      {
        path: 'out/password.ts',
        content: 'export const pw = {};',
        sources: [{ sourcePath: './specs/password.concept' }],
      },
      storage,
    );
    await emitterHandler.write(
      {
        path: 'out/password.handler.ts',
        content: 'export interface PwHandler {}',
        sources: [{ sourcePath: './specs/password.concept' }],
      },
      storage,
    );
    await emitterHandler.write(
      {
        path: 'out/user.ts',
        content: 'export const user = {};',
        sources: [{ sourcePath: './specs/user.concept' }],
      },
      storage,
    );

    const result = await emitterHandler.affected(
      { sourcePath: './specs/password.concept' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const outputs = result.outputs as string[];
    expect(outputs).toHaveLength(2);
    expect(outputs).toContain('out/password.ts');
    expect(outputs).toContain('out/password.handler.ts');
  });

  // --- clean ---

  it('should remove orphaned files from output directory', async () => {
    await emitterHandler.write(
      { path: 'out/keep.ts', content: 'keep' },
      storage,
    );
    await emitterHandler.write(
      { path: 'out/remove.ts', content: 'remove' },
      storage,
    );

    const result = await emitterHandler.clean(
      { outputDir: 'out', currentManifest: ['out/keep.ts'] },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.removed).toEqual(['out/remove.ts']);
  });

  it('should support legacy currentFiles parameter', async () => {
    await emitterHandler.write(
      { path: 'out/a.ts', content: 'a' },
      storage,
    );
    await emitterHandler.write(
      { path: 'out/b.ts', content: 'b' },
      storage,
    );

    const result = await emitterHandler.clean(
      { outputDir: 'out', currentFiles: ['out/a.ts'] },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.removed).toEqual(['out/b.ts']);
  });

  // --- manifest ---

  it('should return manifest for output directory', async () => {
    await emitterHandler.write(
      { path: 'out/a.ts', content: 'const a = 1;' },
      storage,
    );
    await emitterHandler.write(
      { path: 'out/b.ts', content: 'const b = 2;' },
      storage,
    );

    const result = await emitterHandler.manifest(
      { outputDir: 'out' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const files = result.files as any[];
    expect(files).toHaveLength(2);
    expect(files.map((f: any) => f.path).sort()).toEqual(['out/a.ts', 'out/b.ts']);
  });

  // --- audit ---

  it('should report current status for unmodified files', async () => {
    await emitterHandler.write(
      { path: 'out/test.ts', content: 'const x = 1;' },
      storage,
    );

    const result = await emitterHandler.audit(
      { outputDir: 'out' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const status = result.status as any[];
    expect(status).toHaveLength(1);
    expect(status[0].state).toBe('current');
  });
});
