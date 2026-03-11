// ============================================================
// Repertoire Extended Entity Conformance Tests
//
// Validates that extended repertoire concepts (Canvas, Comment,
// SyncedContent, Version, ContentNode, Intent, TypeSystem,
// Namespace, Collection, Graph, MediaAsset, etc.) are registered
// as config or content entities with proper Relations.
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

describe('Repertoire Extended Entity Syncs', () => {
  const repertoireExtendedSyncs = [
    'canvas-as-content-entity',
    'comment-as-content-entity',
    'synced-content-as-content-entity',
    'version-as-content-entity',
    'content-node-as-content-entity',
    'content-parser-as-config-entity',
    'intent-as-config-entity',
    'type-system-as-config-entity',
    'outline-as-content-entity',
    'page-as-record-as-content-entity',
    'namespace-as-content-entity',
    'taxonomy-as-config-entity',
    'expression-language-as-config-entity',
    'event-bus-as-config-entity',
    'pathauto-as-config-entity',
    'validator-as-config-entity',
    'data-source-as-config-entity',
    'collection-as-content-entity',
    'graph-as-content-entity',
    'display-mode-as-config-entity',
    'form-builder-as-config-entity',
    'media-asset-as-content-entity',
    'exposed-filter-as-config-entity',
    'search-index-as-config-entity',
  ];

  describe('sync file parsing', () => {
    for (const name of repertoireExtendedSyncs) {
      it(`parses ${name}.sync without errors`, () => {
        const source = readSync('repertoire-extended', name);
        const syncs = parseSyncFile(source);
        expect(syncs.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  describe('repertoire extended entity structure', () => {
    it('CommentAsContentEntity creates comments_on Relation', () => {
      const source = readSync('repertoire-extended', 'comment-as-content-entity');
      const syncs = parseSyncFile(source);
      const relationSync = syncs.find(s => s.then.some(
        a => a.concept === 'urn:clef/Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });

    it('VersionAsContentEntity creates version_of Relation', () => {
      const source = readSync('repertoire-extended', 'version-as-content-entity');
      const syncs = parseSyncFile(source);
      const relationSync = syncs.find(s => s.then.some(
        a => a.concept === 'urn:clef/Relation' && a.action === 'link',
      ));
      expect(relationSync).toBeDefined();
    });
  });
});
