// ============================================================
// Lifecycle Conformance Tests — Wave 6
//
// Validates cross-references, provenance tracking, versioning
// integration, and remaining content/config entity syncs.
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

describe('Wave 6: Lifecycle Syncs', () => {
  const lifecycleSyncs = [
    'content-save-tracks-references',
    'content-save-tracks-provenance',
    'llm-trace-as-content-entity',
    'wallet-as-content-entity',
    'generation-run-as-content-entity',
    'provenance-to-change-stream',
    'dag-history-node-as-score-entity',
    'interactor-entity-to-config-entity',
  ];

  describe('sync file parsing', () => {
    for (const name of lifecycleSyncs) {
      it(`parses ${name}.sync without errors`, () => {
        const source = readSync('lifecycle', name);
        const result = parseSyncFile(source);
        expect(result.errors).toHaveLength(0);
        expect(result.syncs.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  describe('lifecycle sync structure', () => {
    it('ContentSaveTracksReferences triggers on ContentStorage/save', () => {
      const source = readSync('lifecycle', 'content-save-tracks-references');
      const result = parseSyncFile(source);
      const mainSync = result.syncs[0];
      expect(mainSync.whenPatterns[0].concept).toBe('ContentStorage');
      expect(mainSync.whenPatterns[0].action).toBe('save');
    });

    it('ContentSaveTracksProvenance records via Provenance/record', () => {
      const source = readSync('lifecycle', 'content-save-tracks-provenance');
      const result = parseSyncFile(source);
      const mainSync = result.syncs[0];
      const recordsProvenance = mainSync.thenActions.some(
        a => a.concept === 'Provenance' && a.action === 'record',
      );
      expect(recordsProvenance).toBe(true);
    });

    it('ProvenanceToChangeStream bridges to ChangeStream/append', () => {
      const source = readSync('lifecycle', 'provenance-to-change-stream');
      const result = parseSyncFile(source);
      const mainSync = result.syncs[0];
      expect(mainSync.whenPatterns[0].concept).toBe('Provenance');
      const appendsChangeStream = mainSync.thenActions.some(
        a => a.concept === 'ChangeStream' && a.action === 'append',
      );
      expect(appendsChangeStream).toBe(true);
    });

    it('DAGHistoryNodeAsScoreEntity creates Symbol and parent Relation', () => {
      const source = readSync('lifecycle', 'dag-history-node-as-score-entity');
      const result = parseSyncFile(source);
      const symbolSync = result.syncs.find(s => s.thenActions.some(
        a => a.concept === 'Symbol' && a.action === 'register',
      ));
      const relationSync = result.syncs.find(s => s.thenActions.some(
        a => a.concept === 'Relation' && a.action === 'link',
      ));
      expect(symbolSync).toBeDefined();
      expect(relationSync).toBeDefined();
    });

    it('InteractorEntityToConfigEntity triggers on InteractorEntity/register', () => {
      const source = readSync('lifecycle', 'interactor-entity-to-config-entity');
      const result = parseSyncFile(source);
      const mainSync = result.syncs[0];
      expect(mainSync.whenPatterns[0].concept).toBe('InteractorEntity');
      expect(mainSync.whenPatterns[0].action).toBe('register');
    });
  });
});
