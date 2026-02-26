// ============================================================
// Snapshot Conformance Tests
//
// Validates golden-file baseline management: comparing current
// output against approved snapshots, approving/rejecting changes,
// bulk approval, status queries, diff generation, and cleanup
// of orphaned baselines.
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/kernel';
import { snapshotHandler } from '../../implementations/typescript/snapshot.impl.js';
import type { ConceptStorage } from '@clef/kernel';

describe('Snapshot conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- compare: new ---

  it('should return new variant when no baseline exists for a path', async () => {
    const result = await snapshotHandler.compare(
      {
        outputPath: 'src/generated/user.ts',
        currentContent: 'export class User {}',
      },
      storage,
    );
    expect(result.variant).toBe('new');
    expect(result.path).toBe('src/generated/user.ts');
    expect(result.contentHash).toBeDefined();
    expect(typeof result.contentHash).toBe('string');
  });

  // --- compare: unchanged ---

  it('should return unchanged when current content matches approved baseline', async () => {
    const content = 'export class Password { validate() {} }';

    // Compare initially (new)
    await snapshotHandler.compare(
      { outputPath: 'src/generated/password.ts', currentContent: content },
      storage,
    );

    // Approve the snapshot
    await snapshotHandler.approve(
      { path: 'src/generated/password.ts' },
      storage,
    );

    // Compare again with same content
    const result = await snapshotHandler.compare(
      { outputPath: 'src/generated/password.ts', currentContent: content },
      storage,
    );
    expect(result.variant).toBe('unchanged');
    expect(result.snapshot).toBeDefined();
    expect(typeof result.snapshot).toBe('string');
  });

  // --- compare: changed ---

  it('should return changed with diff when content differs from baseline', async () => {
    // Create and approve initial baseline
    await snapshotHandler.compare(
      { outputPath: 'src/generated/token.ts', currentContent: 'version-1' },
      storage,
    );
    await snapshotHandler.approve(
      { path: 'src/generated/token.ts' },
      storage,
    );

    // Compare with different content
    const result = await snapshotHandler.compare(
      { outputPath: 'src/generated/token.ts', currentContent: 'version-2-modified' },
      storage,
    );
    expect(result.variant).toBe('changed');
    expect(result.snapshot).toBeDefined();
    expect(result.diff).toBeDefined();
    expect(typeof result.diff).toBe('string');
    expect(result.linesAdded).toBeDefined();
    expect(typeof result.linesAdded).toBe('number');
    expect(result.linesRemoved).toBeDefined();
    expect(typeof result.linesRemoved).toBe('number');
  });

  // --- approve: ok ---

  it('should approve a pending change and return snapshot id', async () => {
    await snapshotHandler.compare(
      { outputPath: 'src/generated/session.ts', currentContent: 'session code' },
      storage,
    );

    const result = await snapshotHandler.approve(
      { path: 'src/generated/session.ts', approver: 'test-user' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.snapshot).toBeDefined();
    expect(typeof result.snapshot).toBe('string');
  });

  // --- approve: noChange ---

  it('should return noChange when approving a path with no pending changes', async () => {
    const result = await snapshotHandler.approve(
      { path: 'src/generated/nonexistent.ts' },
      storage,
    );
    expect(result.variant).toBe('noChange');
  });

  it('should return noChange when approving an already-current snapshot', async () => {
    const content = 'stable content';
    await snapshotHandler.compare(
      { outputPath: 'src/generated/stable.ts', currentContent: content },
      storage,
    );
    await snapshotHandler.approve(
      { path: 'src/generated/stable.ts' },
      storage,
    );

    // Compare again so comparison status is 'current'
    await snapshotHandler.compare(
      { outputPath: 'src/generated/stable.ts', currentContent: content },
      storage,
    );

    const result = await snapshotHandler.approve(
      { path: 'src/generated/stable.ts' },
      storage,
    );
    expect(result.variant).toBe('noChange');
  });

  // --- approveAll ---

  it('should approve all pending comparisons and return count', async () => {
    await snapshotHandler.compare(
      { outputPath: 'src/gen/a.ts', currentContent: 'content-a' },
      storage,
    );
    await snapshotHandler.compare(
      { outputPath: 'src/gen/b.ts', currentContent: 'content-b' },
      storage,
    );
    await snapshotHandler.compare(
      { outputPath: 'src/gen/c.ts', currentContent: 'content-c' },
      storage,
    );

    const result = await snapshotHandler.approveAll({}, storage);
    expect(result.variant).toBe('ok');
    expect(result.approved).toBe(3);
  });

  it('should filter approveAll by path prefix when paths provided', async () => {
    await snapshotHandler.compare(
      { outputPath: 'src/gen/a.ts', currentContent: 'content-a' },
      storage,
    );
    await snapshotHandler.compare(
      { outputPath: 'lib/gen/b.ts', currentContent: 'content-b' },
      storage,
    );

    const result = await snapshotHandler.approveAll(
      { paths: ['src/'] },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.approved).toBe(1);
  });

  // --- reject: ok ---

  it('should reject a pending change and retain original baseline', async () => {
    // Create and approve baseline
    await snapshotHandler.compare(
      { outputPath: 'src/gen/reject-test.ts', currentContent: 'original' },
      storage,
    );
    await snapshotHandler.approve(
      { path: 'src/gen/reject-test.ts' },
      storage,
    );

    // Introduce a change
    await snapshotHandler.compare(
      { outputPath: 'src/gen/reject-test.ts', currentContent: 'modified' },
      storage,
    );

    const result = await snapshotHandler.reject(
      { path: 'src/gen/reject-test.ts' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.snapshot).toBeDefined();
  });

  // --- reject: noChange ---

  it('should return noChange when rejecting a path with no pending changes', async () => {
    const result = await snapshotHandler.reject(
      { path: 'src/gen/no-pending.ts' },
      storage,
    );
    expect(result.variant).toBe('noChange');
  });

  // --- status ---

  it('should return status of all tracked comparisons', async () => {
    await snapshotHandler.compare(
      { outputPath: 'src/gen/x.ts', currentContent: 'content-x' },
      storage,
    );
    await snapshotHandler.compare(
      { outputPath: 'src/gen/y.ts', currentContent: 'content-y' },
      storage,
    );

    const result = await snapshotHandler.status({}, storage);
    expect(result.variant).toBe('ok');
    const results = result.results as any[];
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.path).toBeDefined();
      expect(r.status).toBeDefined();
      expect(typeof r.path).toBe('string');
      expect(typeof r.status).toBe('string');
    }
  });

  // --- diff: ok ---

  it('should return unified diff for a changed snapshot', async () => {
    await snapshotHandler.compare(
      { outputPath: 'src/gen/diff-test.ts', currentContent: 'v1' },
      storage,
    );
    await snapshotHandler.approve(
      { path: 'src/gen/diff-test.ts' },
      storage,
    );
    await snapshotHandler.compare(
      { outputPath: 'src/gen/diff-test.ts', currentContent: 'v2-changed' },
      storage,
    );

    const result = await snapshotHandler.diff(
      { path: 'src/gen/diff-test.ts' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.diff).toBeDefined();
    expect(typeof result.diff).toBe('string');
    expect(result.linesAdded).toBeDefined();
    expect(result.linesRemoved).toBeDefined();
  });

  // --- diff: noBaseline ---

  it('should return noBaseline when diffing a path with no approved baseline', async () => {
    const result = await snapshotHandler.diff(
      { path: 'src/gen/never-approved.ts' },
      storage,
    );
    expect(result.variant).toBe('noBaseline');
    expect(result.path).toBe('src/gen/never-approved.ts');
  });

  // --- diff: unchanged ---

  it('should return unchanged when baseline matches current content', async () => {
    const content = 'stable-content';
    await snapshotHandler.compare(
      { outputPath: 'src/gen/stable-diff.ts', currentContent: content },
      storage,
    );
    await snapshotHandler.approve(
      { path: 'src/gen/stable-diff.ts' },
      storage,
    );
    // Re-compare with same content so comparison becomes 'current'
    await snapshotHandler.compare(
      { outputPath: 'src/gen/stable-diff.ts', currentContent: content },
      storage,
    );

    const result = await snapshotHandler.diff(
      { path: 'src/gen/stable-diff.ts' },
      storage,
    );
    expect(result.variant).toBe('unchanged');
  });

  // --- clean ---

  it('should remove orphaned baselines with no comparison and return removed list', async () => {
    // Create a baseline by comparing and approving
    await snapshotHandler.compare(
      { outputPath: 'src/gen/orphan.ts', currentContent: 'orphan-content' },
      storage,
    );
    await snapshotHandler.approve(
      { path: 'src/gen/orphan.ts' },
      storage,
    );

    // Manually delete the comparison to simulate orphan
    await storage.del('snapshot-comparisons', 'src/gen/orphan.ts');

    const result = await snapshotHandler.clean(
      { outputDir: 'src/gen' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.removed).toBeDefined();
    const removed = result.removed as string[];
    expect(removed).toContain('src/gen/orphan.ts');
  });

  // --- invariant: compare->changed then approve->ok then compare->unchanged ---

  it('should transition from changed to unchanged after approval', async () => {
    const originalContent = 'original-code';
    const updatedContent = 'updated-code';

    // Establish baseline
    await snapshotHandler.compare(
      { outputPath: 'src/gen/invariant.ts', currentContent: originalContent },
      storage,
    );
    await snapshotHandler.approve(
      { path: 'src/gen/invariant.ts' },
      storage,
    );

    // Compare with changed content
    const changedResult = await snapshotHandler.compare(
      { outputPath: 'src/gen/invariant.ts', currentContent: updatedContent },
      storage,
    );
    expect(changedResult.variant).toBe('changed');

    // Approve the change
    const approveResult = await snapshotHandler.approve(
      { path: 'src/gen/invariant.ts' },
      storage,
    );
    expect(approveResult.variant).toBe('ok');

    // Compare again with same updated content
    const unchangedResult = await snapshotHandler.compare(
      { outputPath: 'src/gen/invariant.ts', currentContent: updatedContent },
      storage,
    );
    expect(unchangedResult.variant).toBe('unchanged');
  });
});
