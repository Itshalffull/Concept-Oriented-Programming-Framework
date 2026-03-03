// ============================================================
// Collaboration Entity Conformance Tests
//
// Validates that collaboration concepts (Attribution,
// ConflictResolution, InlineAnnotation, Signature, Alias) are
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

describe('Collaboration Entity Syncs', () => {
  const collaborationSyncs = [
    'attribution-as-content-entity',
    'conflict-resolution-as-config-entity',
    'inline-annotation-as-content-entity',
    'signature-as-content-entity',
    'alias-as-content-entity',
  ];

  describe('sync file parsing', () => {
    for (const name of collaborationSyncs) {
      it(`parses ${name}.sync without errors`, () => {
        const source = readSync('collaboration', name);
        const result = parseSyncFile(source);
        expect(result.errors).toHaveLength(0);
        expect(result.syncs.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  describe('collaboration entity structure', () => {
    it('InlineAnnotationAsContentEntity creates annotates Relation', () => {
      const source = readSync('collaboration', 'inline-annotation-as-content-entity');
      const result = parseSyncFile(source);
      const relationSync = result.syncs.find(s => s.thenActions.some(
        a => a.concept === 'Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });

    it('AliasAsContentEntity creates alias_for Relation', () => {
      const source = readSync('collaboration', 'alias-as-content-entity');
      const result = parseSyncFile(source);
      const relationSync = result.syncs.find(s => s.thenActions.some(
        a => a.concept === 'Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });
  });
});
