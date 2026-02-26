// ============================================================
// Source Traceability Integration Tests
//
// Validates the end-to-end source traceability pipeline:
//   write with sources → trace → affected → audit
//
// See clef-generation-suite.md Part 5 (Emitter Traceability).
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/kernel';
import { emitterHandler } from '../../../../implementations/typescript/framework/emitter.impl.js';
import type { ConceptStorage } from '@clef/kernel';

describe('Source traceability integration', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('should trace single file back to its source', async () => {
    // Write a file with source provenance
    await emitterHandler.write(
      {
        path: 'generated/ts/password.types.ts',
        content: 'export interface PasswordInput {}',
        target: 'typescript',
        concept: 'Password',
        sources: [
          { sourcePath: 'specs/password.concept', conceptName: 'Password' },
        ],
      },
      storage,
    );

    // Trace the output back to its source
    const traceResult = await emitterHandler.trace(
      { outputPath: 'generated/ts/password.types.ts' },
      storage,
    );
    expect(traceResult.variant).toBe('ok');
    const sources = traceResult.sources as { sourcePath: string; conceptName: string }[];
    expect(sources).toHaveLength(1);
    expect(sources[0].sourcePath).toBe('specs/password.concept');
    expect(sources[0].conceptName).toBe('Password');
  });

  it('should find all affected outputs for a source change', async () => {
    // Write multiple files from same source
    await emitterHandler.write(
      {
        path: 'generated/ts/password.types.ts',
        content: 'types',
        sources: [{ sourcePath: 'specs/password.concept', conceptName: 'Password' }],
      },
      storage,
    );
    await emitterHandler.write(
      {
        path: 'generated/ts/password.handler.ts',
        content: 'handler',
        sources: [{ sourcePath: 'specs/password.concept', conceptName: 'Password' }],
      },
      storage,
    );
    await emitterHandler.write(
      {
        path: 'generated/ts/password.adapter.ts',
        content: 'adapter',
        sources: [{ sourcePath: 'specs/password.concept', conceptName: 'Password' }],
      },
      storage,
    );

    // Write a file from a different source
    await emitterHandler.write(
      {
        path: 'generated/ts/auth.types.ts',
        content: 'auth types',
        sources: [{ sourcePath: 'specs/auth.concept', conceptName: 'Auth' }],
      },
      storage,
    );

    // Check what's affected if password.concept changes
    const result = await emitterHandler.affected(
      { sourcePath: 'specs/password.concept' },
      storage,
    );
    const outputs = (result.outputs as string[]) || [];
    expect(outputs).toHaveLength(3);
    expect(outputs).toContain('generated/ts/password.types.ts');
    expect(outputs).toContain('generated/ts/password.handler.ts');
    expect(outputs).toContain('generated/ts/password.adapter.ts');
    expect(outputs).not.toContain('generated/ts/auth.types.ts');
  });

  it('should support batch write with source tracing', async () => {
    const batchResult = await emitterHandler.writeBatch(
      {
        files: [
          {
            path: 'generated/rest/auth.routes.ts',
            content: 'routes',
            sources: [{ sourcePath: 'specs/auth.concept', conceptName: 'Auth' }],
          },
          {
            path: 'generated/rest/auth.middleware.ts',
            content: 'middleware',
            sources: [{ sourcePath: 'specs/auth.concept', conceptName: 'Auth' }],
          },
        ],
      },
      storage,
    );
    expect(batchResult.variant).toBe('ok');

    // Trace each file
    const trace1 = await emitterHandler.trace(
      { outputPath: 'generated/rest/auth.routes.ts' },
      storage,
    );
    const trace2 = await emitterHandler.trace(
      { outputPath: 'generated/rest/auth.middleware.ts' },
      storage,
    );

    expect((trace1.sources as any[]).length).toBe(1);
    expect((trace2.sources as any[]).length).toBe(1);
  });

  it('should report current status for traced files', async () => {
    // Write files
    await emitterHandler.write(
      { path: 'out/a.ts', content: 'file a' },
      storage,
    );
    await emitterHandler.write(
      { path: 'out/b.ts', content: 'file b' },
      storage,
    );

    // Audit
    const auditResult = await emitterHandler.audit(
      { outputDir: 'out' },
      storage,
    );
    expect(auditResult.variant).toBe('ok');
    const statuses = auditResult.status as { path: string; state: string }[];
    expect(statuses.length).toBe(2);
    for (const s of statuses) {
      expect(s.state).toBe('current');
    }
  });

  it('should rewrite when content actually changes', async () => {
    // Write a file
    await emitterHandler.write(
      { path: 'out/c.ts', content: 'original content' },
      storage,
    );

    // Write with different content — should detect change and rewrite
    const writeResult = await emitterHandler.write(
      { path: 'out/c.ts', content: 'modified content' },
      storage,
    );
    expect(writeResult.written).toBe(true); // Content changed → rewrite
  });

  it('should preserve trace through content-addressed skip', async () => {
    // First write with source
    await emitterHandler.write(
      {
        path: 'out/d.ts',
        content: 'unchanged content',
        sources: [{ sourcePath: 'src/d.concept', conceptName: 'D' }],
      },
      storage,
    );

    // Second write with same content → skipped
    const result = await emitterHandler.write(
      {
        path: 'out/d.ts',
        content: 'unchanged content',
        sources: [{ sourcePath: 'src/d.concept', conceptName: 'D' }],
      },
      storage,
    );
    expect(result.written).toBe(false);

    // Trace should still work (preserved from first write)
    const trace = await emitterHandler.trace(
      { outputPath: 'out/d.ts' },
      storage,
    );
    expect(trace.variant).toBe('ok');
    expect((trace.sources as any[]).length).toBe(1);
  });
});
