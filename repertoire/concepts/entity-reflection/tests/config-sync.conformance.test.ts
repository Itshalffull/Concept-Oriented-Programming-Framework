// ============================================================
// ConfigSync Integration Conformance Tests — Wave 5
//
// Validates that ConfigSync properly tracks config entity
// origins, override layers, export catalogs, provenance,
// and file artifact links.
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

describe('Wave 5: ConfigSync Integration', () => {
  const configSyncSyncs = [
    'config-sync-tracks-origin',
    'config-sync-override-layer',
    'config-sync-export-catalog',
    'config-sync-provenance-link',
    'config-sync-file-artifact-link',
  ];

  describe('sync file parsing', () => {
    for (const name of configSyncSyncs) {
      it(`parses ${name}.sync without errors`, () => {
        const source = readSync('config-sync', name);
        const syncs = parseSyncFile(source);
        expect(syncs.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  describe('config sync structure', () => {
    it('ConfigSyncTracksOrigin tags entities with config_origin via Property/set', () => {
      const source = readSync('config-sync', 'config-sync-tracks-origin');
      const syncs = parseSyncFile(source);
      const mainSync = syncs[0];
      const setsProperty = mainSync.then.some(
        a => a.concept === 'urn:clef/Property' && a.action === 'set',
      );
      expect(setsProperty).toBe(true);
    });

    it('ConfigSyncOverrideLayer triggers on ConfigSync/override', () => {
      const source = readSync('config-sync', 'config-sync-override-layer');
      const syncs = parseSyncFile(source);
      const mainSync = syncs[0];
      expect(mainSync.when[0].concept).toBe('urn:clef/ConfigSync');
      expect(mainSync.when[0].action).toBe('override');
    });

    it('ConfigSyncOverrideLayer creates overrides Relation and ChangeStream entry', () => {
      const source = readSync('config-sync', 'config-sync-override-layer');
      const syncs = parseSyncFile(source);
      const relationSync = syncs.find(s => s.then.some(
        a => a.concept === 'urn:clef/Relation' && a.action === 'link',
      ));
      const changeStreamSync = syncs.find(s => s.then.some(
        a => a.concept === 'urn:clef/ChangeStream' && a.action === 'append',
      ));
      expect(relationSync).toBeDefined();
      expect(changeStreamSync).toBeDefined();
    });

    it('ConfigSyncProvenanceLink records provenance on export', () => {
      const source = readSync('config-sync', 'config-sync-provenance-link');
      const syncs = parseSyncFile(source);
      const mainSync = syncs[0];
      expect(mainSync.when[0].concept).toBe('urn:clef/ConfigSync');
      expect(mainSync.when[0].action).toBe('export');
      const recordsProvenance = mainSync.then.some(
        a => a.concept === 'urn:clef/Provenance' && a.action === 'record',
      );
      expect(recordsProvenance).toBe(true);
    });

    it('ConfigSyncFileArtifactLink creates originated_from_file Relations', () => {
      const source = readSync('config-sync', 'config-sync-file-artifact-link');
      const syncs = parseSyncFile(source);
      const relationSyncs = syncs.filter(s => s.then.some(
        a => a.concept === 'urn:clef/Relation' && a.action === 'link',
      ));
      expect(relationSyncs.length).toBeGreaterThanOrEqual(1);
    });
  });
});
