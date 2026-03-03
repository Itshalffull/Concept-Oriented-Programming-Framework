// ============================================================
// Versioning Entity Conformance Tests
//
// Validates that versioning concepts (Branch, Patch, Ref,
// TemporalVersion, DiffProvider, MergeStrategy, etc.) are
// registered as config or content entities with proper Relations.
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parseSyncFile } from '../../../../handlers/ts/framework/sync-parser.handler.js';

const SYNCS_DIR = resolve(__dirname, '..', 'syncs');

function readSync(subdir: string, name: string): string {
  const path = resolve(SYNCS_DIR, subdir, `${name}.sync`);
  expect(existsSync(path), `Sync file missing: ${path}`).toBe(true);
  return readFileSync(path, 'utf-8');
}

describe('Versioning Entity Syncs', () => {
  const versioningSyncs = [
    'branch-as-content-entity',
    'patch-as-content-entity',
    'ref-as-content-entity',
    'temporal-version-as-content-entity',
    'diff-provider-as-config-entity',
    'merge-strategy-as-config-entity',
    'retention-policy-as-config-entity',
    'schema-evolution-as-config-entity',
  ];

  describe('sync file parsing', () => {
    for (const name of versioningSyncs) {
      it(`parses ${name}.sync without errors`, () => {
        const source = readSync('versioning', name);
        const result = parseSyncFile(source);
        expect(result.errors).toHaveLength(0);
        expect(result.syncs.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  describe('versioning entity structure', () => {
    it('BranchAsContentEntity creates branched_from Relation', () => {
      const source = readSync('versioning', 'branch-as-content-entity');
      const result = parseSyncFile(source);
      const relationSync = result.syncs.find(s => s.thenActions.some(
        a => a.concept === 'Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });
  });
});
