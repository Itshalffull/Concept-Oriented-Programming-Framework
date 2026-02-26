// ============================================================
// Orphan Cleanup Integration Tests
//
// Validates the full orphan detection and cleanup pipeline:
//   Emitter/manifest → diff with current → Emitter/clean
//
// See clef-generation-suite.md Part 5 (Emitter Clean).
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/kernel';
import { emitterHandler } from '../../../../implementations/typescript/framework/emitter.impl.js';
import type { ConceptStorage } from '@clef/kernel';

describe('Orphan cleanup integration', () => {
  let storage: ConceptStorage;

  beforeEach(async () => {
    storage = createInMemoryStorage();

    // Populate with some tracked files
    await emitterHandler.write(
      { path: 'out/keep-a.ts', content: 'keep a' },
      storage,
    );
    await emitterHandler.write(
      { path: 'out/keep-b.ts', content: 'keep b' },
      storage,
    );
    await emitterHandler.write(
      { path: 'out/orphan.ts', content: 'will be orphaned' },
      storage,
    );
  });

  it('should detect orphaned files not in current manifest', async () => {
    // Current manifest only has keep-a and keep-b
    const cleanResult = await emitterHandler.clean(
      {
        outputDir: 'out',
        currentManifest: ['out/keep-a.ts', 'out/keep-b.ts'],
      },
      storage,
    );
    expect(cleanResult.variant).toBe('ok');
    const removed = (cleanResult.removed as string[]) || [];
    expect(removed).toContain('out/orphan.ts');
    expect(removed).not.toContain('out/keep-a.ts');
    expect(removed).not.toContain('out/keep-b.ts');
  });

  it('should not remove anything when all files are current', async () => {
    const cleanResult = await emitterHandler.clean(
      {
        outputDir: 'out',
        currentManifest: ['out/keep-a.ts', 'out/keep-b.ts', 'out/orphan.ts'],
      },
      storage,
    );
    const removed = (cleanResult.removed as string[]) || [];
    expect(removed).toHaveLength(0);
  });

  it('should remove all tracked files when manifest is empty', async () => {
    const cleanResult = await emitterHandler.clean(
      {
        outputDir: 'out',
        currentManifest: [],
      },
      storage,
    );
    const removed = (cleanResult.removed as string[]) || [];
    expect(removed).toHaveLength(3);
  });

  it('should integrate with manifest listing', async () => {
    // Get manifest of tracked files
    const manifestResult = await emitterHandler.manifest(
      { outputDir: 'out' },
      storage,
    );
    const files = (manifestResult.files as { path: string }[]) || [];
    expect(files.length).toBe(3);

    // Simulate: a new generation run only produces 2 files
    const newManifest = ['out/keep-a.ts', 'out/keep-b.ts'];

    // Clean orphans
    const cleanResult = await emitterHandler.clean(
      { outputDir: 'out', currentManifest: newManifest },
      storage,
    );
    const removed = (cleanResult.removed as string[]) || [];
    expect(removed).toContain('out/orphan.ts');
  });

  it('should handle clean with no tracked files gracefully', async () => {
    const emptyStorage = createInMemoryStorage();
    const cleanResult = await emitterHandler.clean(
      { outputDir: 'empty', currentManifest: [] },
      emptyStorage,
    );
    expect(cleanResult.variant).toBe('ok');
    const removed = (cleanResult.removed as string[]) || [];
    expect(removed).toHaveLength(0);
  });
});
