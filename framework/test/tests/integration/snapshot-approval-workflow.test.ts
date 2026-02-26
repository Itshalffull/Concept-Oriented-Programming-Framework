// ============================================================
// Snapshot Approval Workflow Integration Test
//
// Tests the Emitter->Snapshot pipeline that sync chains would
// orchestrate:
// 1. Emitter writes generated content (simulated)
// 2. Snapshot/compare detects new files (no baseline)
// 3. Snapshot/approve creates baselines
// 4. Content changes -> Snapshot/compare -> changed
// 5. Snapshot/approve updates baseline
// 6. Same content -> Snapshot/compare -> unchanged
// 7. Multiple files -> approveAll
// 8. Reject workflow
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@copf/kernel';
import { snapshotHandler } from '../../implementations/typescript/snapshot.impl.js';
import type { ConceptStorage } from '@copf/kernel';

/**
 * Simulates emitter output followed by snapshot comparison.
 * In a real sync chain the Emitter concept would produce generated
 * content and the Snapshot concept would compare it against the
 * approved baseline.
 */
async function emitAndCompare(
  storage: ConceptStorage,
  outputPath: string,
  content: string,
): Promise<Record<string, unknown>> {
  // Step 1: Emitter produces generated content (simulated as a string)
  // Step 2: Snapshot/compare checks the content against baselines
  return snapshotHandler.compare(
    { outputPath, currentContent: content },
    storage,
  );
}

describe('Snapshot approval workflow integration', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('should detect new files with no existing baseline', async () => {
    const result = await emitAndCompare(
      storage,
      'gen/password.ts',
      'export class Password { validate(input: string): boolean { return input.length >= 8; } }',
    );

    expect(result.variant).toBe('new');
    expect(result.path).toBe('gen/password.ts');
    expect(result.contentHash).toBeDefined();
    expect(typeof result.contentHash).toBe('string');
  });

  it('should create baseline via approve after new file detection', async () => {
    // Emit and compare — new file
    await emitAndCompare(
      storage,
      'gen/password.ts',
      'export class Password {}',
    );

    // Approve the new snapshot
    const approveResult = await snapshotHandler.approve(
      { path: 'gen/password.ts', approver: 'alice' },
      storage,
    );

    expect(approveResult.variant).toBe('ok');
    expect(approveResult.snapshot).toBeDefined();
    expect(typeof approveResult.snapshot).toBe('string');
  });

  it('should detect content change after baseline is established', async () => {
    // Emit v1 and approve
    await emitAndCompare(storage, 'gen/user.ts', 'export class User { name: string; }');
    await snapshotHandler.approve({ path: 'gen/user.ts' }, storage);

    // Emit v2 — content changed
    const compareResult = await emitAndCompare(
      storage,
      'gen/user.ts',
      'export class User { name: string; email: string; }',
    );

    expect(compareResult.variant).toBe('changed');
    expect(compareResult.diff).toBeDefined();
    expect(typeof compareResult.diff).toBe('string');
    expect(typeof compareResult.linesAdded).toBe('number');
    expect(typeof compareResult.linesRemoved).toBe('number');
  });

  it('should update baseline when approving a changed snapshot', async () => {
    // Emit v1, approve, emit v2
    await emitAndCompare(storage, 'gen/token.ts', 'const TOKEN_V1 = true;');
    await snapshotHandler.approve({ path: 'gen/token.ts' }, storage);
    await emitAndCompare(storage, 'gen/token.ts', 'const TOKEN_V2 = true;');

    // Approve the change
    const approveResult = await snapshotHandler.approve(
      { path: 'gen/token.ts' },
      storage,
    );
    expect(approveResult.variant).toBe('ok');

    // Emit same v2 content — should now be unchanged
    const unchangedResult = await emitAndCompare(
      storage,
      'gen/token.ts',
      'const TOKEN_V2 = true;',
    );
    expect(unchangedResult.variant).toBe('unchanged');
  });

  it('should report unchanged when content matches approved baseline', async () => {
    const content = 'export function hash(data: string): string { return data; }';

    // Emit, approve, then emit same content
    await emitAndCompare(storage, 'gen/hash.ts', content);
    await snapshotHandler.approve({ path: 'gen/hash.ts' }, storage);

    const result = await emitAndCompare(storage, 'gen/hash.ts', content);

    expect(result.variant).toBe('unchanged');
    expect(result.snapshot).toBeDefined();
  });

  it('should approve all pending snapshots across multiple files', async () => {
    // Emit three new files
    await emitAndCompare(storage, 'gen/models/user.ts', 'class User {}');
    await emitAndCompare(storage, 'gen/models/role.ts', 'class Role {}');
    await emitAndCompare(storage, 'gen/models/session.ts', 'class Session {}');

    // Approve all at once
    const approveAllResult = await snapshotHandler.approveAll({}, storage);

    expect(approveAllResult.variant).toBe('ok');
    expect(approveAllResult.approved).toBe(3);

    // Verify all are now unchanged when re-compared
    const userResult = await emitAndCompare(storage, 'gen/models/user.ts', 'class User {}');
    const roleResult = await emitAndCompare(storage, 'gen/models/role.ts', 'class Role {}');
    const sessionResult = await emitAndCompare(storage, 'gen/models/session.ts', 'class Session {}');

    expect(userResult.variant).toBe('unchanged');
    expect(roleResult.variant).toBe('unchanged');
    expect(sessionResult.variant).toBe('unchanged');
  });

  it('should reject a snapshot change and preserve the existing baseline', async () => {
    // Emit v1 and approve
    await emitAndCompare(storage, 'gen/config.ts', 'const CONFIG_V1 = {};');
    await snapshotHandler.approve({ path: 'gen/config.ts' }, storage);

    // Emit v2 — content changed
    const changeResult = await emitAndCompare(
      storage,
      'gen/config.ts',
      'const CONFIG_V2 = { debug: true };',
    );
    expect(changeResult.variant).toBe('changed');

    // Reject the change
    const rejectResult = await snapshotHandler.reject(
      { path: 'gen/config.ts' },
      storage,
    );
    expect(rejectResult.variant).toBe('ok');
    expect(rejectResult.snapshot).toBeDefined();

    // Re-compare with v1 content — should match the preserved baseline
    const v1Again = await emitAndCompare(
      storage,
      'gen/config.ts',
      'const CONFIG_V1 = {};',
    );
    expect(v1Again.variant).toBe('unchanged');
  });

  it('should return noChange when approving an already-current snapshot', async () => {
    // Emit, approve, then try to approve again with no new comparison
    await emitAndCompare(storage, 'gen/stable.ts', 'export const STABLE = 1;');
    await snapshotHandler.approve({ path: 'gen/stable.ts' }, storage);

    // Re-compare same content so status is 'current'
    await emitAndCompare(storage, 'gen/stable.ts', 'export const STABLE = 1;');

    const secondApprove = await snapshotHandler.approve(
      { path: 'gen/stable.ts' },
      storage,
    );
    expect(secondApprove.variant).toBe('noChange');
  });
});
