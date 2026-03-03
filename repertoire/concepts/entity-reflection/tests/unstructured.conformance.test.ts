// ============================================================
// Unstructured Data Conformance Tests — Wave 7
//
// Validates handling of unstructured and semi-structured data:
// text parsing for references/tags, progressive schema
// inference, and binary metadata extraction.
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

describe('Wave 7: Unstructured Data Syncs', () => {
  const unstructuredSyncs = [
    'unstructured-content-parsed',
    'unstructured-to-progressive-schema',
    'binary-asset-metadata-extracted',
  ];

  describe('sync file parsing', () => {
    for (const name of unstructuredSyncs) {
      it(`parses ${name}.sync without errors`, () => {
        const source = readSync('unstructured', name);
        const result = parseSyncFile(source);
        expect(result.errors).toHaveLength(0);
        expect(result.syncs.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  describe('unstructured sync structure', () => {
    it('UnstructuredContentParsed creates Reference and Tag entries', () => {
      const source = readSync('unstructured', 'unstructured-content-parsed');
      const result = parseSyncFile(source);
      const refSync = result.syncs.find(s => s.thenActions.some(
        a => a.concept === 'Reference' && a.action === 'addRef',
      ));
      const tagSync = result.syncs.find(s => s.thenActions.some(
        a => a.concept === 'Tag' && a.action === 'addTag',
      ));
      expect(refSync).toBeDefined();
      expect(tagSync).toBeDefined();
    });

    it('UnstructuredToProgressiveSchema triggers on Capture/clip', () => {
      const source = readSync('unstructured', 'unstructured-to-progressive-schema');
      const result = parseSyncFile(source);
      const mainSync = result.syncs[0];
      expect(mainSync.whenPatterns[0].concept).toBe('Capture');
      expect(mainSync.whenPatterns[0].action).toBe('clip');
    });

    it('BinaryAssetMetadataExtracted extracts mime type via Property/set', () => {
      const source = readSync('unstructured', 'binary-asset-metadata-extracted');
      const result = parseSyncFile(source);
      const propertySync = result.syncs.find(s => s.thenActions.some(
        a => a.concept === 'Property' && a.action === 'set',
      ));
      expect(propertySync).toBeDefined();
    });
  });
});
